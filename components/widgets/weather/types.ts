export type WeatherCondition = {
  label: string;
  icon: string;
  accent: string;
  glow: string;
};

export type WeatherResponse = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    precipitation_probability?: number;
    wind_speed_10m?: number;
    weather_code?: number;
    time?: string;
    is_day?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    weather_code?: number[];
    precipitation_probability?: number[];
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    uv_index_max?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
};

export type ForecastDay = {
  dayLabel: string;
  fullLabel: string;
  icon: string;
  condition: string;
  high: string;
  low: string;
  active?: boolean;
};

export type ForecastHour = {
  label: string;
  temperature: string;
  probability: number;
  icon: string;
  condition: string;
};

export type WeatherCity = {
  id: string;
  region: string;
  name: string;
  temperature: string;
  condition: string;
  icon: string;
};
