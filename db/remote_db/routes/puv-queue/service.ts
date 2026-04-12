import type { D1Database } from '@cloudflare/workers-types';

import {
  getCachedDuration,
  getCachedWalkingDuration,
  upsertCachedDuration,
  upsertCachedWalkingDuration,
} from './cache';
import { resolveCalendarSignal } from './calendar';
import { resolveIncidentSignal } from './incidents';
import { computeQueueScore, getPeriodLabel, getRouteTimeParts, getTrafficLabel, scoreToLevel } from './logic';
import { buildConfidence, buildMessage, buildRecommendation, buildWaitEstimate } from './insights';
import { buildObservedWaitEstimate, resolveObservationSummary } from './observations';
import { defaultQueuePersonalization, normalizeQueuePersonalization } from './personalization';
import { RoutingError, fetchLiveDuration, fetchRoutePolyline, fetchWalkingDuration, fetchWalkingPolyline } from './routing';
import type {
  DegradedReason,
  PuvQueueEnv,
  QueueEstimate,
  QueuePersonalizationInput,
  QueueRouteComparison,
  QueueRouteComparisonEntry,
  QueueRouteConfig,
  RoutePolyline,
} from './types';
import { resolveWeatherSignal } from './weather';

type RoutingBindings = Pick<PuvQueueEnv['Bindings'], 'ORS_API_KEY' | 'OSRM_BASE_URL' | 'ROUTING_PROVIDER'>;
type QueueEstimateOptions = {
  includePolyline?: boolean;
  now?: Date;
  personalization?: QueuePersonalizationInput;
};

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

function getRoutingReason(error: unknown): DegradedReason {
  return error instanceof RoutingError ? error.code : 'routing_request_failed';
}

function getErrorDetail(error: unknown): string | null {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return null;
}

function getContextScoreDelta(
  weather: QueueEstimate['signals']['weather'],
  incidents: QueueEstimate['signals']['incidents'],
  observations: QueueEstimate['signals']['observations'],
): number {
  return weather.score_delta + incidents.score_delta + observations.score_delta;
}

function describeUnavailableRecommendation(degradedReason: DegradedReason | null): string {
  if (degradedReason === 'missing_routing_config') {
    return 'Walking comparison is unavailable because the routing service is not configured.'
  }

  if (degradedReason === 'routing_invalid_response') {
    return 'Walking comparison is unavailable because the routing service returned an invalid response.'
  }

  if (degradedReason === 'routing_request_failed') {
    return 'Live routing is unavailable right now, so ride time uses the historical baseline and walking comparison is unavailable.'
  }

  return "Can't compare walking right now — directions aren't available."
}

function getRecommendedTotalMinutes(estimate: QueueEstimate): number {
  return estimate.recommendation.personalization.recommended_total_minutes;
}

function compareRouteEntries(left: QueueRouteComparisonEntry, right: QueueRouteComparisonEntry): number {
  if (left.recommended_total_minutes !== right.recommended_total_minutes) {
    return left.recommended_total_minutes - right.recommended_total_minutes;
  }

  if (left.estimate.meta.degraded !== right.estimate.meta.degraded) {
    return left.estimate.meta.degraded ? 1 : -1;
  }

  if (left.estimate.score !== right.estimate.score) {
    return left.estimate.score - right.estimate.score;
  }

  return left.estimate.route.label.localeCompare(right.estimate.route.label);
}

export async function buildQueueEstimate(
  db: D1Database,
  routingBindings: RoutingBindings,
  route: QueueRouteConfig,
  options: QueueEstimateOptions = {},
): Promise<QueueEstimate> {
  const includePolyline = options.includePolyline === true;
  const now = options.now ?? new Date();
  const personalization = normalizeQueuePersonalization(options.personalization ?? defaultQueuePersonalization);
  const routeTime = getRouteTimeParts(now, route.timezone);
  const baseline = route.baseline_by_hour[routeTime.hour];
  const todBase = route.tod_score_by_hour[routeTime.hour];
  const [calendar, weather, incidents, observationSummary] = await Promise.all([
    resolveCalendarSignal(db, route, routeTime),
    resolveWeatherSignal(db, route),
    resolveIncidentSignal(db, route.route_key, now.toISOString()),
    resolveObservationSummary(db, route, routeTime),
  ]);
  const observations = observationSummary.signal;
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
    source = 'routing_cache';
    cacheHit = true;
    cacheAgeMs = cached.ageMs;
  } else {
    try {
      liveDuration = await fetchLiveDuration(routingBindings, route.origin, route.destination);
      source = 'routing_live';
      try {
        await upsertCachedDuration(db, route.route_key, liveDuration);
      } catch (error) {
        console.warn('[puv-queue] failed to cache live routing duration', {
          routeKey: route.route_key,
          detail: getErrorDetail(error),
        });
      }
    } catch (error) {
      degraded = true;
      degradedReason = getRoutingReason(error);
      console.warn('[puv-queue] using historical fallback', {
        routeKey: route.route_key,
        reason: degradedReason,
        detail: getErrorDetail(error),
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
      personalization: {
        ...personalization,
        added_minutes: personalization.access_minutes + personalization.egress_minutes,
        ride_total_minutes: personalization.access_minutes + personalization.egress_minutes,
        walk_total_minutes: null,
        walk_allowed: false,
        recommended_total_minutes: personalization.access_minutes + personalization.egress_minutes,
      },
    },
    computed_at: now.toISOString(),
    meta: {
      confidence: 'medium',
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
  const waitEstimate = buildObservedWaitEstimate(observationSummary.matched, {
    currentScore: score,
    fallback: buildWaitEstimate(score, level),
  });
  const walkDuration = await fetchWalkingComparison(db, routingBindings, route);
  const recommendation = buildRecommendation(waitEstimate, liveDuration, walkDuration, personalization);
  const confidence = buildConfidence({
    degraded,
    observations,
    source,
    weather,
  });
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

  if (recommendation.best_option === 'unavailable') {
    recommendation.message = describeUnavailableRecommendation(degradedReason);
  }

  estimate.level = level;
  estimate.score = score;
  estimate.wait_minutes_estimate = waitEstimate;
  estimate.message = message;
  estimate.recommendation = recommendation;
  estimate.meta.confidence = confidence;

  if (!includePolyline) {
    return estimate;
  }

  const [polyline, walkingPolyline] = await Promise.all([
    fetchRouteGeometry(() => fetchRoutePolyline(routingBindings, route.origin, route.destination)),
    fetchRouteGeometry(() => fetchWalkingPolyline(routingBindings, route.origin, route.destination)),
  ]);
  return { ...estimate, polyline, walking_polyline: walkingPolyline };
}

export async function buildQueueComparison(
  db: D1Database,
  routingBindings: RoutingBindings,
  routes: QueueRouteConfig[],
  personalizations: Record<string, QueuePersonalizationInput> = {},
): Promise<QueueRouteComparison> {
  const now = new Date();
  const comparisons = (await Promise.all(
    routes.map(async (route) => ({
      rank: 0,
      estimate: await buildQueueEstimate(db, routingBindings, route, {
        includePolyline: false,
        now,
        personalization: personalizations[route.route_key],
      }),
      recommended_total_minutes: 0,
    })),
  ))
    .map((entry) => ({
      ...entry,
      recommended_total_minutes: getRecommendedTotalMinutes(entry.estimate),
    }))
    .sort(compareRouteEntries)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

  return {
    computed_at: now.toISOString(),
    best_route_key: comparisons[0]?.estimate.route.route_key ?? null,
    route_count: comparisons.length,
    comparisons,
  };
}

async function fetchWalkingComparison(
  db: D1Database,
  routingBindings: RoutingBindings,
  route: QueueRouteConfig,
): Promise<number | null> {
  const cached = await getCachedWalkingDuration(db, route.route_key, route.cache_ttl_ms);

  if (cached) {
    return cached.durationSeconds;
  }

  try {
    const duration = await fetchWalkingDuration(routingBindings, route.origin, route.destination);
    try {
      await upsertCachedWalkingDuration(db, route.route_key, duration);
    } catch (error) {
      console.warn('[puv-queue] failed to cache walking comparison', {
        routeKey: route.route_key,
        detail: getErrorDetail(error),
      });
    }
    return duration;
  } catch (error) {
    const reason = getRoutingReason(error);
    console.warn('[puv-queue] walking comparison unavailable', {
      routeKey: route.route_key,
      origin: route.origin,
      destination: route.destination,
      reason,
      detail: getErrorDetail(error),
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
