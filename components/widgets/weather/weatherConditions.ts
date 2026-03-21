export interface WeatherCondition {
  label: string;
  icon: string;
}

export const weatherConditions: Record<number, WeatherCondition> = {
  // Clear
  0: { label: 'Clear', icon: 'meteocons:clear-day' },

  // Mostly Clear
  1: { label: 'Mostly Clear', icon: 'meteocons:mostly-clear-day' },

  // Partly Cloudy
  2: { label: 'Partly Cloudy', icon: 'meteocons:partly-cloudy-day' },

  // Overcast
  3: { label: 'Overcast', icon: 'meteocons:overcast' },

  // Fog
  45: { label: 'Fog', icon: 'meteocons:fog-day' },
  48: { label: 'Rime Fog', icon: 'meteocons:fog-day' },

  // Drizzle
  51: { label: 'Light Drizzle', icon: 'meteocons:drizzle' },
  53: { label: 'Drizzle', icon: 'meteocons:drizzle' },
  55: { label: 'Heavy Drizzle', icon: 'meteocons:partly-cloudy-day-drizzle' },

  // Freezing Drizzle
  56: { label: 'Light Freezing Drizzle', icon: 'meteocons:partly-cloudy-day-sleet' },
  57: { label: 'Freezing Drizzle', icon: 'meteocons:sleet' },

  // Rain
  61: { label: 'Light Rain', icon: 'meteocons:partly-cloudy-day-rain' },
  63: { label: 'Rain', icon: 'meteocons:rain' },
  65: { label: 'Heavy Rain', icon: 'meteocons:rain' },

  // Freezing Rain
  66: { label: 'Light Freezing Rain', icon: 'meteocons:sleet' },
  67: { label: 'Heavy Freezing Rain', icon: 'meteocons:sleet' },

  // Snow
  71: { label: 'Light Snow', icon: 'meteocons:partly-cloudy-day-snow' },
  73: { label: 'Snow', icon: 'meteocons:snow' },
  75: { label: 'Heavy Snow', icon: 'meteocons:snow' },
  77: { label: 'Snow Grains', icon: 'meteocons:snow' },

  // Rain Showers
  80: { label: 'Light Rain Showers', icon: 'meteocons:partly-cloudy-day-rain' },
  81: { label: 'Rain Showers', icon: 'meteocons:rain' },
  82: { label: 'Heavy Rain Showers', icon: 'meteocons:rain' },

  // Snow Showers
  85: { label: 'Snow Showers', icon: 'meteocons:partly-cloudy-day-snow' },
  86: { label: 'Heavy Snow Showers', icon: 'meteocons:snow' },

  // Thunderstorms
  95: { label: 'Thunderstorm', icon: 'meteocons:thunderstorms-day-rain' },
  96: { label: 'Thunderstorm with Hail', icon: 'meteocons:thunderstorms-day-rain' },
  99: { label: 'Heavy Thunderstorm with Hail', icon: 'meteocons:thunderstorms-rain' },
};

export function resolveWeatherCondition(code: number): WeatherCondition {
  const condition = weatherConditions[code];
  if (!condition) {
    throw new Error(`Unsupported weather code ${code}`);
  }
  return condition;
}