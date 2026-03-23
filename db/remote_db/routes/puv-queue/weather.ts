import type { D1Database } from '@cloudflare/workers-types';

import type { QueueRouteConfig, WeatherSeverity, WeatherSignal } from './types';

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;

type WeatherCacheRow = {
  weather_json: string;
  fetched_at: number;
};

type StoredWeather = Omit<WeatherSignal, 'source'>;

type OpenMeteoForecast = {
  hourly?: {
    time?: string[];
    precipitation_probability?: number[];
    precipitation?: number[];
    rain?: number[];
    showers?: number[];
    weather_code?: number[];
  };
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function routeHourKey(now: Date, timeZone: string): string {
  const parts = getFormatter(timeZone).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:00`;
}

function midpoint(route: QueueRouteConfig): { lat: number; lng: number } {
  return {
    lng: (route.origin[0] + route.destination[0]) / 2,
    lat: (route.origin[1] + route.destination[1]) / 2,
  };
}

function coerceNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getSeverity(
  precipitationProbability: number | null,
  precipitationMm: number | null,
  rainMm: number | null,
  showersMm: number | null,
  weatherCode: number | null,
): WeatherSeverity {
  const liquidMm = Math.max(precipitationMm ?? 0, rainMm ?? 0, showersMm ?? 0);

  if (liquidMm >= 7 || (precipitationProbability ?? 0) >= 90 || weatherCode === 95 || weatherCode === 96 || weatherCode === 99) {
    return 'heavy_rain';
  }

  if (liquidMm >= 3 || (precipitationProbability ?? 0) >= 70 || weatherCode === 63 || weatherCode === 65 || weatherCode === 80 || weatherCode === 81 || weatherCode === 82) {
    return 'moderate_rain';
  }

  if (liquidMm >= 0.5 || (precipitationProbability ?? 0) >= 40 || weatherCode === 51 || weatherCode === 53 || weatherCode === 55 || weatherCode === 61) {
    return 'light_rain';
  }

  return 'clear';
}

function severityScoreDelta(severity: WeatherSeverity): number {
  return {
    clear: 0,
    light_rain: 0.5,
    moderate_rain: 1.1,
    heavy_rain: 2,
  }[severity];
}

function mapStoredWeather(raw: StoredWeather, source: WeatherSignal['source']): WeatherSignal {
  return {
    ...raw,
    source,
  };
}

function parseStoredWeather(value: string): StoredWeather | null {
  try {
    const parsed = JSON.parse(value) as StoredWeather;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function unavailableWeather(): WeatherSignal {
  return {
    source: 'unavailable',
    severity: 'clear',
    score_delta: 0,
    weather_code: null,
    precipitation_probability: null,
    precipitation_mm: null,
    rain_mm: null,
    showers_mm: null,
    fetched_at: null,
  };
}

async function readCachedWeather(db: D1Database, routeKey: string): Promise<WeatherSignal | null> {
  const row = await db
    .prepare('SELECT weather_json, fetched_at FROM puv_queue_weather_cache WHERE route_key = ? LIMIT 1')
    .bind(routeKey)
    .first<WeatherCacheRow>();

  if (!row) {
    return null;
  }

  if (Date.now() - row.fetched_at > WEATHER_CACHE_TTL_MS) {
    return null;
  }

  const parsed = parseStoredWeather(row.weather_json);
  return parsed ? mapStoredWeather(parsed, 'open_meteo_cache') : null;
}

async function writeCachedWeather(db: D1Database, routeKey: string, weather: StoredWeather): Promise<void> {
  await db
    .prepare(
      `INSERT INTO puv_queue_weather_cache (route_key, weather_json, fetched_at)
       VALUES (?, ?, ?)
       ON CONFLICT(route_key)
       DO UPDATE SET weather_json = excluded.weather_json,
                     fetched_at = excluded.fetched_at`,
    )
    .bind(routeKey, JSON.stringify(weather), Date.now())
    .run();
}

function selectHourlyIndex(hourly: OpenMeteoForecast['hourly'], timeZone: string): number {
  const times = Array.isArray(hourly?.time) ? hourly.time : [];
  if (!times.length) {
    return -1;
  }

  const key = routeHourKey(new Date(), timeZone);
  const exactIndex = times.findIndex((time) => time === key);
  return exactIndex >= 0 ? exactIndex : 0;
}

function weatherFromForecast(forecast: OpenMeteoForecast, timeZone: string): StoredWeather | null {
  const hourly = forecast.hourly;
  const index = selectHourlyIndex(hourly, timeZone);
  if (!hourly || index < 0) {
    return null;
  }

  const precipitationProbability = coerceNumber(hourly.precipitation_probability?.[index]);
  const precipitationMm = coerceNumber(hourly.precipitation?.[index]);
  const rainMm = coerceNumber(hourly.rain?.[index]);
  const showersMm = coerceNumber(hourly.showers?.[index]);
  const weatherCode = coerceNumber(hourly.weather_code?.[index]);
  const severity = getSeverity(precipitationProbability, precipitationMm, rainMm, showersMm, weatherCode);

  return {
    severity,
    score_delta: severityScoreDelta(severity),
    weather_code: weatherCode,
    precipitation_probability: precipitationProbability,
    precipitation_mm: precipitationMm,
    rain_mm: rainMm,
    showers_mm: showersMm,
    fetched_at: new Date().toISOString(),
  };
}

async function fetchLiveWeather(route: QueueRouteConfig): Promise<StoredWeather | null> {
  const point = midpoint(route);
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set('latitude', String(point.lat));
  url.searchParams.set('longitude', String(point.lng));
  url.searchParams.set('hourly', 'precipitation_probability,precipitation,rain,showers,weather_code');
  url.searchParams.set('forecast_days', '2');
  url.searchParams.set('timezone', route.timezone);

  const response = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json<OpenMeteoForecast>();
  return weatherFromForecast(payload, route.timezone);
}

export async function resolveWeatherSignal(db: D1Database, route: QueueRouteConfig): Promise<WeatherSignal> {
  const cached = await readCachedWeather(db, route.route_key);
  if (cached) {
    return cached;
  }

  const live = await fetchLiveWeather(route);
  if (!live) {
    return unavailableWeather();
  }

  await writeCachedWeather(db, route.route_key, live);
  return mapStoredWeather(live, 'open_meteo_live');
}
