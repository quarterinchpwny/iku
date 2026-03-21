import type { D1Database } from '@cloudflare/workers-types';

import { getCachedDuration, upsertCachedDuration } from './cache';
import { buildAdvice, computeQueueScore, getPeriodLabel, getRouteTimeParts, getTrafficLabel, scoreToLevel } from './logic';
import { OrsError, fetchLiveDuration, fetchRoutePolyline } from './ors';
import type { DegradedReason, PuvQueueEnv, QueueEstimate, QueueRouteConfig } from './types';

function summarizeRoute(route: QueueRouteConfig): QueueEstimate['route'] {
  return {
    route_key: route.route_key,
    label: route.label,
    origin: route.origin,
    destination: route.destination,
    timezone: route.timezone,
  };
}

function getDayMultiplier(isDayOff: boolean): number {
  return isDayOff ? 0.6 : 1;
}

function getOrsReason(error: unknown): DegradedReason {
  return error instanceof OrsError ? error.code : 'ors_request_failed';
}

export async function buildQueueEstimate(
  db: D1Database,
  apiKey: PuvQueueEnv['Bindings']['ORS_API_KEY'],
  route: QueueRouteConfig,
  includePolyline: boolean,
): Promise<QueueEstimate & { polyline?: [number, number][] | null }> {
  const now = new Date();
  const routeTime = getRouteTimeParts(now, route.timezone, route.holidays);
  const baseline = route.baseline_by_hour[routeTime.hour];
  const todBase = route.tod_score_by_hour[routeTime.hour];
  const isDayOff = routeTime.isWeekend || routeTime.isHoliday;
  const dayMultiplier = getDayMultiplier(isDayOff);

  let liveDuration = baseline;
  let source: QueueEstimate['signals']['traffic']['source'] = 'historical_fallback';
  let degraded = false;
  let degradedReason: DegradedReason | null = null;
  let cacheHit = false;
  let cacheAgeMs: number | null = null;

  const cached = await getCachedDuration(db, route.route_key, route.cache_ttl_ms);

  if (cached) {
    liveDuration = cached.durationSeconds;
    source = 'ors_cache';
    cacheHit = true;
    cacheAgeMs = cached.ageMs;
  } else {
    try {
      liveDuration = await fetchLiveDuration(apiKey, route.origin, route.destination);
      source = 'ors_live';
      await upsertCachedDuration(db, route.route_key, liveDuration);
    } catch (error) {
      degraded = true;
      degradedReason = getOrsReason(error);
      console.warn('[puv-queue] using historical fallback', {
        routeKey: route.route_key,
        reason: degradedReason,
      });
    }
  }

  const trafficRatio = liveDuration / baseline;
  const period = getPeriodLabel(routeTime.hour);
  const score = computeQueueScore(todBase, trafficRatio, dayMultiplier);
  const level = scoreToLevel(score);
  const estimate: QueueEstimate = {
    route: summarizeRoute(route),
    level,
    score,
    signals: {
      time_of_day: {
        hour: routeTime.hour,
        period,
        base_score: todBase,
      },
      traffic: {
        source,
        duration_seconds: Math.round(liveDuration),
        baseline_seconds: baseline,
        ratio: Math.round(trafficRatio * 100) / 100,
        label: getTrafficLabel(trafficRatio),
      },
      day_type: {
        is_weekend: routeTime.isWeekend,
        is_holiday: routeTime.isHoliday,
        multiplier: dayMultiplier,
      },
    },
    advice: buildAdvice(level, period, isDayOff, degraded),
    computed_at: now.toISOString(),
    meta: {
      degraded,
      degraded_reason: degradedReason,
      cache: {
        hit: cacheHit,
        age_ms: cacheAgeMs,
        ttl_ms: route.cache_ttl_ms,
      },
    },
  };

  if (!includePolyline) {
    return estimate;
  }

  const polyline = await fetchRoutePolyline(apiKey, route.origin, route.destination);
  return { ...estimate, polyline };
}

export function buildHeatmap(route: QueueRouteConfig): {
  route: QueueEstimate['route'];
  heatmap: Array<{
    hour: number;
    period: string;
    score: number;
    level: QueueEstimate['level'];
    baseline_seconds: number;
  }>;
} {
  const routeTime = getRouteTimeParts(new Date(), route.timezone, route.holidays);
  const isDayOff = routeTime.isWeekend || routeTime.isHoliday;
  const dayMultiplier = getDayMultiplier(isDayOff);

  return {
    route: summarizeRoute(route),
    heatmap: Array.from({ length: 24 }, (_, hour) => {
      const base = route.tod_score_by_hour[hour];
      const score = computeQueueScore(base, 1, dayMultiplier);
      return {
        hour,
        period: getPeriodLabel(hour),
        score,
        level: scoreToLevel(score),
        baseline_seconds: route.baseline_by_hour[hour],
      };
    }),
  };
}
