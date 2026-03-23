import type { QueueLevel, TrafficSignal } from './types';

export type RouteTimeParts = {
  hour: number;
  isoDate: string;
  monthDay: string;
  isWeekend: boolean;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  });

  formatterCache.set(timeZone, formatter);
  return formatter;
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

export function matchesHoliday(isoDate: string, monthDay: string, holidays: string[]): boolean {
  return holidays.some((holiday) => holiday === monthDay || holiday === isoDate);
}

export function getRouteTimeParts(now: Date, timeZone: string): RouteTimeParts {
  const parts = getFormatter(timeZone).formatToParts(now);
  const hour = Number(getPart(parts, 'hour'));
  const year = getPart(parts, 'year');
  const month = getPart(parts, 'month');
  const day = getPart(parts, 'day');
  const weekday = getPart(parts, 'weekday');
  const isoDate = `${year}-${month}-${day}`;
  const monthDay = `${month}-${day}`;

  return {
    hour: Number.isFinite(hour) ? hour : now.getUTCHours(),
    isoDate,
    monthDay,
    isWeekend: weekday === 'Sat' || weekday === 'Sun',
  };
}

export function getPeriodLabel(hour: number): string {
  if (hour >= 5 && hour < 7) return 'early morning';
  if (hour >= 7 && hour < 10) return 'morning rush';
  if (hour >= 10 && hour < 12) return 'late morning';
  if (hour >= 12 && hour < 14) return 'lunch';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening rush';
  if (hour >= 20 && hour < 23) return 'night';
  return 'late night';
}

export function getTrafficLabel(ratio: number): TrafficSignal['label'] {
  if (ratio >= 1.5) return 'heavy';
  if (ratio >= 1.2) return 'moderate';
  return 'light';
}

export function computeQueueScore(
  todBase: number,
  trafficRatio: number,
  dayMultiplier: number,
  scoreDelta = 0,
): number {
  const raw = todBase * trafficRatio * dayMultiplier + scoreDelta;
  return Math.max(0, Math.min(Math.round(raw * 10) / 10, 10));
}

export function scoreToLevel(score: number): QueueLevel {
  if (score <= 2.5) return 'low';
  if (score <= 4.5) return 'moderate';
  if (score <= 7) return 'high';
  return 'very_high';
}
