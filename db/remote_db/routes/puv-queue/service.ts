import type { D1Database } from '@cloudflare/workers-types';

import { getCachedDuration, upsertCachedDuration } from './cache';
import { resolveCalendarSignal } from './calendar';
import { resolveIncidentSignal } from './incidents';
import { computeQueueScore, getPeriodLabel, getRouteTimeParts, getTrafficLabel, scoreToLevel } from './logic';
import { buildMessage, buildRecommendation, buildWaitEstimate } from './insights';
import { resolveObservationSignal } from './observations';
import { OrsError, fetchLiveDuration, fetchRoutePolyline, fetchWalkingDuration, fetchWalkingPolyline } from './ors';
import type { DegradedReason, PuvQueueEnv, QueueEstimate, QueueRouteConfig, RoutePolyline } from './types';
import { resolveWeatherSignal } from './weather';

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

function getContextScoreDelta(
  weather: QueueEstimate['signals']['weather'],
  incidents: QueueEstimate['signals']['incidents'],
  observations: QueueEstimate['signals']['observations'],
): number {
  return weather.score_delta + incidents.score_delta + observations.score_delta;
}

export async function buildQueueEstimate(
  db: D1Database,
  apiKey: PuvQueueEnv['Bindings']['ORS_API_KEY'],
  route: QueueRouteConfig,
  includePolyline: boolean,
): Promise<QueueEstimate> {
  const now = new Date();
  const routeTime = getRouteTimeParts(now, route.timezone);
  const baseline = route.baseline_by_hour[routeTime.hour];
  const todBase = route.tod_score_by_hour[routeTime.hour];
  const [calendar, weather, incidents, observations] = await Promise.all([
    resolveCalendarSignal(db, route, routeTime),
    resolveWeatherSignal(db, route),
    resolveIncidentSignal(db, route.route_key, now.toISOString()),
    resolveObservationSignal(db, route, routeTime.hour),
  ]);
  const isDayOff = routeTime.isWeekend || calendar.is_holiday;
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
  const estimate: QueueEstimate = {
    route: summarizeRoute(route),
    level: 'low',
    score: 0,
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
        is_holiday: calendar.is_holiday,
        multiplier: dayMultiplier,
      },
      weather,
      calendar,
      incidents,
      observations,
    },
    wait_minutes_estimate: { min_minutes: 0, likely_minutes: 0, max_minutes: 0 },
    message: {
      headline: '',
      reason: '',
      action: '',
      confidence_note: '',
    },
    recommendation: {
      best_option: 'unavailable',
      ride_wait_minutes: 0,
      ride_in_vehicle_minutes: 0,
      ride_total_minutes: 0,
      walk_total_minutes: null,
      time_saved_minutes: null,
      message: '',
    },
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
  const score = computeQueueScore(todBase, trafficRatio, dayMultiplier, getContextScoreDelta(weather, incidents, observations));
  const level = scoreToLevel(score);
  const waitEstimate = buildWaitEstimate(score, level);
  const walkDuration = await fetchWalkingComparison(apiKey, route.origin, route.destination);
  const recommendation = buildRecommendation(waitEstimate, liveDuration, walkDuration);
  const message = buildMessage({
    cacheAgeMs,
    calendar,
    degraded,
    incidents,
    level,
    observations,
    period,
    recommendation,
    source,
    trafficRatio,
    waitEstimate,
    weather,
  });
  estimate.level = level;
  estimate.score = score;
  estimate.wait_minutes_estimate = waitEstimate;
  estimate.message = message;
  estimate.recommendation = recommendation;

  if (!includePolyline) {
    return estimate;
  }

  const [polyline, walkingPolyline] = await Promise.all([
    fetchRouteGeometry(() => fetchRoutePolyline(apiKey, route.origin, route.destination)),
    fetchRouteGeometry(() => fetchWalkingPolyline(apiKey, route.origin, route.destination)),
  ]);
  return { ...estimate, polyline, walking_polyline: walkingPolyline };
}

async function fetchWalkingComparison(
  apiKey: PuvQueueEnv['Bindings']['ORS_API_KEY'],
  origin: QueueRouteConfig['origin'],
  destination: QueueRouteConfig['destination'],
): Promise<number | null> {
  try {
    return await fetchWalkingDuration(apiKey, origin, destination);
  } catch (error) {
    const reason = getOrsReason(error);
    console.warn('[puv-queue] walking comparison unavailable', {
      origin,
      destination,
      reason,
    });
    return null;
  }
}

async function fetchRouteGeometry(fetcher: () => Promise<RoutePolyline | null>): Promise<RoutePolyline | null> {
  try {
    return await fetcher();
  } catch {
    return null;
  }
}

export async function buildHeatmap(db: D1Database, route: QueueRouteConfig): Promise<{
  route: QueueEstimate['route'];
  heatmap: Array<{
    hour: number;
    period: string;
    score: number;
    level: QueueEstimate['level'];
    baseline_seconds: number;
  }>;
}> {
  const routeTime = getRouteTimeParts(new Date(), route.timezone);
  const calendar = await resolveCalendarSignal(db, route, routeTime);
  const isDayOff = routeTime.isWeekend || calendar.is_holiday;
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
