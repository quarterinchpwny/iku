import type { D1Database } from '@cloudflare/workers-types';

import { isRouteHoliday, listKnownHolidayDates } from './calendar';
import { getRouteTimeParts, type RouteTimeParts } from './logic';
import type { ObservationSignal, QueueLevel, QueueObservation, QueueRouteConfig, QueueWaitEstimate } from './types';

const OBSERVATION_LOOKBACK_MS = 60 * 24 * 60 * 60 * 1000;
const OBSERVATION_MATCH_WINDOW_HOURS = 1;

type WaitEstimateInput = {
  currentScore: number;
  fallback: QueueWaitEstimate;
};

type ObservationRow = {
  id: number;
  route_key: string;
  observed_at: number;
  queue_level: QueueLevel | null;
  wait_minutes: number | null;
  observed_score: number;
  notes: string;
  created_at: number;
};

type QueueObservationInput = Omit<QueueObservation, 'id' | 'created_at'>;

export type MatchedObservation = QueueObservation & {
  observation_hour: number;
  hour_distance: number;
  day_type_match: boolean;
  weekday_match: boolean;
  holiday_match: boolean;
};

export type ObservationSummary = {
  signal: ObservationSignal;
  matched: MatchedObservation[];
};

function mapObservation(row: ObservationRow): QueueObservation {
  return {
    id: row.id,
    route_key: row.route_key,
    observed_at: row.observed_at,
    queue_level: row.queue_level,
    wait_minutes: row.wait_minutes,
    observed_score: row.observed_score,
    notes: row.notes,
    created_at: row.created_at,
  };
}

function hourDistance(left: number, right: number): number {
  const delta = Math.abs(left - right);
  return Math.min(delta, 24 - delta);
}

function clampObservationDelta(value: number): number {
  return Math.max(-1.5, Math.min(Math.round(value * 10) / 10, 1.5));
}

function clampWaitMinutes(value: number): number {
  return Math.max(0, Math.min(Math.round(value), 180));
}

function interpolate(left: number, right: number, progress: number): number {
  return left + (right - left) * progress;
}

function getObservationWeight(observation: MatchedObservation): number {
  const ageDays = Math.max(0, (Date.now() - observation.observed_at) / (24 * 60 * 60 * 1000));
  const recencyWeight = ageDays <= 7
    ? 1
    : ageDays <= 21
      ? 0.85
      : ageDays <= 45
      ? 0.7
        : 0.55;
  const hourWeight = observation.hour_distance === 0 ? 1 : 0.8;
  const dayTypeWeight = observation.day_type_match ? 1 : 0.55;
  const weekdayWeight = observation.weekday_match ? 1 : observation.day_type_match ? 0.8 : 1;
  const holidayWeight = observation.holiday_match ? 1 : 0.35;
  return recencyWeight * hourWeight * dayTypeWeight * weekdayWeight * holidayWeight;
}

function weightedAverage(values: Array<{ value: number; weight: number }>): number | null {
  const totalWeight = values.reduce((total, entry) => total + entry.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }

  const weightedTotal = values.reduce((total, entry) => total + entry.value * entry.weight, 0);
  return weightedTotal / totalWeight;
}

function weightedQuantile(values: Array<{ value: number; weight: number }>, quantile: number): number | null {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left.value - right.value);
  const totalWeight = sorted.reduce((total, entry) => total + entry.weight, 0);

  if (totalWeight <= 0) {
    return null;
  }

  const threshold = totalWeight * Math.max(0, Math.min(1, quantile));
  let cumulativeWeight = 0;

  for (const entry of sorted) {
    cumulativeWeight += entry.weight;
    if (cumulativeWeight >= threshold) {
      return entry.value;
    }
  }

  return sorted[sorted.length - 1]?.value ?? null;
}

function toMatchedObservations(
  route: QueueRouteConfig,
  routeTime: RouteTimeParts,
  holidayDates: Set<string>,
  observations: QueueObservation[],
): MatchedObservation[] {
  const currentIsHoliday = isRouteHoliday(route, routeTime, holidayDates);

  return observations
    .map((observation) => {
      const observationTime = getRouteTimeParts(new Date(observation.observed_at), route.timezone);
      const observationIsHoliday = isRouteHoliday(route, observationTime, holidayDates);
      const observationHour = observationTime.hour;
      const distance = hourDistance(observationHour, routeTime.hour);

      return {
        ...observation,
        observation_hour: observationHour,
        hour_distance: distance,
        day_type_match: observationTime.isWeekend === routeTime.isWeekend,
        weekday_match: observationTime.weekday === routeTime.weekday,
        holiday_match: observationIsHoliday === currentIsHoliday,
      };
    })
    .filter((observation) => observation.hour_distance <= OBSERVATION_MATCH_WINDOW_HOURS);
}

function buildObservationSignal(route: QueueRouteConfig, hour: number, matching: MatchedObservation[]): ObservationSignal {
  if (matching.length < 3) {
    return {
      score_delta: 0,
      sample_count: matching.length,
      average_score: matching.length
        ? Math.round((matching.reduce((total, observation) => total + observation.observed_score, 0) / matching.length) * 10) / 10
        : null,
      last_observed_at: matching[0] ? new Date(matching[0].observed_at).toISOString() : null,
    };
  }

  const averageScore =
    Math.round((matching.reduce((total, observation) => total + observation.observed_score, 0) / matching.length) * 10) / 10;
  const baselineScore = route.tod_score_by_hour[hour];
  const scoreDelta = clampObservationDelta((averageScore - baselineScore) * 0.35);

  return {
    score_delta: scoreDelta,
    sample_count: matching.length,
    average_score: averageScore,
    last_observed_at: new Date(matching[0].observed_at).toISOString(),
  };
}

function getObservationBlendWeight(sampleCount: number): number {
  if (sampleCount >= 8) return 0.85;
  if (sampleCount >= 5) return 0.7;
  if (sampleCount >= 3) return 0.55;
  if (sampleCount >= 2) return 0.35;
  return 0.2;
}

function normalizeWaitEstimate(estimate: QueueWaitEstimate): QueueWaitEstimate {
  const min = clampWaitMinutes(estimate.min_minutes);
  const likely = clampWaitMinutes(Math.max(min, estimate.likely_minutes));
  const max = clampWaitMinutes(Math.max(likely, estimate.max_minutes));

  return {
    min_minutes: min,
    likely_minutes: likely,
    max_minutes: max,
  };
}

export function buildObservedWaitEstimate(
  matching: MatchedObservation[],
  input: WaitEstimateInput,
): QueueWaitEstimate {
  const waitSamples = matching
    .filter((observation): observation is MatchedObservation & { wait_minutes: number } => typeof observation.wait_minutes === 'number')
    .map((observation) => ({
      waitMinutes: observation.wait_minutes,
      observedScore: observation.observed_score,
      weight: getObservationWeight(observation),
    }));

  if (!waitSamples.length) {
    return input.fallback;
  }

  const weightedWaits = waitSamples.map((sample) => ({
    value: sample.waitMinutes,
    weight: sample.weight,
  }));
  const observedScore = weightedAverage(waitSamples.map((sample) => ({
    value: sample.observedScore,
    weight: sample.weight,
  })));

  if (observedScore == null) {
    return input.fallback;
  }

  const scoreShiftMinutes = Math.max(-12, Math.min(12, (input.currentScore - observedScore) * 3));
  const observedEstimate = normalizeWaitEstimate({
    min_minutes: (weightedQuantile(weightedWaits, 0.2) ?? input.fallback.min_minutes) + scoreShiftMinutes,
    likely_minutes: (weightedQuantile(weightedWaits, 0.5) ?? input.fallback.likely_minutes) + scoreShiftMinutes,
    max_minutes: (weightedQuantile(weightedWaits, 0.8) ?? input.fallback.max_minutes) + scoreShiftMinutes,
  });
  const blendWeight = getObservationBlendWeight(waitSamples.length);

  return normalizeWaitEstimate({
    min_minutes: interpolate(input.fallback.min_minutes, observedEstimate.min_minutes, blendWeight),
    likely_minutes: interpolate(input.fallback.likely_minutes, observedEstimate.likely_minutes, blendWeight),
    max_minutes: interpolate(input.fallback.max_minutes, observedEstimate.max_minutes, blendWeight),
  });
}

export async function listRouteObservations(
  db: D1Database,
  routeKey: string,
  limit = 20,
): Promise<QueueObservation[]> {
  const { results } = await db
    .prepare(
      `SELECT *
       FROM puv_queue_observations
       WHERE route_key = ?
       ORDER BY observed_at DESC
       LIMIT ?`,
    )
    .bind(routeKey, Math.max(1, Math.min(limit, 100)))
    .all<ObservationRow>();

  return (results ?? []).map(mapObservation);
}

export async function createObservation(
  db: D1Database,
  input: QueueObservationInput,
): Promise<QueueObservation> {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO puv_queue_observations (
         route_key,
         observed_at,
         queue_level,
         wait_minutes,
         observed_score,
         notes,
         created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.route_key,
      input.observed_at,
      input.queue_level,
      input.wait_minutes,
      input.observed_score,
      input.notes,
      now,
    )
    .run();

  const row = await db.prepare('SELECT * FROM puv_queue_observations ORDER BY id DESC LIMIT 1').first<ObservationRow>();
  if (!row) {
    throw new Error('Failed to create observation');
  }

  return mapObservation(row);
}

export async function deleteObservation(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare('DELETE FROM puv_queue_observations WHERE id = ?').bind(id).run();
  return Number(result.meta.changes ?? 0) > 0;
}

export async function resolveObservationSignal(
  db: D1Database,
  route: QueueRouteConfig,
  routeTime: RouteTimeParts,
): Promise<ObservationSignal> {
  const summary = await resolveObservationSummary(db, route, routeTime);
  return summary.signal;
}

export async function resolveObservationSummary(
  db: D1Database,
  route: QueueRouteConfig,
  routeTime: RouteTimeParts,
): Promise<ObservationSummary> {
  const { results } = await db
    .prepare(
      `SELECT *
       FROM puv_queue_observations
       WHERE route_key = ?
         AND observed_at >= ?
       ORDER BY observed_at DESC
       LIMIT 120`,
    )
    .bind(route.route_key, Date.now() - OBSERVATION_LOOKBACK_MS)
    .all<ObservationRow>();

  const observations = (results ?? []).map(mapObservation);
  const observationTimes = observations.map((observation) => getRouteTimeParts(new Date(observation.observed_at), route.timezone));
  const holidayDates = await listKnownHolidayDates(db, [routeTime.isoDate, ...observationTimes.map((value) => value.isoDate)]);
  const matching = toMatchedObservations(route, routeTime, holidayDates, observations);

  return {
    signal: buildObservationSignal(route, routeTime.hour, matching),
    matched: matching,
  };
}
