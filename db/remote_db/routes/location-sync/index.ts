import { Hono } from 'hono';

type Bindings = {
  RouteDB: D1Database;
};

export const locationSync = new Hono<{ Bindings: Bindings }>();

const MIN_TS = 1_577_836_800_000; // 2020-01-01
const MAX_FUTURE_SKEW = 5 * 60 * 1000; // 5 minutes
const PASSIVE_ROUTE_BREAK_MS = 30 * 60 * 1000; // 30 minutes

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

async function getPassiveRouteId(
  c: any,
  deviceId: string,
  timestamp: number
): Promise<number> {
  const previous = await c.env.RouteDB
    .prepare(
      'SELECT route_id, timestamp FROM passive_locations WHERE device_id = ? AND route_id IS NOT NULL ORDER BY timestamp DESC LIMIT 1'
    )
    .bind(deviceId)
    .first<{ route_id: number; timestamp: number }>();

  if (
    previous &&
    Number.isFinite(previous.route_id) &&
    Number.isFinite(previous.timestamp) &&
    timestamp >= previous.timestamp &&
    (timestamp - previous.timestamp) <= PASSIVE_ROUTE_BREAK_MS
  ) {
    return previous.route_id;
  }

  const routeInsert = await c.env.RouteDB
    .prepare('INSERT INTO routes (timestamp) VALUES (?)')
    .bind(timestamp)
    .run();

  return Number(routeInsert.meta.last_row_id);
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
      const result = await c.env.RouteDB.prepare(
        'INSERT INTO routes (timestamp) VALUES (?)'
      ).bind(row.timestamp).run();

      if (result.success) {
        const newId = result.meta.last_row_id;
        insertedIds.push(newId);
        idMap[tempId] = newId;
      }
    }
    return c.json({ success: true, ids: insertedIds, idMap });
  }

  if (table === 'points') {
    for (const row of changes) {
      const realRouteId = idMap[row.routeId] || row.routeId;
      const result = await c.env.RouteDB.prepare(
        'INSERT INTO points (routeId, lat, lng, timestamp) VALUES (?, ?, ?, ?)'
      ).bind(realRouteId, row.lat, row.lng, row.timestamp).run();

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
      const sampleHash = row?.sampleHash;

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

      const routeId = await getPassiveRouteId(c, deviceId, timestamp);

      const result = await c.env.RouteDB.prepare(
        'INSERT INTO passive_locations (lat, lng, timestamp, device_id, sample_hash, received_at, route_id) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(sample_hash) DO NOTHING'
      ).bind(lat, lng, timestamp, deviceId, sampleHash, Date.now(), routeId).run();

      if (result.success && Number(result.meta.changes || 0) > 0) {
        insertedCount++;
        insertedIds.push(result.meta.last_row_id);
        await c.env.RouteDB.prepare(
          'INSERT INTO points (routeId, lat, lng, timestamp) VALUES (?, ?, ?, ?)'
        ).bind(routeId, lat, lng, timestamp).run();
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
