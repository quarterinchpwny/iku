import { Hono } from 'hono';

type Bindings = {
  RouteDB: D1Database;
};

export const locationSync = new Hono<{ Bindings: Bindings }>();

const MIN_TS = 1_577_836_800_000; // 2020-01-01
const MAX_FUTURE_SKEW = 5 * 60 * 1000; // 5 minutes
const PASSIVE_ROUTE_BREAK_MS = 45 * 60 * 1000;
const PASSIVE_MAX_ROUTE_DURATION_MS = 4 * 60 * 60 * 1000;
const PASSIVE_STATIONARY_REUSE_RADIUS_M = 100;
const PASSIVE_STATIONARY_EXIT_RADIUS_M = 180;
const PASSIVE_STATIONARY_REUSE_GAP_MS = 12 * 60 * 60 * 1000;
const PASSIVE_STATIONARY_MAX_ROUTE_DURATION_MS = 72 * 60 * 60 * 1000;
const PASSIVE_STATIONARY_DWELL_MS = 20 * 60 * 1000;
const EARTH_RADIUS_M = 6_371_000;
const PASSIVE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30d TTL
const ROUTE_CLOSE_STILL_GAP_MS = 10 * 60 * 1000;

// --- Pure helpers ---

function normalizeCoord(value: number): string {
  return value.toFixed(6);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256Hex(input: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(input));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidTimestamp(value: unknown): value is number {
  if (!isFiniteNumber(value)) return false;
  return value >= MIN_TS && value <= Date.now() + MAX_FUTURE_SKEW;
}

function isSafeDeviceId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 128;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function isMovingType(activityType: string | null | undefined): boolean {
  const v = String(activityType || '').toUpperCase();
  return v === 'WALKING' || v === 'RUNNING' || v === 'DRIVING';
}

function isStillType(activityType: string | null | undefined): boolean {
  return String(activityType || '').toUpperCase() === 'STILL';
}

function asSafeKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= 128 ? trimmed : null;
}

function getBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const trimmed = authHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  return token || null;
}

// --- DB helpers ---

async function isDeviceTokenValid(
  db: D1Database,
  accountKey: string,
  deviceId: string
): Promise<boolean> {
  try {
    const row = await db
      .prepare(
        `SELECT id FROM device_tokens
         WHERE account_key = ? AND device_id = ? AND revoked = 0
         LIMIT 1`
      )
      .bind(accountKey, deviceId)
      .first<{ id: number }>();
    return !!row;
  } catch {
    // Migration not applied yet — allow through for backward compatibility.
    return true;
  }
}

async function touchDeviceTokenSeenAt(
  db: D1Database,
  accountKey: string | null,
  deviceId: string
): Promise<void> {
  if (!accountKey) return;
  try {
    await db
      .prepare(
        `UPDATE device_tokens
         SET last_seen_at = ?
         WHERE account_key = ? AND device_id = ? AND revoked = 0`
      )
      .bind(Date.now(), accountKey, deviceId)
      .run();
  } catch {
    // Table may not exist yet; keep sync path alive.
  }
}

async function closePreviousRoute(
  db: D1Database,
  routeId: number,
  endedAt: number
): Promise<void> {
  await db
    .prepare(
      `UPDATE routes
       SET status = 'closed',
           ended_at = CASE WHEN ended_at IS NULL OR ended_at < ? THEN ? ELSE ended_at END
       WHERE id = ?`
    )
    .bind(endedAt, endedAt, routeId)
    .run();
}

async function closeOtherOpenPassiveRoutes(
  db: D1Database,
  activeRouteId: number,
  endedAt: number,
  accountKey: string | null,
  deviceId: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE routes
       SET status = 'closed',
           ended_at = CASE
             WHEN ended_at IS NULL OR ended_at < ? THEN ?
             ELSE ended_at
           END
       WHERE id != ?
         AND source = 'PASSIVE'
         AND status = 'open'
         AND (
           (account_key IS NOT NULL AND account_key = ?)
           OR
           (account_key IS NULL AND device_id = ?)
         )`
    )
    .bind(endedAt, endedAt, activeRouteId, accountKey, deviceId)
    .run();
}

async function tryUpdateRouteRollup(
  db: D1Database,
  routeId: number,
  timestamp: number,
  distanceDelta: number,
  activityType: string | null
): Promise<void> {
  try {
    await db
      .prepare(
        `UPDATE routes
         SET status = 'open',
             last_point_at = ?,
             point_count = COALESCE(point_count, 0) + 1,
             distance_meters = COALESCE(distance_meters, 0) + ?
         WHERE id = ?`
      )
      .bind(timestamp, Math.max(0, distanceDelta), routeId)
      .run();

    if (String(activityType || '').toUpperCase() === 'STILL') {
      const routeMeta = await db
        .prepare('SELECT started_at, last_point_at FROM routes WHERE id = ? LIMIT 1')
        .bind(routeId)
        .first<{ started_at: number | null; last_point_at: number | null }>();
      const startedAt = Number(routeMeta?.started_at || 0);
      const lastPointAt = Number(routeMeta?.last_point_at || 0);
      if (startedAt > 0 && lastPointAt > 0 && lastPointAt - startedAt >= ROUTE_CLOSE_STILL_GAP_MS) {
        await db
          .prepare(
            `UPDATE routes
             SET status = 'closed',
                 ended_at = CASE WHEN ended_at IS NULL OR ended_at < ? THEN ? ELSE ended_at END
             WHERE id = ?`
          )
          .bind(timestamp, timestamp, routeId)
          .run();
      }
    }
  } catch {
    // Route rollup columns are migration-gated; do not block ingest.
  }
}

async function insertTrackingEvent(
  db: D1Database,
  eventType: string,
  source: string,
  timestamp: number,
  routeId: number | null,
  accountKey: string | null,
  deviceId: string | null,
  payload?: Record<string, unknown>
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO tracking_events
         (event_type, source, route_id, account_key, device_id, timestamp, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      eventType,
      source,
      routeId,
      accountKey,
      deviceId,
      timestamp,
      payload ? JSON.stringify(payload) : null
    )
    .run();
}

async function createPassiveRoute(
  db: D1Database,
  timestamp: number,
  accountKey: string | null,
  deviceId: string
): Promise<number> {
  const result = await db
    .prepare(
      'INSERT INTO routes (timestamp, source, account_key, device_id, started_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(timestamp, 'PASSIVE', accountKey, deviceId, timestamp)
    .run();
  return Number(result.meta.last_row_id);
}

async function deleteRouteIfUnused(db: D1Database, routeId: number): Promise<void> {
  const passiveRef = await db
    .prepare('SELECT id FROM passive_locations WHERE route_id = ? LIMIT 1')
    .bind(routeId)
    .first<{ id: number }>();
  if (passiveRef) return;

  const pointRef = await db
    .prepare('SELECT id FROM points WHERE routeId = ? LIMIT 1')
    .bind(routeId)
    .first<{ id: number }>();
  if (pointRef) return;

  await db.prepare('DELETE FROM routes WHERE id = ?').bind(routeId).run();
}

async function getPassiveRouteId(
  db: D1Database,
  deviceId: string,
  accountKey: string | null,
  timestamp: number,
  activityType: string | null,
  lat: number,
  lng: number
): Promise<{ routeId: number; createdNew: boolean }> {
  const previous = await db
    .prepare(
      `SELECT route_id, timestamp, lat, lng, activity_type
       FROM passive_locations
       WHERE route_id IS NOT NULL
         AND (
           (account_key IS NOT NULL AND account_key = ?)
           OR
           (account_key IS NULL AND device_id = ?)
         )
       ORDER BY timestamp DESC
       LIMIT 1`
    )
    .bind(accountKey, deviceId)
    .first<{
      route_id: number;
      timestamp: number;
      lat: number;
      lng: number;
      activity_type: string | null;
    }>();

  if (
    !previous ||
    !Number.isFinite(previous.route_id) ||
    !Number.isFinite(previous.timestamp) ||
    timestamp < previous.timestamp
  ) {
    const routeId = await createPassiveRoute(db, timestamp, accountKey, deviceId);
    return { routeId, createdNew: true };
  }

  const movedMeters = haversineMeters(
    Number(previous.lat),
    Number(previous.lng),
    lat,
    lng
  );
  const movingByType = isMovingType(activityType);
  const movingByDistance = Number.isFinite(movedMeters) && movedMeters >= PASSIVE_STATIONARY_EXIT_RADIUS_M;
  const isMovingNow = movingByType || movingByDistance;
  const wasMovingBefore = isMovingType(previous.activity_type);
  const stillNow = isStillType(activityType);
  const wasStillBefore = isStillType(previous.activity_type);
  const shouldContinueStillRoute =
    stillNow &&
    wasStillBefore &&
    Number.isFinite(movedMeters) &&
    movedMeters <= PASSIVE_STATIONARY_REUSE_RADIUS_M;
  const stationaryLike =
    Number.isFinite(movedMeters) &&
    movedMeters <= PASSIVE_STATIONARY_REUSE_RADIUS_M &&
    !isMovingNow &&
    !wasMovingBefore;
  const maxGap = stationaryLike ? PASSIVE_STATIONARY_REUSE_GAP_MS : PASSIVE_ROUTE_BREAK_MS;

  if (timestamp - previous.timestamp > maxGap && !shouldContinueStillRoute) {
    await closePreviousRoute(db, previous.route_id, previous.timestamp);
    const routeId = await createPassiveRoute(db, timestamp, accountKey, deviceId);
    return { routeId, createdNew: true };
  }

  if (shouldContinueStillRoute) {
    return { routeId: previous.route_id, createdNew: false };
  }

  const routeMeta = await db
    .prepare('SELECT started_at FROM routes WHERE id = ? LIMIT 1')
    .bind(previous.route_id)
    .first<{ started_at: number | null }>();
  const routeStartedAt = Number(routeMeta?.started_at || previous.timestamp);
  const routeAgeMs =
    Number.isFinite(routeStartedAt) && routeStartedAt > 0
      ? Math.max(0, timestamp - routeStartedAt)
      : 0;
  const departedAfterDwell =
    Number.isFinite(movedMeters) &&
    !wasMovingBefore &&
    routeAgeMs >= PASSIVE_STATIONARY_DWELL_MS &&
    isMovingNow &&
    movedMeters >= PASSIVE_STATIONARY_EXIT_RADIUS_M;
  const maxDuration = stationaryLike
    ? PASSIVE_STATIONARY_MAX_ROUTE_DURATION_MS
    : PASSIVE_MAX_ROUTE_DURATION_MS;
  const exceedsDurationCap =
    Number.isFinite(routeStartedAt) &&
    routeStartedAt > 0 &&
    timestamp - routeStartedAt > maxDuration;

  if (!exceedsDurationCap && !departedAfterDwell) {
    return { routeId: previous.route_id, createdNew: false };
  }

  await closePreviousRoute(db, previous.route_id, previous.timestamp);
  const routeId = await createPassiveRoute(db, timestamp, accountKey, deviceId);
  return { routeId, createdNew: true };
}

// --- Routes ---

locationSync.get('/test', (c) => c.json({ test: 'test' }));

// Fetch all — scoped to accountKey or deviceId when provided, full dump otherwise (admin use only)
locationSync.get('/fetchAll', async (c) => {
  const accountKey = asSafeKey(c.req.query('accountKey'));
  const deviceId = asSafeKey(c.req.query('deviceId'));

  let routes, points, passive, geofences;

  if (accountKey) {
    routes = await c.env.RouteDB
      .prepare('SELECT * FROM routes WHERE account_key = ?').bind(accountKey).all();
    points = await c.env.RouteDB
      .prepare('SELECT * FROM points WHERE account_key = ?').bind(accountKey).all();
    passive = await c.env.RouteDB
      .prepare('SELECT * FROM passive_locations WHERE account_key = ?').bind(accountKey).all();
    geofences = await c.env.RouteDB
      .prepare('SELECT * FROM geofences WHERE account_key = ?').bind(accountKey).all();
  } else if (deviceId) {
    routes = await c.env.RouteDB
      .prepare('SELECT * FROM routes WHERE device_id = ?').bind(deviceId).all();
    points = await c.env.RouteDB
      .prepare('SELECT * FROM points WHERE device_id = ?').bind(deviceId).all();
    passive = await c.env.RouteDB
      .prepare('SELECT * FROM passive_locations WHERE device_id = ?').bind(deviceId).all();
    geofences = await c.env.RouteDB
      .prepare('SELECT * FROM geofences WHERE device_id = ?').bind(deviceId).all();
  } else {
    // Unscoped full-dump — keep for admin/debug but log a warning
    console.warn('fetchAll called without accountKey or deviceId — returning full table dump');
    routes = await c.env.RouteDB.prepare('SELECT * FROM routes').all();
    points = await c.env.RouteDB.prepare('SELECT * FROM points').all();
    passive = await c.env.RouteDB.prepare('SELECT * FROM passive_locations').all();
    geofences = await c.env.RouteDB.prepare('SELECT * FROM geofences').all();
  }

  return c.json({
    routes: routes.results,
    points: points.results,
    passive_locations: passive.results,
    geofences: geofences.results,
  });
});

// Latest location per device (Life360-style monitoring view)
locationSync.get('/live', async (c) => {
  const windowMinutesRaw = Number(c.req.query('windowMinutes') || 720);
  const windowMinutes = Number.isFinite(windowMinutesRaw)
    ? Math.max(5, Math.min(7 * 24 * 60, Math.floor(windowMinutesRaw)))
    : 720;
  const cutoffTs = Date.now() - windowMinutes * 60 * 1000;

  const result = await c.env.RouteDB.prepare(
    `SELECT p.id, p.device_id, p.account_key, p.lat, p.lng, p.timestamp, p.route_id
     FROM passive_locations p
     INNER JOIN (
       SELECT COALESCE(account_key, device_id) AS actor_key, MAX(timestamp) AS latest_ts
       FROM passive_locations
       WHERE COALESCE(account_key, device_id) IS NOT NULL
         AND COALESCE(account_key, device_id) != ''
         AND timestamp >= ?
       GROUP BY COALESCE(account_key, device_id)
     ) latest
       ON latest.actor_key = COALESCE(p.account_key, p.device_id)
      AND latest.latest_ts = p.timestamp
     ORDER BY p.timestamp DESC`
  )
    .bind(cutoffTs)
    .all();

  const rows = Array.isArray(result?.results) ? result.results : [];
  const devices = rows.map((row: any) => ({
    id: Number(row.id),
    deviceId: String(row.device_id || ''),
    accountKey: String(row.account_key || ''),
    lat: Number(row.lat),
    lng: Number(row.lng),
    timestamp: Number(row.timestamp),
    routeId: row.route_id == null ? null : Number(row.route_id),
  }));

  return c.json({ success: true, windowMinutes, cutoffTs, devices });
});

locationSync.get('/events', async (c) => {
  const limitRaw = Number(c.req.query('limit') || 80);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(300, Math.floor(limitRaw)))
    : 80;
  const rows = await c.env.RouteDB
    .prepare(
      `SELECT id, event_type, source, route_id, account_key, device_id, timestamp, payload
       FROM tracking_events
       ORDER BY timestamp DESC
       LIMIT ?`
    )
    .bind(limit)
    .all();

  return c.json({
    success: true,
    events: Array.isArray(rows?.results) ? rows.results : [],
  });
});

locationSync.get('/api-logs', async (c) => {
  const limitRaw = Number(c.req.query('limit') || 120);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 120;
  const sourceRaw = String(c.req.query('source') || '').trim().toUpperCase();
  const source = sourceRaw && /^[A-Z0-9_-]{2,24}$/.test(sourceRaw) ? sourceRaw : null;
  const methodRaw = String(c.req.query('method') || '').trim().toUpperCase();
  const method = methodRaw && /^[A-Z]{3,12}$/.test(methodRaw) ? methodRaw : null;
  const pathContainsRaw = String(c.req.query('pathContains') || '').trim();
  const pathContains = pathContainsRaw ? `%${pathContainsRaw.slice(0, 120)}%` : null;
  const statusRaw = Number(c.req.query('status') || NaN);
  const status = Number.isFinite(statusRaw) ? Math.max(100, Math.min(599, Math.floor(statusRaw))) : null;

  const whereParts: string[] = [];
  const binds: Array<string | number> = [];

  if (method) {
    whereParts.push('method = ?');
    binds.push(method);
  }
  if (source === 'PLUGIN') {
    whereParts.push('method = ?');
    binds.push('PLUGIN');
  } else if (source === 'HTTP') {
    whereParts.push('method != ?');
    binds.push('PLUGIN');
  } else if (source) {
    whereParts.push('path LIKE ?');
    binds.push(`/plugin/${source.toLowerCase()}%`);
  }
  if (pathContains) {
    whereParts.push('path LIKE ?');
    binds.push(pathContains);
  }
  if (status) {
    whereParts.push('status = ?');
    binds.push(status);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const sql = `SELECT id, request_id, method, path, query, status, duration_ms, timestamp, ip, user_agent, cf_ray, request_bytes, response_bytes, auth_subject, error,
                      CASE WHEN method = 'PLUGIN' THEN 'PLUGIN' ELSE 'HTTP' END AS source,
                      CASE WHEN method = 'PLUGIN' AND path LIKE '/plugin/%' THEN SUBSTR(path, 9) ELSE NULL END AS plugin_source
               FROM api_access_logs
               ${whereSql}
               ORDER BY timestamp DESC
               LIMIT ?`;
  binds.push(limit);

  const rows = await c.env.RouteDB.prepare(sql)
    .bind(...binds)
    .all();

  return c.json({
    success: true,
    logs: Array.isArray(rows?.results) ? rows.results : [],
  });
});

locationSync.post('/logs/upload', async (c) => {
  const rawBody = await c.req.text();
  let body: any = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const db = c.env.RouteDB;
  const bearerToken = getBearerToken(c.req.header('Authorization'));
  const payloadAccountKey = asSafeKey(body?.accountKey);
  const accountKey = payloadAccountKey || asSafeKey(bearerToken);
  const deviceId = asSafeKey(body?.deviceId);
  const logs = Array.isArray(body?.logs) ? body.logs : [];
  const appMeta = typeof body?.meta === 'object' && body.meta ? body.meta : {};

  if (!logs.length) {
    return c.json({ success: false, error: 'logs must be a non-empty array' }, 400);
  }

  const limitedLogs = logs.slice(0, 300);
  let insertedCount = 0;
  const authSubject = accountKey || deviceId || 'plugin';
  const metaSummary =
    appMeta && Object.keys(appMeta).length > 0 ? JSON.stringify(appMeta).slice(0, 512) : null;

  for (const row of limitedLogs) {
    const source =
      typeof row?.source === 'string' && row.source.trim()
        ? row.source.trim().slice(0, 64)
        : 'plugin';
    const levelRaw =
      typeof row?.level === 'string' && row.level.trim() ? row.level.trim().toUpperCase() : 'INFO';
    const level = levelRaw.slice(0, 24);
    const messageRaw = typeof row?.message === 'string' ? row.message : '';
    const message = messageRaw.slice(0, 2000);
    const timestamp = isValidTimestamp(row?.timestamp) ? Number(row.timestamp) : Date.now();
    await db
      .prepare(
        `INSERT INTO api_access_logs
           (request_id, method, path, query, status, duration_ms, timestamp, ip, user_agent, cf_ray, request_bytes, response_bytes, auth_subject, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        'PLUGIN',
        `/plugin/${source.toLowerCase().slice(0, 32)}`,
        `level=${encodeURIComponent(level)}`,
        200,
        0,
        timestamp,
        null,
        metaSummary,
        null,
        message.length,
        null,
        authSubject,
        message
      )
      .run();
    insertedCount++;
  }

  return c.json({
    success: true,
    insertedCount,
    droppedCount: Math.max(0, logs.length - limitedLogs.length),
  });
});

// Sync insert
locationSync.post('/sync', async (c) => {
  const rawBody = await c.req.text();
  let body: any = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const table = body?.table;
  const changes = Array.isArray(body?.changes) ? body.changes : [];
  const idMap: Record<number, number> = {};
  const insertedIds: number[] = [];
  const bearerToken = getBearerToken(c.req.header('Authorization'));
  const payloadSig = c.req.header('X-Payload-Sig');
  const db = c.env.RouteDB;

  if (table === 'routes') {
    for (const row of changes) {
      const tempId = row.id;
      const source = String(row?.source || 'UNKNOWN').toUpperCase();
      const accountKey = asSafeKey(row?.accountKey);
      const deviceId = asSafeKey(row?.deviceId);
      const startedAt = isValidTimestamp(row?.startedAt)
        ? Number(row.startedAt)
        : Number(row?.timestamp || Date.now());
      const endedAt = isValidTimestamp(row?.endedAt) ? Number(row.endedAt) : null;

      const result = await db
        .prepare(
          'INSERT INTO routes (timestamp, source, account_key, device_id, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(row.timestamp, source, accountKey, deviceId, startedAt, endedAt)
        .run();

      if (result.success) {
        const newId = result.meta.last_row_id;
        insertedIds.push(newId);
        idMap[tempId] = newId;
        if (source === 'ACTIVE') {
          await insertTrackingEvent(
            db,
            'ACTIVE_ROUTE_STARTED',
            'ACTIVE',
            Number(row?.timestamp || Date.now()),
            Number(newId),
            accountKey,
            deviceId,
            { routeId: newId }
          );
        }
      }
    }
    return c.json({ success: true, ids: insertedIds, idMap });
  }

  if (table === 'points') {
    for (const row of changes) {
      const routeRef = row.route_id ?? row.routeId;
      const realRouteId = idMap[routeRef] ?? routeRef;
      let source = String(row?.source || 'UNKNOWN').toUpperCase();
      let accountKey = asSafeKey(row?.accountKey);
      let deviceId = asSafeKey(row?.deviceId);

      if (source === 'UNKNOWN' && Number.isFinite(Number(realRouteId))) {
        const routeMeta = await db
          .prepare('SELECT source, account_key, device_id FROM routes WHERE id = ? LIMIT 1')
          .bind(realRouteId)
          .first<{ source: string; account_key: string | null; device_id: string | null }>();
        if (routeMeta?.source) source = String(routeMeta.source).toUpperCase();
        if (!accountKey) accountKey = asSafeKey(routeMeta?.account_key);
        if (!deviceId) deviceId = asSafeKey(routeMeta?.device_id);
      }

      const result = await db
        .prepare(
          'INSERT INTO points (routeId, lat, lng, timestamp, source, account_key, device_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(realRouteId, row.lat, row.lng, row.timestamp, source, accountKey, deviceId)
        .run();

      if (result.success) {
        insertedIds.push(result.meta.last_row_id);

        if (Number.isFinite(Number(realRouteId))) {
          const timestamp = Number(row?.timestamp);
          const previous = await db
            .prepare(
              `SELECT lat, lng
               FROM points
               WHERE routeId = ? AND id != ? AND timestamp <= ?
               ORDER BY timestamp DESC
               LIMIT 1`
            )
            .bind(Number(realRouteId), result.meta.last_row_id, timestamp)
            .first<{ lat: number; lng: number }>();

          const distanceDelta =
            previous && Number.isFinite(previous.lat) && Number.isFinite(previous.lng)
              ? haversineMeters(Number(previous.lat), Number(previous.lng), Number(row.lat), Number(row.lng))
              : 0;

          await tryUpdateRouteRollup(db, Number(realRouteId), timestamp, distanceDelta, null);
        }
      }
    }
    return c.json({ success: true, ids: insertedIds });
  }

  if (table === 'passive_locations') {
    let insertedCount = 0;
    let dedupedCount = 0;
    let rejectedCount = 0;
    let authRejectedCount = 0;
    let signatureRejectedCount = 0;

    for (const row of changes) {
      const lat = row?.lat;
      const lng = row?.lng;
      const timestamp = row?.timestamp;
      const deviceId = row?.deviceId;
      const accountKey = asSafeKey(row?.accountKey);
      const sampleHash = row?.sampleHash;
      const activityType = typeof row?.activityType === 'string' ? row.activityType : null;
      const activityConfidence = isFiniteNumber(row?.activityConfidence)
        ? Number(row.activityConfidence)
        : null;
      const reason = typeof row?.reason === 'string' ? row.reason : null;
      const acc = isFiniteNumber(row?.acc) ? Number(row.acc) : null;
      const vel = isFiniteNumber(row?.vel) ? Number(row.vel) : null;
      const cog = isFiniteNumber(row?.cog) ? Number(row.cog) : null;
      const alt = isFiniteNumber(row?.alt) ? Number(row.alt) : null;
      const provider = typeof row?.provider === 'string' ? row.provider : null;
      const trigger = typeof row?.trigger === 'string' ? row.trigger : null;

      if (!isFiniteNumber(lat) || lat < -90 || lat > 90) { rejectedCount++; continue; }
      if (!isFiniteNumber(lng) || lng < -180 || lng > 180) { rejectedCount++; continue; }
      if (!isValidTimestamp(timestamp)) { rejectedCount++; continue; }
      if (!isSafeDeviceId(deviceId)) { rejectedCount++; continue; }

      if (accountKey) {
        // Enforce signature only when client sends auth headers (opt-in, for compatibility).
        if (bearerToken || payloadSig) {
          if (!bearerToken || bearerToken !== accountKey) {
            authRejectedCount++;
            continue;
          }
          const expectedSig = await hmacSha256Hex(rawBody, accountKey);
          if (!payloadSig || payloadSig.toLowerCase() !== expectedSig.toLowerCase()) {
            signatureRejectedCount++;
            continue;
          }
        }
        const tokenOk = await isDeviceTokenValid(db, accountKey, deviceId);
        if (!tokenOk) {
          authRejectedCount++;
          continue;
        }
      }

      const expectedHash = await sha256Hex(
        `${deviceId}|${timestamp}|${normalizeCoord(lat)}|${normalizeCoord(lng)}`
      );
      if (typeof sampleHash !== 'string' || sampleHash !== expectedHash) {
        rejectedCount++;
        continue;
      }

      const existing = await db
        .prepare('SELECT id FROM passive_locations WHERE sample_hash = ? LIMIT 1')
        .bind(sampleHash)
        .first<{ id: number }>();
      if (existing) {
        dedupedCount++;
        continue;
      }

      let routeId: number;
      let createdNew = false;
      try {
        const routeResult = await getPassiveRouteId(
          db,
          deviceId,
          accountKey,
          timestamp,
          activityType,
          lat,
          lng
        );
        routeId = routeResult.routeId;
        createdNew = routeResult.createdNew;
      } catch (routeErr) {
        // Never drop a valid passive location because route segmentation failed.
        routeId = await createPassiveRoute(db, timestamp, accountKey, deviceId);
        createdNew = true;
        await insertTrackingEvent(
          db,
          'PASSIVE_ROUTE_FALLBACK',
          'PASSIVE',
          timestamp,
          routeId,
          accountKey,
          deviceId,
          { reason: 'route_allocator_error', error: String(routeErr || 'unknown') }
        );
      }

      const result = await db
        .prepare(
          `INSERT INTO passive_locations
             (lat, lng, timestamp, device_id, account_key, sample_hash, received_at, route_id,
              activity_type, activity_confidence, reason, acc, vel, cog, alt, provider, trigger, retained_until)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(sample_hash) DO NOTHING`
        )
        .bind(
          lat, lng, timestamp, deviceId, accountKey, sampleHash,
          Date.now(), routeId, activityType, activityConfidence,
          reason, acc, vel, cog, alt, provider, trigger,
          Date.now() + PASSIVE_RETENTION_MS
        )
        .run();

      if (result.success && Number(result.meta.changes || 0) > 0) {
        insertedCount++;
        insertedIds.push(result.meta.last_row_id);

        const previous = await db
          .prepare(
            `SELECT lat, lng, timestamp
             FROM passive_locations
             WHERE route_id = ? AND id != ? AND timestamp <= ?
             ORDER BY timestamp DESC
             LIMIT 1`
          )
          .bind(routeId, result.meta.last_row_id, timestamp)
          .first<{ lat: number; lng: number; timestamp: number }>();
        const distanceDelta =
          previous && Number.isFinite(previous.lat) && Number.isFinite(previous.lng)
            ? haversineMeters(Number(previous.lat), Number(previous.lng), Number(lat), Number(lng))
            : 0;

        await tryUpdateRouteRollup(db, routeId, Number(timestamp), distanceDelta, activityType);
        await closeOtherOpenPassiveRoutes(db, routeId, Number(timestamp), accountKey, deviceId);
        await touchDeviceTokenSeenAt(db, accountKey, deviceId);
        await db
          .prepare(
            'INSERT INTO points (routeId, lat, lng, timestamp, source, account_key, device_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
          )
          .bind(routeId, lat, lng, timestamp, 'PASSIVE', accountKey, deviceId)
          .run();

        if (createdNew) {
          await insertTrackingEvent(
            db,
            'PASSIVE_ROUTE_STARTED',
            'PASSIVE',
            timestamp,
            routeId,
            accountKey,
            deviceId,
            { reason: reason || 'passive_ingest' }
          );
        }
      } else {
        dedupedCount++;
        if (createdNew) {
          await deleteRouteIfUnused(db, routeId);
        }
      }
    }

    return c.json({
      success: true,
      ids: insertedIds,
      insertedCount,
      dedupedCount,
      rejectedCount,
      authRejectedCount,
      signatureRejectedCount,
    });
  }

  if (table === 'geofences') {
    for (const row of changes) {
      const now = Date.now();
      const name = String(row?.name || '').trim();
      const lat = Number(row?.lat);
      const lng = Number(row?.lng);
      const radius = Number(row?.radius);
      const enabled = row?.enabled === false || Number(row?.enabled) === 0 ? 0 : 1;
      const accountKey = asSafeKey(row?.accountKey);
      const deviceId = asSafeKey(row?.deviceId);
      const lastState = String(row?.lastState || 'outside').toLowerCase() === 'inside' ? 'inside' : 'outside';
      const lastTransitionAt = isValidTimestamp(row?.lastTransitionAt) ? Number(row.lastTransitionAt) : null;
      const providedId = Number(row?.id);

      if (!name || !isFiniteNumber(lat) || lat < -90 || lat > 90) continue;
      if (!isFiniteNumber(lng) || lng < -180 || lng > 180) continue;
      if (!isFiniteNumber(radius) || radius < 25 || radius > 5000) continue;
      if (!accountKey && !deviceId) continue;

      if (Number.isFinite(providedId) && providedId > 0) {
        const existing = await db
          .prepare(
            `SELECT id
             FROM geofences
             WHERE id = ?
               AND (
                 (account_key IS NOT NULL AND account_key = ?)
                 OR
                 (account_key IS NULL AND device_id = ?)
               )
             LIMIT 1`
          )
          .bind(providedId, accountKey, deviceId)
          .first<{ id: number }>();
        if (existing) {
          await db
            .prepare(
              `UPDATE geofences
               SET name = ?, lat = ?, lng = ?, radius = ?, enabled = ?, account_key = ?, device_id = ?,
                   last_state = ?, last_transition_at = ?, updated_at = ?
               WHERE id = ?`
            )
            .bind(
              name,
              lat,
              lng,
              radius,
              enabled,
              accountKey,
              deviceId,
              lastState,
              lastTransitionAt,
              now,
              providedId
            )
            .run();
          insertedIds.push(providedId);
          continue;
        }
      }

      const result = await db
        .prepare(
          `INSERT INTO geofences
             (name, lat, lng, radius, enabled, account_key, device_id, last_state, last_transition_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          name,
          lat,
          lng,
          radius,
          enabled,
          accountKey,
          deviceId,
          lastState,
          lastTransitionAt,
          now,
          now
        )
        .run();
      if (result.success) insertedIds.push(Number(result.meta.last_row_id));
    }
    return c.json({ success: true, ids: insertedIds });
  }

  return c.json({ error: 'Invalid table' }, 400);
});

// Delete row
locationSync.delete('/sync', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { table, id } = body;
  const safeId = Number(id);

  if (!Number.isFinite(safeId) || safeId <= 0) {
    return c.json({ error: 'Invalid id' }, 400);
  }

  const db = c.env.RouteDB;

  if (table === 'routes') {
    await db.prepare('DELETE FROM points WHERE routeId = ?').bind(safeId).run();
    await db.prepare('DELETE FROM routes WHERE id = ?').bind(safeId).run();
  } else if (table === 'points') {
    await db.prepare('DELETE FROM points WHERE id = ?').bind(safeId).run();
  } else if (table === 'passive_locations') {
    await db.prepare('DELETE FROM passive_locations WHERE id = ?').bind(safeId).run();
  } else if (table === 'geofences') {
    await db.prepare('DELETE FROM geofences WHERE id = ?').bind(safeId).run();
  } else {
    return c.json({ error: 'Invalid table' }, 400);
  }

  return c.json({ success: true });
});
