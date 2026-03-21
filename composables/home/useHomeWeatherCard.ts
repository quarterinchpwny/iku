import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Geolocation } from '@capacitor/geolocation';
import { resolveWeatherCondition } from '~/components/widgets/weather/weatherConditions';
import { buildHomeWeatherGradient } from '~/components/home/weather/gradient';
import { useAuthStore } from '~/stores/auth';

type WeatherPayload = {
  current?: {
    apparent_temperature?: number;
    cloud_cover?: number;
    precipitation?: number;
    precipitation_probability?: number;
    relative_humidity_2m?: number;
    temperature_2m?: number;
    time?: string;
    visibility?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    is_day?: number;
  };
  daily?: {
    precipitation_probability_max?: number[];
    sunrise?: string[];
    sunset?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    time?: string[];
    uv_index_max?: number[];
    weather_code?: number[];
  };
};

type ReverseGeocodePayload = {
  results?: Array<{
    admin1?: string;
    country?: string;
    name?: string;
  }>;
};

type DetailItem = {
  label: string;
  value: string;
};

type ForecastItem = {
  dayLabel: string;
  icon: string;
  rangeLabel: string;
};

export function useHomeWeatherCard() {
  const authStore = useAuthStore();
  const weather = ref<WeatherPayload | null>(null);
  const placeName = ref('');
  const regionName = ref('');
  const isLoading = ref(true);
  const error = ref('');
  const refreshedAt = ref<Date | null>(null);
  const refreshHandle = ref<ReturnType<typeof setInterval> | null>(null);
  const placeLabel = computed(() => [placeName.value, regionName.value].filter(Boolean).join(', '));

  const greetingName = computed(() => {
    const raw = authStore.user?.username || authStore.user?.sub;
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : '';
  });

  const headerEyebrow = computed(() => greetingName.value ? 'Welcome back' : 'Current weather');
  const headerTitle = computed(() => greetingName.value ? `Hi ${greetingName.value}` : placeLabel.value);
  const current = computed(() => {
    if (!weather.value?.current) throw new Error('Current weather payload missing');
    return weather.value.current;
  });
  const daily = computed(() => {
    if (!weather.value?.daily) throw new Error('Daily weather payload missing');
    return weather.value.daily;
  });
  const currentCondition = computed(() => {
    const weatherCode = numberField(current.value.weather_code, 'Current weather code');
    return resolveWeatherCondition(weatherCode);
  });
  const temperatureLabel = computed(
    () => `${Math.round(numberField(current.value.temperature_2m, 'Current temperature'))}°`
  );
  const conditionLabel = computed(() => currentCondition.value.label);
  const conditionIcon = computed(() => currentCondition.value.icon);
  const dayLabel = computed(() => formatDayLabel(stringField(current.value.time, 'Current time')));
  const highLowLabel = computed(() => {
    const high = Math.round(numberAt(daily.value.temperature_2m_max, 0, 'Daily high'));
    const low = Math.round(numberAt(daily.value.temperature_2m_min, 0, 'Daily low'));
    return `H ${high}° / L ${low}°`;
  });
  const updatedLabel = computed(() => {
    if (!refreshedAt.value) throw new Error('Refresh timestamp missing');
    return refreshedAt.value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  });
  const detailItems = computed<DetailItem[]>(() => [
    { label: 'Feels like', value: `${Math.round(numberField(current.value.apparent_temperature, 'Feels like'))}°` },
    { label: 'Humidity', value: `${Math.round(numberField(current.value.relative_humidity_2m, 'Humidity'))}%` },
    { label: 'Cloud cover', value: `${Math.round(numberField(current.value.cloud_cover, 'Cloud cover'))}%` },
    { label: 'Rain chance', value: `${Math.round(numberField(current.value.precipitation_probability, 'Rain chance'))}%` },
    { label: 'Wind', value: `${Math.round(numberField(current.value.wind_speed_10m, 'Wind speed'))} km/h` },
    { label: 'Visibility', value: `${(numberField(current.value.visibility, 'Visibility') / 1000).toFixed(1)} km` }
  ]);
  const sunItems = computed<DetailItem[]>(() => [
    { label: 'Sunrise', value: formatClock(stringAt(daily.value.sunrise, 0, 'Sunrise')) },
    { label: 'Sunset', value: formatClock(stringAt(daily.value.sunset, 0, 'Sunset')) },
    { label: 'UV peak', value: numberAt(daily.value.uv_index_max, 0, 'UV peak').toFixed(1) },
    {
      label: 'Precip',
      value: `${Math.round(numberAt(daily.value.precipitation_probability_max, 0, 'Daily precipitation'))}%`
    }
  ]);
  const forecastItems = computed<ForecastItem[]>(() =>
    stringList(daily.value.time, 'Daily dates')
      .slice(1, 5)
      .map((entry, index) => {
        const actualIndex = index + 1;
        const icon = resolveWeatherCondition(numberAt(daily.value.weather_code, actualIndex, 'Daily weather code')).icon;
        const high = Math.round(numberAt(daily.value.temperature_2m_max, actualIndex, 'Daily high'));
        const low = Math.round(numberAt(daily.value.temperature_2m_min, actualIndex, 'Daily low'));
        return {
          dayLabel: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(entry)),
          icon,
          rangeLabel: `${high}° / ${low}°`
        };
      })
  );
  const theme = computed(() =>
    buildHomeWeatherGradient({
      cloudCover: numberField(current.value.cloud_cover, 'Cloud cover'),
      currentTime: stringField(current.value.time, 'Current time'),
      isDay: numberField(current.value.is_day, 'Day flag') === 1,
      sunrise: stringAt(daily.value.sunrise, 0, 'Sunrise'),
      sunset: stringAt(daily.value.sunset, 0, 'Sunset'),
      temperature: numberField(current.value.temperature_2m, 'Current temperature'),
      weatherCode: numberField(current.value.weather_code, 'Current weather code')
    })
  );
  const cardStyle = computed<Record<string, string>>(() => ({
    '--home-weather-background': theme.value.background,
    '--home-weather-border': theme.value.border,
    '--home-weather-brand': theme.value.brand,
    '--home-weather-detail-background': theme.value.detailBackground,
    '--home-weather-detail-border': theme.value.detailBorder,
    '--home-weather-muted': theme.value.mutedText,
    '--home-weather-shadow': theme.value.shadow,
    '--home-weather-text': theme.value.text
  }));
  const hasContent = computed(() => Boolean(weather.value) && placeName.value.length > 0);

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
      const [forecastResponse, reverseResponse] = await Promise.all([
        fetchWeather(latitude, longitude),
        fetchPlace(latitude, longitude)
      ]);
      weather.value = forecastResponse;
      placeName.value = reverseResponse.name;
      regionName.value = [reverseResponse.admin1, reverseResponse.country]
        .filter((part) => part && part !== reverseResponse.name)
        .join(', ');
      refreshedAt.value = new Date();
    } catch (caughtError: unknown) {
      error.value = caughtError instanceof Error ? caughtError.message : 'Unable to load weather card';
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
    conditionIcon,
    conditionLabel,
    dayLabel,
    detailItems,
    error,
    forecastItems,
    hasContent,
    headerEyebrow,
    headerTitle,
    highLowLabel,
    isLoading,
    placeLabel,
    refreshWeather,
    sunItems,
    temperatureLabel,
    updatedLabel
  };
}

async function fetchWeather(latitude: number, longitude: number) {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,precipitation_probability,wind_speed_10m,weather_code,is_day,cloud_cover,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset,precipitation_probability_max&forecast_days=6&timezone=auto`
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

function numberAt(values: number[] | undefined, index: number, label: string) {
  return numberField(values?.[index], label);
}

function stringField(value: string | undefined, label: string) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} missing from weather payload`);
  return value;
}

function stringAt(values: string[] | undefined, index: number, label: string) {
  return stringField(values?.[index], label);
}

function stringList(values: string[] | undefined, label: string) {
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${label} missing from weather payload`);
  return values;
}

function formatDayLabel(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    weekday: 'long'
  }).format(new Date(value));
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}
