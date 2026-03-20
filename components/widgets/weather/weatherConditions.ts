import type { WeatherCondition } from './types';

export const weatherConditions: Record<number, WeatherCondition> = {
  0: { label: 'Clear', icon: 'ph:sun-bold', accent: '#ffb648', glow: 'rgba(255, 182, 72, 0.34)' },
  1: {
    label: 'Mostly Clear',
    icon: 'ph:sun-horizon-bold',
    accent: '#ffc56b',
    glow: 'rgba(255, 197, 107, 0.32)'
  },
  2: {
    label: 'Partly Cloudy',
    icon: 'ph:cloud-sun-bold',
    accent: '#9fd3ff',
    glow: 'rgba(159, 211, 255, 0.3)'
  },
  3: {
    label: 'Overcast',
    icon: 'ph:cloud-bold',
    accent: '#c7d0df',
    glow: 'rgba(199, 208, 223, 0.28)'
  },
  45: {
    label: 'Fog',
    icon: 'ph:cloud-fog-bold',
    accent: '#c8d2e3',
    glow: 'rgba(200, 210, 227, 0.28)'
  },
  48: {
    label: 'Fog',
    icon: 'ph:cloud-fog-bold',
    accent: '#c8d2e3',
    glow: 'rgba(200, 210, 227, 0.28)'
  },
  51: {
    label: 'Drizzle',
    icon: 'ph:cloud-drizzle-bold',
    accent: '#7cc8ff',
    glow: 'rgba(124, 200, 255, 0.3)'
  },
  53: {
    label: 'Drizzle',
    icon: 'ph:cloud-drizzle-bold',
    accent: '#7cc8ff',
    glow: 'rgba(124, 200, 255, 0.3)'
  },
  55: {
    label: 'Heavy Drizzle',
    icon: 'ph:cloud-rain-bold',
    accent: '#69b7ff',
    glow: 'rgba(105, 183, 255, 0.32)'
  },
  61: {
    label: 'Rain',
    icon: 'ph:cloud-rain-bold',
    accent: '#74b7ff',
    glow: 'rgba(116, 183, 255, 0.32)'
  },
  63: {
    label: 'Rain',
    icon: 'ph:cloud-rain-bold',
    accent: '#74b7ff',
    glow: 'rgba(116, 183, 255, 0.32)'
  },
  65: {
    label: 'Heavy Rain',
    icon: 'ph:cloud-rain-bold',
    accent: '#5ca2ff',
    glow: 'rgba(92, 162, 255, 0.34)'
  },
  80: {
    label: 'Rain Showers',
    icon: 'ph:cloud-rain-bold',
    accent: '#74b7ff',
    glow: 'rgba(116, 183, 255, 0.32)'
  },
  81: {
    label: 'Rain Showers',
    icon: 'ph:cloud-rain-bold',
    accent: '#74b7ff',
    glow: 'rgba(116, 183, 255, 0.32)'
  },
  82: {
    label: 'Heavy Showers',
    icon: 'ph:cloud-rain-bold',
    accent: '#5ca2ff',
    glow: 'rgba(92, 162, 255, 0.34)'
  },
  71: {
    label: 'Snow',
    icon: 'ph:snowflake-bold',
    accent: '#d4ecff',
    glow: 'rgba(212, 236, 255, 0.32)'
  },
  73: {
    label: 'Snow',
    icon: 'ph:snowflake-bold',
    accent: '#d4ecff',
    glow: 'rgba(212, 236, 255, 0.32)'
  },
  75: {
    label: 'Heavy Snow',
    icon: 'ph:snowflake-bold',
    accent: '#d4ecff',
    glow: 'rgba(212, 236, 255, 0.32)'
  },
  85: {
    label: 'Snow Showers',
    icon: 'ph:snowflake-bold',
    accent: '#d4ecff',
    glow: 'rgba(212, 236, 255, 0.32)'
  },
  86: {
    label: 'Heavy Snow',
    icon: 'ph:snowflake-bold',
    accent: '#d4ecff',
    glow: 'rgba(212, 236, 255, 0.32)'
  },
  95: {
    label: 'Storm',
    icon: 'ph:cloud-lightning-bold',
    accent: '#cab0ff',
    glow: 'rgba(202, 176, 255, 0.34)'
  },
  96: {
    label: 'Storm',
    icon: 'ph:cloud-lightning-bold',
    accent: '#cab0ff',
    glow: 'rgba(202, 176, 255, 0.34)'
  },
  99: {
    label: 'Storm',
    icon: 'ph:cloud-lightning-bold',
    accent: '#cab0ff',
    glow: 'rgba(202, 176, 255, 0.34)'
  }
};

export function resolveWeatherCondition(code: number): WeatherCondition {
  const condition = weatherConditions[code];
  if (!condition) {
    throw new Error(`Unsupported weather code ${code}`);
  }
  return condition;
}
