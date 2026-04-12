export interface WeatherCondition {
  label: string;
  icon: string;
}

export const weatherConditions: Record<number, { label: string; day: string; night: string }> = {
  0:  { label: 'Clear',                        day: 'meteocons:clear-day-fill',                    night: 'meteocons:clear-night-fill' },
  1:  { label: 'Mostly Clear',                 day: 'meteocons:clear-day-fill',                    night: 'meteocons:clear-night-fill' },
  2:  { label: 'Partly Cloudy',                day: 'meteocons:partly-cloudy-day-fill',             night: 'meteocons:partly-cloudy-night-fill' },
  3:  { label: 'Overcast',                     day: 'meteocons:overcast-fill',                     night: 'meteocons:overcast-night-fill' },
  45: { label: 'Fog',                          day: 'meteocons:fog-day-fill',                      night: 'meteocons:fog-night-fill' },
  48: { label: 'Rime Fog',                     day: 'meteocons:fog-day-fill',                      night: 'meteocons:fog-night-fill' },
  51: { label: 'Light Drizzle',               day: 'meteocons:drizzle-fill',                      night: 'meteocons:drizzle-fill' },
  53: { label: 'Drizzle',                      day: 'meteocons:drizzle-fill',                      night: 'meteocons:drizzle-fill' },
  55: { label: 'Heavy Drizzle',               day: 'meteocons:partly-cloudy-day-drizzle-fill',    night: 'meteocons:partly-cloudy-night-drizzle-fill' },
  56: { label: 'Light Freezing Drizzle',      day: 'meteocons:partly-cloudy-day-sleet-fill',      night: 'meteocons:partly-cloudy-night-sleet-fill' },
  57: { label: 'Freezing Drizzle',            day: 'meteocons:sleet-fill',                        night: 'meteocons:sleet-fill' },
  61: { label: 'Light Rain',                  day: 'meteocons:partly-cloudy-day-rain-fill',       night: 'meteocons:partly-cloudy-night-rain-fill' },
  63: { label: 'Rain',                         day: 'meteocons:rain-fill',                         night: 'meteocons:rain-fill' },
  65: { label: 'Heavy Rain',                  day: 'meteocons:rain-fill',                         night: 'meteocons:rain-fill' },
  66: { label: 'Light Freezing Rain',         day: 'meteocons:sleet-fill',                        night: 'meteocons:sleet-fill' },
  67: { label: 'Heavy Freezing Rain',         day: 'meteocons:sleet-fill',                        night: 'meteocons:sleet-fill' },
  71: { label: 'Light Snow',                  day: 'meteocons:partly-cloudy-day-snow-fill',       night: 'meteocons:partly-cloudy-night-snow-fill' },
  73: { label: 'Snow',                         day: 'meteocons:snow-fill',                         night: 'meteocons:snow-fill' },
  75: { label: 'Heavy Snow',                  day: 'meteocons:snow-fill',                         night: 'meteocons:snow-fill' },
  77: { label: 'Snow Grains',                 day: 'meteocons:snow-fill',                         night: 'meteocons:snow-fill' },
  80: { label: 'Light Rain Showers',          day: 'meteocons:partly-cloudy-day-rain-fill',       night: 'meteocons:partly-cloudy-night-rain-fill' },
  81: { label: 'Rain Showers',               day: 'meteocons:rain-fill',                         night: 'meteocons:rain-fill' },
  82: { label: 'Heavy Rain Showers',          day: 'meteocons:rain-fill',                         night: 'meteocons:rain-fill' },
  85: { label: 'Snow Showers',               day: 'meteocons:partly-cloudy-day-snow-fill',       night: 'meteocons:partly-cloudy-night-snow-fill' },
  86: { label: 'Heavy Snow Showers',          day: 'meteocons:snow-fill',                         night: 'meteocons:snow-fill' },
  95: { label: 'Thunderstorm',               day: 'meteocons:thunderstorms-day-rain-fill',       night: 'meteocons:thunderstorms-night-rain-fill' },
  96: { label: 'Thunderstorm with Hail',     day: 'meteocons:thunderstorms-day-rain-fill',       night: 'meteocons:thunderstorms-night-rain-fill' },
  99: { label: 'Heavy Thunderstorm with Hail', day: 'meteocons:thunderstorms-rain-fill',          night: 'meteocons:thunderstorms-rain-fill' },
};

export function resolveWeatherCondition(code: number, isDay = true): WeatherCondition {
  const condition = weatherConditions[code];
  if (!condition) {
    throw new Error(`Unsupported weather code ${code}`);
  }
  return {
    label: condition.label,
    icon: isDay ? condition.day : condition.night
  };
}