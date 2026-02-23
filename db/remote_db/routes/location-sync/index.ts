import { Hono } from 'hono';

type Bindings = {
  RouteDB: D1Database;
};

export const locationSync = new Hono<{ Bindings: Bindings }>();

const MIN_TS = 1_577_836_800_000; // 2020-01-01
const MAX_FUTURE_SKEW = 5 * 60 * 1000; // 5 minutes
const PASSIVE_ROUTE_BREAK_MS = 30 * 60 * 1000; // 30 minutes
const PASSIVE_MAX_ROUTE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
const PASSIVE_STILL_SPLIT_MS = 60 * 60 * 1000; // 1 hour
const EARTH_RADIUS_M = 6_371_000;

function normalizeCoord(value: number): string {
  return value.toFixed(6);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(hash));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidTimestamp(value: unknown): value is number {
  if (!isFiniteNumber(value)) return false;
  const now = Date.now();
  return value >= MIN_TS && value <= now + MAX_FUTURE_SKEW;
}

function isSafeDeviceId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return value.length >= 1 && value.length <= 128;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

async function getPassiveRouteId(
  c: any,
  deviceId: string,
  accountKey: string | null,
  timestamp: number,
  activityType: string | null,
  lat: number,
  lng: number
): Promise<{ routeId: number; createdNew: boolean }> {
  const previous = await c.env.RouteDB
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
    .first<{ route_id: number; timestamp: number; lat: number; lng: number; activity_type: string | null }>();

  const closePreviousRoute = async (routeId: number, endedAt: number) => {
    await c.env.RouteDB
      .prepare(
        `UPDATE routes
         SET ended_at = CASE
           WHEN ended_at IS NULL OR ended_at < ? THEN ?
           ELSE ended_at
         END
         WHERE id = ?`
      )
      .bind(endedAt, endedAt, routeId)
      .run();
  };

  if (
    previous &&
    Number.isFinite(previous.route_id) &&
    Number.isFinite(previous.timestamp) &&
    timestamp >= previous.timestamp &&
    (timestamp - previous.timestamp) <= PASSIVE_ROUTE_BREAK_MS
  ) {
    const routeMeta = await c.env.RouteDB
      .prepare('SELECT started_at FROM routes WHERE id = ? LIMIT 1')
      .bind(previous.route_id)
      .first<{ started_at: number | null }>();
    const routeStartedAt = Number(routeMeta?.started_at || previous.timestamp);

    const exceedsDurationCap =
      Number.isFinite(routeStartedAt) &&
      routeStartedAt > 0 &&
      (timestamp - routeStartedAt) > PASSIVE_MAX_ROUTE_DURATION_MS;

    const isStillNow = String(activityType || '').toUpperCase() === 'STILL';
    const wasStillBefore = String(previous.activity_type || '').toUpperCase() === 'STILL';
    const movedMeters = haversineMeters(
      Number(previous.lat),
      Number(previous.lng),
      lat,
      lng
    );
    const stillWindowExceeded =
      isStillNow &&
      wasStillBefore &&
      Number.isFinite(routeStartedAt) &&
      routeStartedAt > 0 &&
      (timestamp - routeStartedAt) > PASSIVE_STILL_SPLIT_MS &&
      movedMeters <= 50;

    if (!exceedsDurationCap && !stillWindowExceeded) {
      return { routeId: previous.route_id, createdNew: false };
    }

    await closePreviousRoute(previous.route_id, previous.timestamp);
  }

  const routeInsert = await c.env.RouteDB
    .prepare('INSERT INTO routes (timestamp, source, account_key, device_id, started_at) VALUES (?, ?, ?, ?, ?)')
    .bind(timestamp, 'PASSIVE', accountKey, deviceId, timestamp)
    .run();

  return { routeId: Number(routeInsert.meta.last_row_id), createdNew: true };
}

function asSafeKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) return null;
  return trimmed;
}

async function insertTrackingEvent(
  c: any,
  eventType: string,
  source: string,
  timestamp: number,
  routeId: number | null,
  accountKey: string | null,
  deviceId: string | null,
  payload?: Record<string, unknown>
) {
  await c.env.RouteDB
    .prepare(
      'INSERT INTO tracking_events (event_type, source, route_id, account_key, device_id, timestamp, payload) VALUES (?, ?, ?, ?, ?, ?, ?)'
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


/*** ROUTE & POINTS SYNC API ***/
locationSync.get('/test', async (c) => {

  return c.json({ 'test':'test' });
});

// Fetch all routes and points
locationSync.get('/fetchAll', async (c) => {
  const routes = await c.env.RouteDB.prepare('SELECT * FROM routes').all();
  const points = await c.env.RouteDB.prepare('SELECT * FROM points').all();
  const passive = await c.env.RouteDB.prepare('SELECT * FROM passive_locations').all();
  return c.json({ 
    routes: routes.results, 
    points: points.results,
    passive_locations: passive.results 
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
    `SELECT p.id,
            p.device_id,
            p.account_key,
            p.lat,
            p.lng,
            p.timestamp,
            p.route_id
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
  ).bind(cutoffTs).all();

  const rows = Array.isArray(result?.results) ? result.results : [];
  const devices = rows.map((row: any) => ({
    id: Number(row.id),
    deviceId: String(row.device_id || ''),
    accountKey: String(row.account_key || ''),
    lat: Number(row.lat),
    lng: Number(row.lng),
    timestamp: Number(row.timestamp),
    routeId: row.route_id == null ? null : Number(row.route_id)
  }));

  return c.json({
    success: true,
    windowMinutes,
    cutoffTs,
    devices
  });
});

locationSync.get('/events', async (c) => {
  const limitRaw = Number(c.req.query('limit') || 80);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(300, Math.floor(limitRaw))) : 80;
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
    events: Array.isArray(rows?.results) ? rows.results : []
  });
});

// Sync insert
locationSync.post('/sync', async (c) => {
  const body = await c.req.json();
  const table = body?.table;
  const changes = Array.isArray(body?.changes) ? body.changes : [];
  const idMap: Record<number, number> = {};
  const insertedIds: number[] = [];

  if (table === 'routes') {
    for (const row of changes) {
      const tempId = row.id;
      const source = String(row?.source || 'UNKNOWN').toUpperCase();
      const accountKey = asSafeKey(row?.accountKey);
      const deviceId = asSafeKey(row?.deviceId);
      const startedAt = isValidTimestamp(row?.startedAt) ? Number(row.startedAt) : Number(row?.timestamp || Date.now());
      const endedAt = isValidTimestamp(row?.endedAt) ? Number(row.endedAt) : null;
      const result = await c.env.RouteDB.prepare(
        'INSERT INTO routes (timestamp, source, account_key, device_id, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(row.timestamp, source, accountKey, deviceId, startedAt, endedAt).run();

      if (result.success) {
        const newId = result.meta.last_row_id;
        insertedIds.push(newId);
        idMap[tempId] = newId;
        if (source === 'ACTIVE') {
          await insertTrackingEvent(
            c,
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
      const realRouteId = idMap[row.routeId] || row.routeId;
      let source = String(row?.source || 'UNKNOWN').toUpperCase();
      let accountKey = asSafeKey(row?.accountKey);
      let deviceId = asSafeKey(row?.deviceId);
      if (source === 'UNKNOWN' && Number.isFinite(Number(realRouteId))) {
        const routeMeta = await c.env.RouteDB
          .prepare('SELECT source, account_key, device_id FROM routes WHERE id = ? LIMIT 1')
          .bind(realRouteId)
          .first<{ source: string; account_key: string | null; device_id: string | null }>();
        if (routeMeta?.source) {
          source = String(routeMeta.source).toUpperCase();
        }
        if (!accountKey) accountKey = asSafeKey(routeMeta?.account_key);
        if (!deviceId) deviceId = asSafeKey(routeMeta?.device_id);
      }
      const result = await c.env.RouteDB.prepare(
        'INSERT INTO points (routeId, lat, lng, timestamp, source, account_key, device_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(realRouteId, row.lat, row.lng, row.timestamp, source, accountKey, deviceId).run();

      if (result.success) insertedIds.push(result.meta.last_row_id);
    }
    return c.json({ success: true, ids: insertedIds });
  }

  if (table === 'passive_locations') {
    let insertedCount = 0;
    let dedupedCount = 0;
    let rejectedCount = 0;

    for (const row of changes) {
      const lat = row?.lat;
      const lng = row?.lng;
      const timestamp = row?.timestamp;
      const deviceId = row?.deviceId;
      const accountKey = asSafeKey(row?.accountKey);
      const sampleHash = row?.sampleHash;
      const activityType = typeof row?.activityType === 'string' ? row.activityType : null;
      const activityConfidence = isFiniteNumber(row?.activityConfidence) ? Number(row.activityConfidence) : null;
      const reason = typeof row?.reason === 'string' ? row.reason : null;

      if (!isFiniteNumber(lat) || lat < -90 || lat > 90) {
        rejectedCount++;
        continue;
      }
      if (!isFiniteNumber(lng) || lng < -180 || lng > 180) {
        rejectedCount++;
        continue;
      }
      if (!isValidTimestamp(timestamp)) {
        rejectedCount++;
        continue;
      }
      if (!isSafeDeviceId(deviceId)) {
        rejectedCount++;
        continue;
      }

      const expectedHash = await sha256Hex(
        `${deviceId}|${timestamp}|${normalizeCoord(lat)}|${normalizeCoord(lng)}`
      );
      if (typeof sampleHash !== 'string' || sampleHash !== expectedHash) {
        rejectedCount++;
        continue;
      }

      const existing = await c.env.RouteDB
        .prepare('SELECT id FROM passive_locations WHERE sample_hash = ? LIMIT 1')
        .bind(sampleHash)
        .first<{ id: number }>();
      if (existing) {
        dedupedCount++;
        continue;
      }

      const { routeId, createdNew } = await getPassiveRouteId(
        c,
        deviceId,
        accountKey,
        timestamp,
        activityType,
        lat,
        lng
      );

      const result = await c.env.RouteDB.prepare(
        'INSERT INTO passive_locations (lat, lng, timestamp, device_id, account_key, sample_hash, received_at, route_id, activity_type, activity_confidence, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(sample_hash) DO NOTHING'
      ).bind(lat, lng, timestamp, deviceId, accountKey, sampleHash, Date.now(), routeId, activityType, activityConfidence, reason).run();

      if (result.success && Number(result.meta.changes || 0) > 0) {
        insertedCount++;
        insertedIds.push(result.meta.last_row_id);
        await c.env.RouteDB.prepare(
          'INSERT INTO points (routeId, lat, lng, timestamp, source, account_key, device_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(routeId, lat, lng, timestamp, 'PASSIVE', accountKey, deviceId).run();

        if (createdNew) {
          await insertTrackingEvent(
            c,
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
      }
    }
    return c.json({
      success: true,
      ids: insertedIds,
      insertedCount,
      dedupedCount,
      rejectedCount
    });
  }

  return c.json({ error: 'Invalid table' }, 400);
});

// Delete row
locationSync.delete('/sync', async (c) => {
  const body = await c.req.json();
  const { table, id } = body;

  if (table === 'routes') {
    // Delete associated points first (though schema has CASCADE, being explicit doesn't hurt)
    await c.env.RouteDB.prepare('DELETE FROM points WHERE routeId = ?').bind(id).run();
    await c.env.RouteDB.prepare('DELETE FROM routes WHERE id = ?').bind(id).run();
  } else if (table === 'points') {
    await c.env.RouteDB.prepare('DELETE FROM points WHERE id = ?').bind(id).run();
  } else if (table === 'passive_locations') {
    await c.env.RouteDB.prepare('DELETE FROM passive_locations WHERE id = ?').bind(id).run();
  } else {
    return c.json({ error: 'Invalid table' }, 400);
  }

  return c.json({ success: true });
});
