import type { D1Database } from '@cloudflare/workers-types';

import { getRouteTimeParts } from './logic';
import type { ObservationSignal, QueueLevel, QueueObservation, QueueRouteConfig } from './types';

const OBSERVATION_LOOKBACK_MS = 60 * 24 * 60 * 60 * 1000;
const OBSERVATION_MATCH_WINDOW_HOURS = 1;

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
  hour: number,
): Promise<ObservationSignal> {
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

  const matching = (results ?? [])
    .map(mapObservation)
    .filter((observation) => {
      const observationHour = getRouteTimeParts(new Date(observation.observed_at), route.timezone).hour;
      return hourDistance(observationHour, hour) <= OBSERVATION_MATCH_WINDOW_HOURS;
    });

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
