import type { D1Database } from '@cloudflare/workers-types';

import type { IncidentSignal, QueueIncident } from './types';

type IncidentRow = {
  id: number;
  route_key: string;
  category: 'event' | 'traffic_advisory';
  title: string;
  venue_name: string | null;
  starts_at: string;
  ends_at: string;
  score_delta: number;
  source: string;
  notes: string;
  is_active: number;
  created_at: number;
  updated_at: number;
};

type QueueIncidentInput = Omit<QueueIncident, 'id' | 'created_at' | 'updated_at'>;

function mapIncident(row: IncidentRow): QueueIncident {
  return {
    id: row.id,
    route_key: row.route_key,
    category: row.category,
    title: row.title,
    venue_name: row.venue_name,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    score_delta: row.score_delta,
    source: row.source,
    notes: row.notes,
    is_active: row.is_active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function clampScoreDelta(value: number): number {
  return Math.max(-2, Math.min(Math.round(value * 10) / 10, 4));
}

export async function listRouteIncidents(db: D1Database, routeKey: string): Promise<QueueIncident[]> {
  const { results } = await db
    .prepare(
      `SELECT *
       FROM puv_queue_incidents
       WHERE route_key = ?
       ORDER BY starts_at DESC, id DESC`,
    )
    .bind(routeKey)
    .all<IncidentRow>();

  return (results ?? []).map(mapIncident);
}

export async function saveIncident(db: D1Database, input: QueueIncidentInput, id?: number): Promise<QueueIncident> {
  const now = Date.now();

  if (id) {
    await db
      .prepare(
        `UPDATE puv_queue_incidents
         SET route_key = ?,
             category = ?,
             title = ?,
             venue_name = ?,
             starts_at = ?,
             ends_at = ?,
             score_delta = ?,
             source = ?,
             notes = ?,
             is_active = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        input.route_key,
        input.category,
        input.title,
        input.venue_name,
        input.starts_at,
        input.ends_at,
        input.score_delta,
        input.source,
        input.notes,
        input.is_active ? 1 : 0,
        now,
        id,
      )
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO puv_queue_incidents (
           route_key,
           category,
           title,
           venue_name,
           starts_at,
           ends_at,
           score_delta,
           source,
           notes,
           is_active,
           created_at,
           updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.route_key,
        input.category,
        input.title,
        input.venue_name,
        input.starts_at,
        input.ends_at,
        input.score_delta,
        input.source,
        input.notes,
        input.is_active ? 1 : 0,
        now,
        now,
      )
      .run();
  }

  const row = id
    ? await db.prepare('SELECT * FROM puv_queue_incidents WHERE id = ? LIMIT 1').bind(id).first<IncidentRow>()
    : await db.prepare('SELECT * FROM puv_queue_incidents ORDER BY id DESC LIMIT 1').first<IncidentRow>();

  if (!row) {
    throw new Error('Failed to save incident');
  }

  return mapIncident(row);
}

export async function deleteIncident(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare('DELETE FROM puv_queue_incidents WHERE id = ?').bind(id).run();
  return Number(result.meta.changes ?? 0) > 0;
}

export async function resolveIncidentSignal(
  db: D1Database,
  routeKey: string,
  nowIso: string,
): Promise<IncidentSignal> {
  const { results } = await db
    .prepare(
      `SELECT *
       FROM puv_queue_incidents
       WHERE route_key = ?
         AND is_active = 1
         AND starts_at <= ?
         AND ends_at >= ?
       ORDER BY starts_at ASC, id ASC`,
    )
    .bind(routeKey, nowIso, nowIso)
    .all<IncidentRow>();

  const active = (results ?? []).map(mapIncident).map((incident) => ({
    id: incident.id,
    category: incident.category,
    title: incident.title,
    venue_name: incident.venue_name,
    score_delta: incident.score_delta,
    source: incident.source,
    starts_at: incident.starts_at,
    ends_at: incident.ends_at,
  }));

  return {
    score_delta: clampScoreDelta(active.reduce((total, incident) => total + incident.score_delta, 0)),
    active,
  };
}
