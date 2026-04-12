type RgbColor = [number, number, number];

type PaletteName =
  | 'sunset-clear'
  | 'sunrise-clear'
  | 'midday-clear'
  | 'cloudy'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'night';

export type HomeWeatherGradientInput = {
  weatherCode: number;
  cloudCover: number;
  temperature: number;
  currentTime: string;
  sunrise: string;
  sunset: string;
  isDay: boolean;
};

export type HomeWeatherGradientTheme = {
  background: string;
  border: string;
  brand: string;
  detailBackground: string;
  detailBorder: string;
  mutedText: string;
  shadow: string;
  text: string;
};

const paletteStops: Record<PaletteName, [RgbColor, RgbColor, RgbColor]> = {
  'sunset-clear': [
    [232, 79, 60],
    [255, 173, 81],
    [194, 192, 225]
  ],
  'sunrise-clear': [
    [247, 128, 95],
    [255, 205, 148],
    [170, 198, 241]
  ],
  'midday-clear': [
    [88, 182, 255],
    [213, 234, 255],
    [250, 224, 122]
  ],
  cloudy: [
    [110, 129, 167],
    [197, 205, 222],
    [226, 206, 194]
  ],
  rain: [
    [44, 56, 79],
    [84, 104, 136],
    [93, 140, 144]
  ],
  storm: [
    [24, 29, 43],
    [69, 80, 109],
    [69, 99, 122]
  ],
  snow: [
    [154, 173, 201],
    [231, 238, 249],
    [190, 209, 238]
  ],
  night: [
    [14, 20, 34],
    [37, 52, 84],
    [78, 101, 146]
  ]
};

export function buildHomeWeatherGradient(
  input: HomeWeatherGradientInput
): HomeWeatherGradientTheme {
  const paletteName = pickPalette(input);
  const cloudFactor = clamp(input.cloudCover / 100, 0, 1);
  const warmthFactor = clamp((input.temperature - 10) / 22, 0, 1);
  const washColor: RgbColor = input.isDay ? [236, 232, 231] : [116, 126, 153];
  const warmthColor: RgbColor = [255, 167, 96];

  const palette = paletteStops[paletteName]
    .map((color, index) => mix(color, washColor, cloudFactor * (index === 1 ? 0.18 : 0.3)))
    .map((color, index) => mix(color, warmthColor, warmthFactor * (index === 2 ? 0.14 : 0.08))) as [
    RgbColor,
    RgbColor,
    RgbColor
  ];

  const text = input.isDay ? [24, 24, 28] : [245, 247, 251];
  const mutedText = input.isDay ? [57, 57, 64] : [220, 226, 236];
  const brand = paletteName === 'storm' || paletteName === 'night'
    ? [255, 189, 128]
    : [241, 116, 31];
  const detailBackground = input.isDay
    ? [255, 255, 255]
    : mix(palette[0], [255, 255, 255], 0.12);
  const detailBorder = input.isDay
    ? mix(palette[1], [255, 255, 255], 0.48)
    : mix(palette[2], [255, 255, 255], 0.28);
  const shadow = input.isDay
    ? `0 28px 80px ${rgba(mix(palette[0], [0, 0, 0], 0.55), 0.18)}`
    : `0 28px 80px ${rgba(mix(palette[0], [0, 0, 0], 0.45), 0.34)}`;

  return {
    background: [
      `radial-gradient(circle at 16% 18%, ${rgba(mix(palette[1], [255, 255, 255], 0.18), 0.9)} 0%, transparent 34%)`,
      `radial-gradient(circle at 82% 22%, ${rgba(mix(palette[2], [255, 255, 255], 0.1), 0.78)} 0%, transparent 28%)`,
      `linear-gradient(135deg, ${rgb(palette[0])} 0%, ${rgb(palette[1])} 52%, ${rgb(palette[2])} 100%)`
    ].join(', '),
    border: rgba(mix(palette[1], [255, 255, 255], 0.56), input.isDay ? 0.56 : 0.28),
    brand: rgb(brand),
    detailBackground: rgba(detailBackground, input.isDay ? 0.38 : 0.18),
    detailBorder: rgba(detailBorder, input.isDay ? 0.54 : 0.22),
    mutedText: rgba(mutedText, 0.78),
    shadow,
    text: rgb(text)
  };
}

function pickPalette(input: HomeWeatherGradientInput): PaletteName {
  const currentTimeMs = parseTime(input.currentTime);
  const sunriseMs = parseTime(input.sunrise);
  const sunsetMs = parseTime(input.sunset);
  const nearSunrise = Math.abs(currentTimeMs - sunriseMs) <= 75 * 60 * 1000;
  const nearSunset = Math.abs(currentTimeMs - sunsetMs) <= 100 * 60 * 1000;
  const weatherCode = input.weatherCode;

  if ([95, 96, 99].includes(weatherCode)) return 'storm';
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return 'snow';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    return nearSunset && input.isDay ? 'sunset-clear' : 'rain';
  }
  if ([2, 3, 45, 48].includes(weatherCode)) return 'cloudy';
  if (!input.isDay) return 'night';
  if (nearSunset) return 'sunset-clear';
  if (nearSunrise) return 'sunrise-clear';
  return 'midday-clear';
}

function parseTime(value: string) {
  const timeMs = new Date(value).getTime();
  if (!Number.isFinite(timeMs)) throw new Error(`Invalid weather time ${value}`);
  return timeMs;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function mix(source: RgbColor, target: RgbColor, amount: number): RgbColor {
  const factor = clamp(amount, 0, 1);
  return [
    Math.round(source[0] + (target[0] - source[0]) * factor),
    Math.round(source[1] + (target[1] - source[1]) * factor),
    Math.round(source[2] + (target[2] - source[2]) * factor)
  ];
}

function rgb(color: RgbColor) {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function rgba(color: RgbColor, alpha: number) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}
