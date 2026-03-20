import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Geolocation } from '@capacitor/geolocation';
import { resolveWeatherCondition } from './weatherConditions';
import type { ForecastDay, ForecastHour, WeatherCity, WeatherResponse } from './types';

type CityTarget = {
  id: string;
  region: string;
  name: string;
  latitude: number;
  longitude: number;
};

const companionCities: CityTarget[] = [
  { id: 'los-angeles', region: 'US', name: 'Los Angeles', latitude: 34.0522, longitude: -118.2437 },
  { id: 'tokyo', region: 'Japan', name: 'Tokyo', latitude: 35.6762, longitude: 139.6503 },
  { id: 'jerusalem', region: 'Israel', name: 'Jerusalem', latitude: 31.7683, longitude: 35.2137 }
];

export function useWeatherPanel() {
  const weatherData = ref<WeatherResponse | null>(null);
  const cityName = ref('Locating');
  const regionName = ref('Weather');
  const isLoading = ref(true);
  const error = ref('');
  const lastUpdated = ref<Date | null>(null);
  const refreshTimer = ref<ReturnType<typeof setInterval> | null>(null);
  const cityForecasts = ref<WeatherCity[]>([]);

  const currentCondition = computed(() => {
    const code = Number(weatherData.value?.current?.weather_code);
    if (!Number.isFinite(code))
      throw new Error('Current weather code missing from forecast payload');
    return resolveWeatherCondition(code);
  });

  const heroCityLabel = computed(
    () => `${cityName.value}${regionName.value ? `, ${regionName.value}` : ''}`
  );
  const currentTemperature = computed(
    () => `${Math.round(Number(weatherData.value?.current?.temperature_2m))}°C`
  );
  const feelsLike = computed(
    () => `${Math.round(Number(weatherData.value?.current?.apparent_temperature))}°C`
  );
  const humidity = computed(
    () => `${Math.round(Number(weatherData.value?.current?.relative_humidity_2m))}%`
  );
  const windSpeed = computed(
    () => `${Math.round(Number(weatherData.value?.current?.wind_speed_10m))} km/h`
  );
  const precipitation = computed(
    () => `${Number(weatherData.value?.current?.precipitation).toFixed(1)} mm`
  );
  const uvIndex = computed(() => {
    const raw = Number(weatherData.value?.daily?.uv_index_max?.[0]);
    return raw.toFixed(raw >= 10 ? 0 : 1);
  });

  const dayLabel = computed(() => {
    const currentTime = weatherData.value?.current?.time;
    if (!currentTime) throw new Error('Current weather time missing from forecast payload');
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      weekday: 'long'
    }).format(new Date(currentTime));
  });

  const sunriseLabel = computed(() => formatClock(weatherData.value?.daily?.sunrise?.[0]));
  const sunsetLabel = computed(() => formatClock(weatherData.value?.daily?.sunset?.[0]));

  const forecastDays = computed<ForecastDay[]>(() => {
    const daily = weatherData.value?.daily;
    if (
      !daily?.time?.length ||
      !daily.weather_code?.length ||
      !daily.temperature_2m_max?.length ||
      !daily.temperature_2m_min?.length
    ) {
      throw new Error('Daily forecast payload missing required arrays');
    }
    return daily.time.slice(0, 6).map((isoDate, index) => {
      const condition = resolveWeatherCondition(Number(daily.weather_code[index]));
      return {
        dayLabel: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(isoDate)),
        fullLabel: isoDate,
        icon: condition.icon,
        condition: condition.label,
        high: `${Math.round(Number(daily.temperature_2m_max[index]))}°`,
        low: `${Math.round(Number(daily.temperature_2m_min[index]))}°`,
        active: index === 0
      };
    });
  });

  const forecastHours = computed<ForecastHour[]>(() => {
    const hourly = weatherData.value?.hourly;
    const currentTime = weatherData.value?.current?.time;
    if (
      !hourly?.time?.length ||
      !hourly.temperature_2m?.length ||
      !hourly.weather_code?.length ||
      !hourly.precipitation_probability?.length ||
      !currentTime
    ) {
      throw new Error('Hourly forecast payload missing required arrays');
    }
    const currentIndex = hourly.time.findIndex((entry) => entry === currentTime);
    const startIndex = currentIndex >= 0 ? currentIndex : 0;
    return hourly.time.slice(startIndex, startIndex + 6).map((isoTime, index) => {
      const offset = startIndex + index;
      const condition = resolveWeatherCondition(Number(hourly.weather_code[offset]));
      return {
        label: formatHour(isoTime),
        temperature: `${Math.round(Number(hourly.temperature_2m[offset]))}°`,
        probability: Number(hourly.precipitation_probability[offset]),
        icon: condition.icon,
        condition: condition.label
      };
    });
  });

  const updatedLabel = computed(() => {
    if (!lastUpdated.value)
      throw new Error('Weather panel rendered before the first update completed');
    return `Updated ${lastUpdated.value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  });

  async function fetchWeather() {
    try {
      isLoading.value = true;
      error.value = '';
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });
      const latitude = Number(position.coords.latitude);
      const longitude = Number(position.coords.longitude);
      const [forecastResponse, geoResult, companionResults] = await Promise.all([
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,precipitation_probability,wind_speed_10m,weather_code,is_day&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset&forecast_days=7&timezone=auto`
        ),
        fetchCityLabel(latitude, longitude),
        Promise.allSettled(companionCities.map((city) => fetchCompanionCity(city)))
      ]);
      if (!forecastResponse.ok)
        throw new Error(`Weather request failed (${forecastResponse.status})`);
      weatherData.value = (await forecastResponse.json()) as WeatherResponse;
      cityName.value = geoResult.cityName;
      regionName.value = geoResult.regionName;
      cityForecasts.value = companionResults.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : []
      );
      lastUpdated.value = new Date();
    } catch (caughtError: unknown) {
      error.value = caughtError instanceof Error ? caughtError.message : 'Unable to load weather';
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchCompanionCity(city: CityTarget): Promise<WeatherCity> {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m,weather_code&timezone=auto`
    );
    if (!response.ok)
      throw new Error(`Companion city request failed for ${city.name} (${response.status})`);
    const payload = (await response.json()) as WeatherResponse;
    const code = Number(payload.current?.weather_code);
    const condition = resolveWeatherCondition(code);
    return {
      id: city.id,
      region: city.region,
      name: city.name,
      temperature: `${Math.round(Number(payload.current?.temperature_2m))}°`,
      condition: condition.label,
      icon: condition.icon
    };
  }

  onMounted(async () => {
    await fetchWeather();
    refreshTimer.value = setInterval(fetchWeather, 300000);
  });

  onUnmounted(() => {
    if (refreshTimer.value) clearInterval(refreshTimer.value);
  });

  return {
    cityForecasts,
    currentCondition,
    currentTemperature,
    dayLabel,
    error,
    feelsLike,
    fetchWeather,
    forecastDays,
    forecastHours,
    heroCityLabel,
    humidity,
    isLoading,
    precipitation,
    sunriseLabel,
    sunsetLabel,
    updatedLabel,
    uvIndex,
    weatherData,
    windSpeed
  };
}

async function fetchCityLabel(latitude: number, longitude: number) {
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&count=1`
    );
    if (!response.ok) throw new Error(`Reverse geocoding failed (${response.status})`);
    const payload = await response.json();
    const place = payload.results?.[0];
    if (!place?.name) throw new Error('Reverse geocoding returned no place results');
    return {
      cityName: String(place.name),
      regionName: place.country ? String(place.country) : ''
    };
  } catch {
    return {
      cityName: `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`,
      regionName: ''
    };
  }
}

function formatHour(value: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric' }).format(new Date(value));
}

function formatClock(value: string | undefined) {
  if (!value) throw new Error('Daily sun event missing from forecast payload');
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
    new Date(value)
  );
}
