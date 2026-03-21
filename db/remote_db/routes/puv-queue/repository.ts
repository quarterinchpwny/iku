import type { D1Database } from '@cloudflare/workers-types';

import type { Coordinate, QueueRouteConfig, QueueRouteSummary } from './types';

type QueueRouteRow = {
  route_key: string;
  label: string;
  origin_lng: number;
  origin_lat: number;
  destination_lng: number;
  destination_lat: number;
  timezone: string;
  cache_ttl_ms: number;
  baseline_by_hour_json: string;
  tod_score_by_hour_json: string;
  holidays_json: string;
  is_active: number;
  is_default: number;
  created_at: number;
  updated_at: number;
};

type QueueRouteInput = Omit<QueueRouteConfig, 'created_at' | 'updated_at'>;

function parseNumberArray(value: string, fieldName: string): number[] {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length !== 24 || parsed.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry))) {
    throw new Error(`Invalid ${fieldName} in puv_queue_routes`);
  }
  return parsed;
}

function parseStringArray(value: string, fieldName: string): string[] {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) {
    throw new Error(`Invalid ${fieldName} in puv_queue_routes`);
  }
  return parsed;
}

function asCoordinate(lng: number, lat: number): Coordinate {
  return [lng, lat];
}

function mapRow(row: QueueRouteRow): QueueRouteConfig {
  return {
    route_key: row.route_key,
    label: row.label,
    origin: asCoordinate(row.origin_lng, row.origin_lat),
    destination: asCoordinate(row.destination_lng, row.destination_lat),
    timezone: row.timezone,
    cache_ttl_ms: row.cache_ttl_ms,
    baseline_by_hour: parseNumberArray(row.baseline_by_hour_json, 'baseline_by_hour_json'),
    tod_score_by_hour: parseNumberArray(row.tod_score_by_hour_json, 'tod_score_by_hour_json'),
    holidays: parseStringArray(row.holidays_json, 'holidays_json'),
    is_active: row.is_active === 1,
    is_default: row.is_default === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toStoredJson(value: unknown): string {
  return JSON.stringify(value);
}

function toSummary(route: QueueRouteConfig): QueueRouteSummary {
  return {
    route_key: route.route_key,
    label: route.label,
    timezone: route.timezone,
    is_active: route.is_active,
    is_default: route.is_default,
    updated_at: route.updated_at,
    origin: route.origin,
    destination: route.destination,
  };
}

export async function listQueueRoutes(db: D1Database, activeOnly = true): Promise<QueueRouteSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT *
       FROM puv_queue_routes
       ${activeOnly ? 'WHERE is_active = 1' : ''}
       ORDER BY is_default DESC, route_key ASC`,
    )
    .all<QueueRouteRow>();

  return (results ?? []).map(mapRow).map(toSummary);
}

export async function getQueueRoute(db: D1Database, routeKey: string): Promise<QueueRouteConfig | null> {
  const row = await db
    .prepare('SELECT * FROM puv_queue_routes WHERE route_key = ? LIMIT 1')
    .bind(routeKey)
    .first<QueueRouteRow>();

  return row ? mapRow(row) : null;
}

export async function getDefaultQueueRoute(db: D1Database): Promise<QueueRouteConfig | null> {
  const row = await db
    .prepare('SELECT * FROM puv_queue_routes WHERE is_active = 1 AND is_default = 1 LIMIT 1')
    .first<QueueRouteRow>();

  return row ? mapRow(row) : null;
}

export async function saveQueueRoute(db: D1Database, input: QueueRouteInput): Promise<QueueRouteConfig> {
  const now = Date.now();

  if (input.is_default) {
    await db
      .prepare('UPDATE puv_queue_routes SET is_default = 0, updated_at = ? WHERE route_key != ?')
      .bind(now, input.route_key)
      .run();
  }

  const existing = await getQueueRoute(db, input.route_key);
  const createdAt = existing?.created_at ?? now;

  await db
    .prepare(
      `INSERT INTO puv_queue_routes (
         route_key,
         label,
         origin_lng,
         origin_lat,
         destination_lng,
         destination_lat,
         timezone,
         cache_ttl_ms,
         baseline_by_hour_json,
         tod_score_by_hour_json,
         holidays_json,
         is_active,
         is_default,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(route_key)
       DO UPDATE SET
         label = excluded.label,
         origin_lng = excluded.origin_lng,
         origin_lat = excluded.origin_lat,
         destination_lng = excluded.destination_lng,
         destination_lat = excluded.destination_lat,
         timezone = excluded.timezone,
         cache_ttl_ms = excluded.cache_ttl_ms,
         baseline_by_hour_json = excluded.baseline_by_hour_json,
         tod_score_by_hour_json = excluded.tod_score_by_hour_json,
         holidays_json = excluded.holidays_json,
         is_active = excluded.is_active,
         is_default = excluded.is_default,
         updated_at = excluded.updated_at`,
    )
    .bind(
      input.route_key,
      input.label,
      input.origin[0],
      input.origin[1],
      input.destination[0],
      input.destination[1],
      input.timezone,
      input.cache_ttl_ms,
      toStoredJson(input.baseline_by_hour),
      toStoredJson(input.tod_score_by_hour),
      toStoredJson(input.holidays),
      input.is_active ? 1 : 0,
      input.is_default ? 1 : 0,
      createdAt,
      now,
    )
    .run();

  const saved = await getQueueRoute(db, input.route_key);
  if (!saved) {
    throw new Error(`Failed to save queue route ${input.route_key}`);
  }
  return saved;
}

export async function deleteQueueRoute(db: D1Database, routeKey: string): Promise<boolean> {
  await db.prepare('DELETE FROM ors_cache WHERE route_key = ?').bind(routeKey).run();
  const result = await db.prepare('DELETE FROM puv_queue_routes WHERE route_key = ?').bind(routeKey).run();
  return Number(result.meta.changes ?? 0) > 0;
}
