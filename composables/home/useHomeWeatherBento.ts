import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Geolocation } from '@capacitor/geolocation';
import { buildHomeWeatherGradient } from '~/components/home/weather/gradient';
import { resolveWeatherCondition } from '~/components/widgets/weather/weatherConditions';

type WeatherPayload = {
  current?: {
    cloud_cover?: number;
    is_day?: number;
    temperature_2m?: number;
    time?: string;
    weather_code?: number;
  };
  hourly?: {
    precipitation_probability?: number[];
    temperature_2m?: number[];
    time?: string[];
    weather_code?: number[];
  };
  daily?: {
    sunrise?: string[];
    sunset?: string[];
    time?: string[];
  };
};

type ReverseGeocodePayload = {
  results?: Array<{
    admin1?: string;
    country?: string;
    name?: string;
  }>;
};

type HourlyItem = {
  icon: string;
  label: string;
  precipitationLabel: string;
  temperatureLabel: string;
};

export function useHomeWeatherBento() {
  const weather = ref<WeatherPayload | null>(null);
  const locationName = ref('');
  const regionName = ref('');
  const isLoading = ref(true);
  const error = ref('');
  const refreshHandle = ref<ReturnType<typeof setInterval> | null>(null);

  const current = computed(() => {
    if (!weather.value?.current) throw new Error('Current weather payload missing');
    return weather.value.current;
  });
  const daily = computed(() => {
    if (!weather.value?.daily) throw new Error('Daily weather payload missing');
    return weather.value.daily;
  });
  const hourly = computed(() => {
    if (!weather.value?.hourly) throw new Error('Hourly weather payload missing');
    return weather.value.hourly;
  });
  const currentCondition = computed(() =>
    resolveWeatherCondition(numberField(current.value.weather_code, 'Current weather code'))
  );
  const locationLabel = computed(() =>
    [locationName.value, regionName.value].filter(Boolean).join(', ')
  );
  const temperatureLabel = computed(
    () => `${Math.round(numberField(current.value.temperature_2m, 'Current temperature'))}°`
  );
  const dateLabel = computed(() =>
    new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'long',
      weekday: 'long'
    }).format(new Date(stringField(current.value.time, 'Current time')))
  );
  const hourlyItems = computed<HourlyItem[]>(() => {
    const times = stringList(hourly.value.time, 'Hourly times');
    const temperatures = numberList(hourly.value.temperature_2m, 'Hourly temperatures');
    const weatherCodes = numberList(hourly.value.weather_code, 'Hourly weather codes');
    const precipitation = numberList(
      hourly.value.precipitation_probability,
      'Hourly precipitation probability'
    );
    const currentTime = stringField(current.value.time, 'Current time');
    const currentIndex = Math.max(0, times.findIndex((entry) => entry === currentTime));
    return times.slice(currentIndex, currentIndex + 6).map((time, index) => {
      const offset = currentIndex + index;
      return {
        icon: resolveWeatherCondition(Math.round(weatherCodes[offset])).icon,
        label:
          index === 0
            ? 'Now'
            : new Intl.DateTimeFormat('en-US', { hour: 'numeric' }).format(new Date(time)),
        precipitationLabel: `${Math.round(precipitation[offset])}%`,
        temperatureLabel: `${Math.round(temperatures[offset])}°`
      };
    });
  });
  const cardStyle = computed<Record<string, string>>(() => {
    const theme = buildHomeWeatherGradient({
      cloudCover: numberField(current.value.cloud_cover, 'Cloud cover'),
      currentTime: stringField(current.value.time, 'Current time'),
      isDay: numberField(current.value.is_day, 'Day flag') === 1,
      sunrise: stringAt(daily.value.sunrise, 0, 'Sunrise'),
      sunset: stringAt(daily.value.sunset, 0, 'Sunset'),
      temperature: numberField(current.value.temperature_2m, 'Current temperature'),
      weatherCode: numberField(current.value.weather_code, 'Current weather code')
    });
    return {
      '--home-weather-background': theme.background,
      '--home-weather-border': theme.border,
      '--home-weather-brand': theme.brand,
      '--home-weather-detail-background': theme.detailBackground,
      '--home-weather-detail-border': theme.detailBorder,
      '--home-weather-muted': theme.mutedText,
      '--home-weather-shadow': theme.shadow,
      '--home-weather-text': theme.text
    };
  });

  async function refreshWeather() {
    try {
      isLoading.value = true;
      error.value = '';
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        maximumAge: 300000,
        timeout: 12000
      });
      const latitude = Number(position.coords.latitude);
      const longitude = Number(position.coords.longitude);
      const [forecast, place] = await Promise.all([
        fetchWeather(latitude, longitude),
        fetchPlace(latitude, longitude)
      ]);
      weather.value = forecast;
      locationName.value = place.name;
      regionName.value = [place.admin1, place.country]
        .filter((part) => part && part !== place.name)
        .join(', ');
    } catch (caughtError: unknown) {
      error.value =
        caughtError instanceof Error ? caughtError.message : 'Unable to load weather';
    } finally {
      isLoading.value = false;
    }
  }

  onMounted(async () => {
    await refreshWeather();
    refreshHandle.value = setInterval(refreshWeather, 300000);
  });

  onUnmounted(() => {
    if (refreshHandle.value) clearInterval(refreshHandle.value);
  });

  return {
    cardStyle,
    currentCondition,
    dateLabel,
    error,
    hourlyItems,
    isLoading,
    locationLabel,
    refreshWeather,
    temperatureLabel
  };
}

async function fetchWeather(latitude: number, longitude: number) {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day,cloud_cover&hourly=temperature_2m,weather_code,precipitation_probability&daily=sunrise,sunset&forecast_days=2&timezone=auto`
  );
  if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
  return (await response.json()) as WeatherPayload;
}

async function fetchPlace(latitude: number, longitude: number) {
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&count=1`
    );
    if (!response.ok) throw new Error(`Reverse geocoding failed (${response.status})`);
    const payload = (await response.json()) as ReverseGeocodePayload;
    const match = payload.results?.[0];
    if (!match?.name) throw new Error('Reverse geocoding returned no place results');
    return {
      admin1: typeof match.admin1 === 'string' ? match.admin1 : '',
      country: typeof match.country === 'string' ? match.country : '',
      name: match.name
    };
  } catch {
    return {
      admin1: '',
      country: '',
      name: `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`
    };
  }
}

function numberField(value: number | undefined, label: string) {
  if (!Number.isFinite(value)) throw new Error(`${label} missing from weather payload`);
  return Number(value);
}

function stringField(value: string | undefined, label: string) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} missing from weather payload`);
  return value;
}

function numberList(values: number[] | undefined, label: string) {
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${label} missing from weather payload`);
  return values;
}

function stringList(values: string[] | undefined, label: string) {
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${label} missing from weather payload`);
  return values;
}

function stringAt(values: string[] | undefined, index: number, label: string) {
  return stringField(values?.[index], label);
}
