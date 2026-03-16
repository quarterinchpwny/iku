import { Hono } from 'hono';
import { verify } from 'hono/jwt';

type Bindings = {
  RouteDB: D1Database;
  JWT_SECRET: string;
};

export const locationSync = new Hono<{ Bindings: Bindings }>();

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_TS = 1_577_836_800_000;           // 2020-01-01
const MAX_FUTURE_SKEW = 5 * 60 * 1000;     // 5 min
const PASSIVE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30d TTL

// Route segmentation
const PASSIVE_MAX_ROUTE_DURATION_MS = 4 * 60 * 60 * 1000;          // 4h max route
const STILL_SPLIT_DWELL_MS = 20 * 60 * 1000;                        // 20 min STILL → new route
const PASSIVE_STATIONARY_REUSE_RADIUS_M = 500;                       // same-place reuse
const PASSIVE_STATIONARY_EXIT_RADIUS_M = 180;                        // exit detection

// Stay / place visit detection (mirrors StayPointDetector.java)
const STAY_CLUSTER_RADIUS_M = 80;
const STAY_MIN_DURATION_MS = 3 * 60 * 1000;                         // 3 min minimum
const STAY_MAX_GAP_MS = 10 * 60 * 1000;                             // max gap within same stay
const STAY_AUTO_LABEL_MIN_VISITS = 5;
const STAY_LABEL_CLUSTER_RADIUS_M = 120;

const EARTH_RADIUS_M = 6_371_000;

// Rate limiting: max passive samples accepted per device per sync call
const MAX_SAMPLES_PER_SYNC = 40;

// ── Pure helpers ──────────────────────────────────────────────────────────────

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

function toRad(v: number): number { return (v * Math.PI) / 180; }

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isMovingType(v: unknown): boolean {
  const s = String(v || '').toUpperCase();
  return s === 'WALKING' || s === 'RUNNING' || s === 'DRIVING' || s === 'CYCLING';
}

function isStillType(v: unknown): boolean {
  return String(v || '').toUpperCase() === 'STILL';
}

function asSafeKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t && t.length <= 128 ? t : null;
}

function isParamEnabled(value: string | undefined, defaultValue = true): boolean {
  if (value == null) return defaultValue;
  const v = value.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'no') return false;
  if (v === '1' || v === 'true' || v === 'yes') return true;
  return defaultValue;
}

function isDifferentUtcDay(aTs: number, bTs: number): boolean {
  const a = new Date(aTs), b = new Date(bTs);
  return a.getUTCFullYear() !== b.getUTCFullYear()
    || a.getUTCMonth() !== b.getUTCMonth()
    || a.getUTCDate() !== b.getUTCDate();
}

function getBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const t = authHeader.trim();
  if (!t.toLowerCase().startsWith('bearer ')) return null;
  const token = t.slice(7).trim();
  return token || null;
}

const JWT_TOKEN_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

async function resolveAccountKeyFromToken(c: any, token: string): Promise<string | null> {
  if (!token) return null;
  if (JWT_TOKEN_RE.test(token)) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
      const derived = asSafeKey(payload?.username ?? payload?.sub);
      return derived || null;
    } catch {
      return null;
    }
  }
  return asSafeKey(token);
}

// ── Auth middleware ───────────────────────────────────────────────────────────

/**
 * Require a valid Bearer token for admin/read endpoints.
 * Attach the resolved accountKey to ctx variable for downstream handlers.
 *
 * FIX: Previously all GET endpoints (fetchAll, live, events, api-logs) had
 * zero authentication. Any anonymous caller could read all device locations.
 */
async function requireBearerAuth(
  c: any,
  next: () => Promise<void>
): Promise<Response | void> {
  const raw = getBearerToken(c.req.header('Authorization'));
  if (!raw) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = await resolveAccountKeyFromToken(c, raw);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('authToken', token);
  return next();
}

// ── DB helpers ────────────────────────────────────────────────────────────────

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
    return true; // migration not applied yet — let through
  }
}

async function resolveAccountKeyForDevice(
  db: D1Database,
  deviceId: string
): Promise<string | null> {
  try {
    const row = await db
      .prepare(
        `SELECT account_key FROM device_tokens
         WHERE device_id = ? AND revoked = 0
         ORDER BY COALESCE(last_seen_at, created_at) DESC
         LIMIT 1`
      )
      .bind(deviceId)
      .first<{ account_key: string | null }>();
    return asSafeKey(row?.account_key);
  } catch {
    return null;
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
        `UPDATE device_tokens SET last_seen_at = ?
         WHERE account_key = ? AND device_id = ? AND revoked = 0`
      )
      .bind(Date.now(), accountKey, deviceId)
      .run();
  } catch { /* migration not applied yet */ }
}

async function closePreviousRoute(db: D1Database, routeId: number, endedAt: number): Promise<void> {
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
           ended_at = CASE WHEN ended_at IS NULL OR ended_at < ? THEN ? ELSE ended_at END
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
  distanceDelta: number
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
  } catch { /* migration-gated columns */ }
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
    .bind(eventType, source, routeId, accountKey, deviceId, timestamp,
      payload ? JSON.stringify(payload) : null)
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
    .bind(routeId).first<{ id: number }>();
  if (passiveRef) return;
  const pointRef = await db
    .prepare('SELECT id FROM points WHERE routeId = ? LIMIT 1')
    .bind(routeId).first<{ id: number }>();
  if (pointRef) return;
  await db.prepare('DELETE FROM routes WHERE id = ?').bind(routeId).run();
}

// ── Route segmentation ────────────────────────────────────────────────────────

/**
 * Determines which route a passive location sample belongs to.
 *
 * FIX: Original only split routes on UTC day boundary. Now also splits when:
 *   - The device has been STILL for > STILL_SPLIT_DWELL_MS (movement session ended)
 *   - Route duration exceeds PASSIVE_MAX_ROUTE_DURATION_MS (safety ceiling)
 * This makes passive routes match trip semantics rather than being arbitrary day buckets.
 */
async function getPassiveRouteId(
  db: D1Database,
  deviceId: string,
  accountKey: string | null,
  timestamp: number,
  activityType: string | null,
  lat: number,
  lng: number
): Promise<{
  routeId: number;
  createdNew: boolean;
  lateSample: null | {
    previousTimestamp: number;
    sampleTimestamp: number;
    deltaMs: number;
    movedMeters: number;
    decision: 'reattach_previous_route';
  };
}> {
  const previous = await db
    .prepare(
      `SELECT p.route_id, p.timestamp, p.lat, p.lng, p.activity_type,
              r.status AS route_status, r.started_at AS route_started_at
       FROM passive_locations p
       LEFT JOIN routes r ON r.id = p.route_id
       WHERE p.route_id IS NOT NULL
         AND (
           (p.account_key IS NOT NULL AND p.account_key = ?)
           OR
           (p.account_key IS NULL AND p.device_id = ?)
         )
       ORDER BY p.timestamp DESC
       LIMIT 1`
    )
    .bind(accountKey, deviceId)
    .first<{
      route_id: number;
      timestamp: number;
      lat: number;
      lng: number;
      activity_type: string | null;
      route_status: string | null;
      route_started_at: number | null;
    }>();

  if (!previous || !Number.isFinite(previous.route_id) || !Number.isFinite(previous.timestamp)) {
    const routeId = await createPassiveRoute(db, timestamp, accountKey, deviceId);
    return { routeId, createdNew: true, lateSample: null };
  }

  const movedMeters = haversineMeters(
    Number(previous.lat), Number(previous.lng), lat, lng
  );

  // Out-of-order sample → reattach to same route
  if (timestamp < previous.timestamp) {
    return {
      routeId: previous.route_id,
      createdNew: false,
      lateSample: {
        previousTimestamp: Number(previous.timestamp),
        sampleTimestamp: Number(timestamp),
        deltaMs: Math.max(0, Number(previous.timestamp) - Number(timestamp)),
        movedMeters: Number.isFinite(movedMeters) ? movedMeters : 0,
        decision: 'reattach_previous_route',
      },
    };
  }

  const deltaMs = timestamp - Number(previous.timestamp);
  const routeDurationMs = timestamp - Number(previous.route_started_at ?? previous.timestamp);
  const sameUtcDay = !isDifferentUtcDay(Number(previous.timestamp), timestamp);
  const prevStatus = String(previous.route_status || '').toLowerCase();

  // Re-open a same-day closed route (e.g. app restart)
  if (prevStatus === 'closed' && sameUtcDay && deltaMs < STILL_SPLIT_DWELL_MS * 2) {
    await db.prepare(`UPDATE routes SET status = 'open' WHERE id = ?`)
      .bind(previous.route_id).run();
    return { routeId: previous.route_id, createdNew: false, lateSample: null };
  }

  // Split conditions (ordered by priority):
  // 1. Device was STILL long enough → treat as a stay, new trip starts
  const prevStill = isStillType(previous.activity_type);
  if (prevStill && deltaMs > STILL_SPLIT_DWELL_MS) {
    await closePreviousRoute(db, previous.route_id, Number(previous.timestamp));
    const routeId = await createPassiveRoute(db, timestamp, accountKey, deviceId);
    return { routeId, createdNew: true, lateSample: null };
  }

  // 2. Route too long
  if (routeDurationMs > PASSIVE_MAX_ROUTE_DURATION_MS) {
    await closePreviousRoute(db, previous.route_id, Number(previous.timestamp));
    const routeId = await createPassiveRoute(db, timestamp, accountKey, deviceId);
    return { routeId, createdNew: true, lateSample: null };
  }

  // 3. Different UTC day
  if (!sameUtcDay) {
    await closePreviousRoute(db, previous.route_id, Number(previous.timestamp));
    const routeId = await createPassiveRoute(db, timestamp, accountKey, deviceId);
    return { routeId, createdNew: true, lateSample: null };
  }

  return { routeId: previous.route_id, createdNew: false, lateSample: null };
}

// ── Stay / place-visit helpers ────────────────────────────────────────────────

/**
 * Server-side stay detection runs in parallel to the Android StayPointDetector.
 * Having it here means the backend stays consistent even if the app is
 * reinstalled, the device changes, or client-side state is lost.
 *
 * When a new passive_location comes in as STILL, we check whether it extends
 * an open stay or closes the previous one and starts a new cluster.
 */
async function upsertStayVisit(
  db: D1Database,
  accountKey: string | null,
  deviceId: string,
  lat: number,
  lng: number,
  timestamp: number
): Promise<void> {
  try {
    const openStay = await db
      .prepare(
        `SELECT id, centroid_lat, centroid_lng, arrival_ms, last_fix_ms, fix_count
         FROM place_visits
         WHERE status = 'open'
           AND (
             (account_key IS NOT NULL AND account_key = ?)
             OR
             (account_key IS NULL AND device_id = ?)
           )
         ORDER BY arrival_ms DESC
         LIMIT 1`
      )
      .bind(accountKey, deviceId)
      .first<{
        id: number;
        centroid_lat: number;
        centroid_lng: number;
        arrival_ms: number;
        last_fix_ms: number;
        fix_count: number;
      }>();

    if (!openStay) {
      // No open stay → create one
      await db
        .prepare(
          `INSERT INTO place_visits
             (account_key, device_id, centroid_lat, centroid_lng,
              arrival_ms, last_fix_ms, fix_count, status)
           VALUES (?, ?, ?, ?, ?, ?, 1, 'open')`
        )
        .bind(accountKey, deviceId, lat, lng, timestamp, timestamp)
        .run();
      return;
    }

    const centLat = Number(openStay.centroid_lat);
    const centLng = Number(openStay.centroid_lng);
    const distFromCentroid = haversineMeters(centLat, centLng, lat, lng);
    const gapMs = timestamp - Number(openStay.last_fix_ms);

    // Gap too large → close the old stay, open a new one
    if (gapMs > STAY_MAX_GAP_MS) {
      await closeStayVisit(db, openStay.id, Number(openStay.last_fix_ms), accountKey, deviceId);
      await db
        .prepare(
          `INSERT INTO place_visits
             (account_key, device_id, centroid_lat, centroid_lng,
              arrival_ms, last_fix_ms, fix_count, status)
           VALUES (?, ?, ?, ?, ?, ?, 1, 'open')`
        )
        .bind(accountKey, deviceId, lat, lng, timestamp, timestamp)
        .run();
      return;
    }

    // Drifted out of cluster → close old stay, open new one
    if (distFromCentroid > STAY_CLUSTER_RADIUS_M) {
      await closeStayVisit(db, openStay.id, Number(openStay.last_fix_ms), accountKey, deviceId);
      await db
        .prepare(
          `INSERT INTO place_visits
             (account_key, device_id, centroid_lat, centroid_lng,
              arrival_ms, last_fix_ms, fix_count, status)
           VALUES (?, ?, ?, ?, ?, ?, 1, 'open')`
        )
        .bind(accountKey, deviceId, lat, lng, timestamp, timestamp)
        .run();
      return;
    }

    // Still within cluster → update running centroid (incremental average)
    const n = Number(openStay.fix_count);
    const newCentLat = (centLat * n + lat) / (n + 1);
    const newCentLng = (centLng * n + lng) / (n + 1);
    await db
      .prepare(
        `UPDATE place_visits
         SET centroid_lat = ?, centroid_lng = ?, last_fix_ms = ?, fix_count = fix_count + 1
         WHERE id = ?`
      )
      .bind(newCentLat, newCentLng, timestamp, openStay.id)
      .run();
  } catch (err) {
    // Never let stay detection break passive ingest
    console.warn('upsertStayVisit failed', err);
  }
}

/**
 * Close an open stay visit. If it is too short to be meaningful, delete it.
 * Otherwise finalize it and run frequency-based place labeling.
 */
async function closeStayVisit(
  db: D1Database,
  visitId: number,
  departureMs: number,
  accountKey: string | null,
  deviceId: string
): Promise<void> {
  const visit = await db
    .prepare('SELECT id, centroid_lat, centroid_lng, arrival_ms FROM place_visits WHERE id = ?')
    .bind(visitId)
    .first<{ id: number; centroid_lat: number; centroid_lng: number; arrival_ms: number }>();
  if (!visit) return;

  const durationMs = departureMs - Number(visit.arrival_ms);
  if (durationMs < STAY_MIN_DURATION_MS) {
    await db.prepare('DELETE FROM place_visits WHERE id = ?').bind(visitId).run();
    return;
  }

  await db
    .prepare(
      `UPDATE place_visits
       SET status = 'closed', departure_ms = ?, duration_ms = ?
       WHERE id = ?`
    )
    .bind(departureMs, durationMs, visitId)
    .run();

  // Frequency-based labeling
  await updatePlaceLabel(
    db,
    accountKey,
    deviceId,
    Number(visit.centroid_lat),
    Number(visit.centroid_lng),
    visitId
  );
}

/**
 * Find or create a place_label cluster and increment its visit count.
 * Auto-upgrades to "frequent" once threshold is reached.
 */
async function updatePlaceLabel(
  db: D1Database,
  accountKey: string | null,
  deviceId: string,
  lat: number,
  lng: number,
  visitId: number
): Promise<void> {
  try {
    const latDelta = STAY_LABEL_CLUSTER_RADIUS_M / 111_000;
    const lngDelta = STAY_LABEL_CLUSTER_RADIUS_M / (111_000 * Math.cos(toRad(lat)));

    const nearby = await db
      .prepare(
        `SELECT id, centroid_lat, centroid_lng, visit_count
         FROM place_labels
         WHERE (account_key IS NOT NULL AND account_key = ? OR account_key IS NULL AND device_id = ?)
           AND centroid_lat BETWEEN ? AND ?
           AND centroid_lng BETWEEN ? AND ?
         ORDER BY visit_count DESC
         LIMIT 10`
      )
      .bind(accountKey, deviceId, lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta)
      .all<{ id: number; centroid_lat: number; centroid_lng: number; visit_count: number }>();

    let labelId: number | null = null;
    for (const row of (nearby.results || [])) {
      if (haversineMeters(Number(row.centroid_lat), Number(row.centroid_lng), lat, lng)
          <= STAY_LABEL_CLUSTER_RADIUS_M) {
        const newCount = Number(row.visit_count) + 1;
        const autoLabel = newCount >= STAY_AUTO_LABEL_MIN_VISITS ? 'frequent' : 'new';
        await db
          .prepare(
            `UPDATE place_labels
             SET visit_count = ?, auto_label = ?, last_seen_ms = ?
             WHERE id = ?`
          )
          .bind(newCount, autoLabel, Date.now(), row.id)
          .run();
        labelId = row.id;
        break;
      }
    }

    if (labelId === null) {
      const ins = await db
        .prepare(
          `INSERT INTO place_labels
             (account_key, device_id, centroid_lat, centroid_lng,
              name, auto_label, visit_count, first_seen_ms, last_seen_ms)
           VALUES (?, ?, ?, ?, '', 'new', 1, ?, ?)`
        )
        .bind(accountKey, deviceId, lat, lng, Date.now(), Date.now())
        .run();
      labelId = Number(ins.meta.last_row_id);
    }

    if (labelId) {
      await db
        .prepare('UPDATE place_visits SET label_id = ? WHERE id = ?')
        .bind(labelId, visitId)
        .run();
    }
  } catch (err) {
    console.warn('updatePlaceLabel failed', err);
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

locationSync.get('/test', (c) => c.json({ test: 'test' }));

// ── fetchAll ──────────────────────────────────────────────────────────────────

/**
 * FIX: Added requireBearerAuth. Previously returned full DB to anonymous callers.
 * Now scoped to the caller's own accountKey derived from the Bearer token.
 */
locationSync.get('/fetchAll', requireBearerAuth, async (c) => {
  const callerKey = c.get('authToken') as string;
  const deviceId = asSafeKey(c.req.query('deviceId'));
  const sinceRaw = Number(c.req.query('since') || 0);
  const since = isValidTimestamp(sinceRaw) ? sinceRaw : 0;
  const limitRaw = Number(c.req.query('limit') || 500);
  const limit = Math.max(1, Math.min(2000, Math.floor(limitRaw)));
  const routeIdRaw = Number(c.req.query('routeId') || 0);
  const routeId = Number.isFinite(routeIdRaw) && routeIdRaw > 0 ? Math.floor(routeIdRaw) : 0;
  const pointsLimitRaw = Number(c.req.query('pointsLimit') || 0);
  const pointsLimit = Number.isFinite(pointsLimitRaw)
    ? Math.max(1, Math.min(5000, Math.floor(pointsLimitRaw)))
    : limit;
  const includeRoutes = isParamEnabled(c.req.query('includeRoutes'), true);
  const includePassive = isParamEnabled(c.req.query('includePassive'), true);
  const includeGeofences = isParamEnabled(c.req.query('includeGeofences'), true);
  const includePoints = isParamEnabled(c.req.query('includePoints'), true);
  const cursorTsRaw = Number(c.req.query('cursorTs') || 0);
  const cursorIdRaw = Number(c.req.query('cursorId') || 0);
  const cursorTs = isValidTimestamp(cursorTsRaw) ? cursorTsRaw : 0;
  const cursorId = Number.isFinite(cursorIdRaw) && cursorIdRaw > 0 ? Math.floor(cursorIdRaw) : 0;

  const db = c.env.RouteDB;

  // Always scope to the authenticated caller's account key.
  // If they additionally filter by deviceId, intersect both.
  const scopeClause = deviceId
    ? '(account_key = ? AND device_id = ?)'
    : 'account_key = ?';
  const scopeBinds: (string | number)[] = deviceId
    ? [callerKey, deviceId]
    : [callerKey];

  const cursorClause =
    cursorTs > 0 && cursorId > 0 && !routeId
      ? ' AND (timestamp > ? OR (timestamp = ? AND id > ?))'
      : '';
  const baseWhereClause = `WHERE ${scopeClause} AND timestamp >= ?${cursorClause}`;
  const baseBinds: (string | number)[] = cursorClause
    ? [...scopeBinds, since, cursorTs, cursorTs, cursorId]
    : [...scopeBinds, since];

  const [routes, passive, geofences, points] = await Promise.all([
    includeRoutes
      ? db
          .prepare(
            `SELECT id, timestamp, source, account_key, device_id,
                    started_at, ended_at, status, point_count, distance_meters, last_point_at
             FROM routes
             WHERE ${scopeClause}
             ORDER BY started_at DESC
             LIMIT ?`
          )
          .bind(...scopeBinds, limit)
          .all()
      : Promise.resolve({ results: [] }),
    includePassive
      ? routeId
        ? db
            .prepare(
              `SELECT id, lat, lng, timestamp, route_id, activity_type,
                      activity_confidence, acc, vel, reason, trigger
               FROM passive_locations
               WHERE ${scopeClause} AND route_id = ?
               ORDER BY timestamp ASC, id ASC
               LIMIT ?`
            )
            .bind(...scopeBinds, routeId, pointsLimit || limit)
            .all()
        : db
            .prepare(
              `SELECT id, lat, lng, timestamp, route_id, activity_type,
                      activity_confidence, acc, vel, reason, trigger
               FROM passive_locations
               ${baseWhereClause}
               ORDER BY timestamp ASC, id ASC
               LIMIT ?`
            )
            .bind(...baseBinds, limit)
            .all()
      : Promise.resolve({ results: [] }),
    includeGeofences
      ? db
          .prepare(`SELECT * FROM geofences WHERE ${scopeClause} LIMIT 200`)
          .bind(...scopeBinds)
          .all()
      : Promise.resolve({ results: [] }),
    includePoints && routeId
      ? db
          .prepare(
            `SELECT p.id, p.routeId, p.lat, p.lng, p.timestamp
             FROM points p
             INNER JOIN routes r ON r.id = p.routeId
             WHERE p.routeId = ? AND r.account_key = ?
             ORDER BY p.timestamp ASC
             LIMIT ?`
          )
          .bind(routeId, callerKey, pointsLimit)
          .all()
      : Promise.resolve({ results: [] }),
  ]);

  const passiveRows = passive.results || [];
  const lastPassive = passiveRows.length ? passiveRows[passiveRows.length - 1] : null;
  const passiveCursor =
    includePassive && !routeId && passiveRows.length >= limit && lastPassive
      ? { ts: Number((lastPassive as any).timestamp || 0), id: Number((lastPassive as any).id || 0) }
      : null;

  return c.json({
    routes: routes.results,
    passive_locations: passiveRows,
    geofences: geofences.results,
    points: points.results,
    passiveCursor,
  });
});

// ── /live ─────────────────────────────────────────────────────────────────────

/**
 * FIX: Added requireBearerAuth. Scoped to caller's own account.
 * Previously returned all device locations from all accounts to any caller.
 */
locationSync.get('/live', requireBearerAuth, async (c) => {
  const callerKey = c.get('authToken') as string;
  const windowMinutesRaw = Number(c.req.query('windowMinutes') || 720);
  const windowMinutes = Number.isFinite(windowMinutesRaw)
    ? Math.max(5, Math.min(7 * 24 * 60, Math.floor(windowMinutesRaw)))
    : 720;
  const cutoffTs = Date.now() - windowMinutes * 60 * 1000;

  const result = await c.env.RouteDB.prepare(
    `SELECT p.id, p.device_id, p.account_key, p.lat, p.lng,
            COALESCE(p.received_at, p.timestamp) AS timestamp,
            p.timestamp AS sample_timestamp,
            p.route_id
     FROM passive_locations p
     INNER JOIN (
       SELECT device_id,
              MAX(COALESCE(received_at, timestamp)) AS latest_ts
       FROM passive_locations
       WHERE account_key = ?
         AND COALESCE(received_at, timestamp) >= ?
       GROUP BY device_id
     ) latest
       ON latest.device_id = p.device_id
      AND latest.latest_ts = COALESCE(p.received_at, p.timestamp)
     WHERE p.account_key = ?
     ORDER BY COALESCE(p.received_at, p.timestamp) DESC`
  )
    .bind(callerKey, cutoffTs, callerKey)
    .all();

  const rows = Array.isArray(result?.results) ? result.results : [];
  const devices = rows.map((row: any) => ({
    id: Number(row.id),
    deviceId: String(row.device_id || ''),
    accountKey: String(row.account_key || ''),
    lat: Number(row.lat),
    lng: Number(row.lng),
    timestamp: Number(row.timestamp),
    sampleTimestamp: row.sample_timestamp == null ? null : Number(row.sample_timestamp),
    routeId: row.route_id == null ? null : Number(row.route_id),
  }));

  return c.json({ success: true, windowMinutes, cutoffTs, devices });
});

// ── /events ───────────────────────────────────────────────────────────────────

/** FIX: Added requireBearerAuth + account-scoped query. */
locationSync.get('/events', requireBearerAuth, async (c) => {
  const callerKey = c.get('authToken') as string;
  const limitRaw = Number(c.req.query('limit') || 80);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(300, Math.floor(limitRaw))) : 80;

  const rows = await c.env.RouteDB
    .prepare(
      `SELECT id, event_type, source, route_id, account_key, device_id, timestamp, payload
       FROM tracking_events
       WHERE account_key = ?
       ORDER BY timestamp DESC
       LIMIT ?`
    )
    .bind(callerKey, limit)
    .all();

  return c.json({ success: true, events: Array.isArray(rows?.results) ? rows.results : [] });
});

// ── /api-logs ─────────────────────────────────────────────────────────────────

/** FIX: Added requireBearerAuth + auth_subject scoping. */
locationSync.get('/api-logs', requireBearerAuth, async (c) => {
  const callerKey = c.get('authToken') as string;
  const limitRaw = Number(c.req.query('limit') || 120);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 120;
  const methodRaw = String(c.req.query('method') || '').trim().toUpperCase();
  const method = methodRaw && /^[A-Z]{3,12}$/.test(methodRaw) ? methodRaw : null;

  const whereParts: string[] = ['auth_subject = ?'];
  const binds: Array<string | number> = [callerKey];

  if (method) {
    whereParts.push('method = ?');
    binds.push(method);
  }

  const sql = `SELECT id, request_id, method, path, query, status, duration_ms,
                      timestamp, ip, user_agent, error
               FROM api_access_logs
               WHERE ${whereParts.join(' AND ')}
               ORDER BY timestamp DESC
               LIMIT ?`;
  binds.push(limit);

  const rows = await c.env.RouteDB.prepare(sql).bind(...binds).all();
  return c.json({ success: true, logs: Array.isArray(rows?.results) ? rows.results : [] });
});

// ── /logs/upload ──────────────────────────────────────────────────────────────

locationSync.post('/logs/upload', async (c) => {
  const rawBody = await c.req.text();
  let body: any = {};
  try { body = rawBody ? JSON.parse(rawBody) : {}; } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const db = c.env.RouteDB;
  const bearerToken = getBearerToken(c.req.header('Authorization'));
  const bearerKey = bearerToken ? await resolveAccountKeyFromToken(c, bearerToken) : null;
  const payloadAccountKey = asSafeKey(body?.accountKey);
  const accountKey = payloadAccountKey || bearerKey;
  const deviceId = asSafeKey(body?.deviceId);
  const logs = Array.isArray(body?.logs) ? body.logs : [];

  if (!logs.length) {
    return c.json({ success: false, error: 'logs must be a non-empty array' }, 400);
  }

  // Validate the auth token matches the payload accountKey (same check as /sync)
  if (accountKey && bearerToken && bearerKey !== accountKey) {
    return c.json({ success: false, error: 'Authorization mismatch' }, 401);
  }

  const limitedLogs = logs.slice(0, 300);
  let insertedCount = 0;
  const authSubject = accountKey || deviceId || 'plugin';

  for (const row of limitedLogs) {
    const source = typeof row?.source === 'string' && row.source.trim()
      ? row.source.trim().slice(0, 64) : 'plugin';
    const level = typeof row?.level === 'string' && row.level.trim()
      ? row.level.trim().toUpperCase().slice(0, 24) : 'INFO';
    const message = (typeof row?.message === 'string' ? row.message : '').slice(0, 2000);
    const timestamp = isValidTimestamp(row?.timestamp) ? Number(row.timestamp) : Date.now();
    await db
      .prepare(
        `INSERT INTO api_access_logs
           (request_id, method, path, query, status, duration_ms, timestamp,
            ip, user_agent, cf_ray, request_bytes, response_bytes, auth_subject, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(), 'PLUGIN', `/plugin/${source.toLowerCase().slice(0, 32)}`,
        `level=${encodeURIComponent(level)}`, 200, 0, timestamp,
        null, null, null, message.length, null, authSubject, message
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

// ── /sync POST ────────────────────────────────────────────────────────────────

locationSync.post('/sync', async (c) => {
  const rawBody = await c.req.text();
  let body: any = {};
  try { body = rawBody ? JSON.parse(rawBody) : {}; } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const table   = body?.table;
  const changes = Array.isArray(body?.changes) ? body.changes : [];
  const idMap: Record<number, number> = {};
  const insertedIds: number[] = [];
  const bearerToken = getBearerToken(c.req.header('Authorization'));
  const payloadSig  = c.req.header('X-Payload-Sig');
  const bearerKey = bearerToken ? await resolveAccountKeyFromToken(c, bearerToken) : null;
  const db = c.env.RouteDB;

  // ── routes table ──────────────────────────────────────────────────────────
  if (table === 'routes') {
    for (const row of changes) {
      const tempId     = row.id;
      const source     = String(row?.source || 'UNKNOWN').toUpperCase();
      const accountKey = asSafeKey(row?.accountKey);
      const deviceId   = asSafeKey(row?.deviceId);
      const startedAt  = isValidTimestamp(row?.startedAt) ? Number(row.startedAt) : Number(row?.timestamp || Date.now());
      const endedAt    = isValidTimestamp(row?.endedAt) ? Number(row.endedAt) : null;

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
          await insertTrackingEvent(db, 'ACTIVE_ROUTE_STARTED', 'ACTIVE',
            Number(row?.timestamp || Date.now()), Number(newId), accountKey, deviceId,
            { routeId: newId });
        }
      }
    }
    return c.json({ success: true, ids: insertedIds, idMap });
  }

  // ── points table ──────────────────────────────────────────────────────────
  if (table === 'points') {
    for (const row of changes) {
      const routeRef   = row.route_id ?? row.routeId;
      const realRouteId = idMap[routeRef] ?? routeRef;
      let source     = String(row?.source || 'UNKNOWN').toUpperCase();
      let accountKey = asSafeKey(row?.accountKey);
      let deviceId   = asSafeKey(row?.deviceId);

      if (source === 'UNKNOWN' && Number.isFinite(Number(realRouteId))) {
        const routeMeta = await db
          .prepare('SELECT source, account_key, device_id FROM routes WHERE id = ? LIMIT 1')
          .bind(realRouteId)
          .first<{ source: string; account_key: string | null; device_id: string | null }>();
        if (routeMeta?.source) source = String(routeMeta.source).toUpperCase();
        if (!accountKey) accountKey = asSafeKey(routeMeta?.account_key);
        if (!deviceId)   deviceId   = asSafeKey(routeMeta?.device_id);
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
          const previous  = await db
            .prepare(
              `SELECT lat, lng FROM points
               WHERE routeId = ? AND id != ? AND timestamp <= ?
               ORDER BY timestamp DESC LIMIT 1`
            )
            .bind(Number(realRouteId), result.meta.last_row_id, timestamp)
            .first<{ lat: number; lng: number }>();
          const distanceDelta = previous && Number.isFinite(previous.lat) && Number.isFinite(previous.lng)
            ? haversineMeters(Number(previous.lat), Number(previous.lng), Number(row.lat), Number(row.lng))
            : 0;
          await tryUpdateRouteRollup(db, Number(realRouteId), timestamp, distanceDelta);
        }
      }
    }
    return c.json({ success: true, ids: insertedIds });
  }

  // ── passive_locations table ───────────────────────────────────────────────
  if (table === 'passive_locations') {
    let insertedCount = 0;
    let dedupedCount  = 0;
    let rejectedCount = 0;
    let authRejectedCount = 0;
    let signatureRejectedCount = 0;

    // FIX: Rate limit per sync call to prevent unbounded writes
    const cappedChanges = changes.slice(0, MAX_SAMPLES_PER_SYNC);

    for (const row of cappedChanges) {
      const lat       = row?.lat;
      const lng       = row?.lng;
      const timestamp = row?.timestamp;
      const deviceId  = row?.deviceId;
      let accountKey  = asSafeKey(row?.accountKey);
      const sampleHash = row?.sampleHash;
      const activityType  = typeof row?.activityType === 'string' ? row.activityType : null;
      const activityConfidence = isFiniteNumber(row?.activityConfidence) ? Number(row.activityConfidence) : null;
      const reason   = typeof row?.reason === 'string' ? row.reason : null;
      const acc      = isFiniteNumber(row?.acc) ? Number(row.acc) : null;
      const vel      = isFiniteNumber(row?.vel) ? Number(row.vel) : null;
      const cog      = isFiniteNumber(row?.cog) ? Number(row.cog) : null;
      const alt      = isFiniteNumber(row?.alt) ? Number(row.alt) : null;
      const provider = typeof row?.provider === 'string' ? row.provider : null;
      const trigger  = typeof row?.trigger === 'string' ? row.trigger : null;

      if (!isFiniteNumber(lat) || lat < -90 || lat > 90)   { rejectedCount++; continue; }
      if (!isFiniteNumber(lng) || lng < -180 || lng > 180) { rejectedCount++; continue; }
      if (!isValidTimestamp(timestamp))                     { rejectedCount++; continue; }
      if (!isSafeDeviceId(deviceId))                       { rejectedCount++; continue; }

      // ── Auth ──────────────────────────────────────────────────────────────
      //
      // FIX (critical): Original had a path where enforceAuth=false meant
      // zero auth checks — anonymous submissions were fully accepted.
      // New rule: if a Bearer token is present, always enforce it.
      // If no Bearer token AND no accountKey, try to resolve from device_tokens
      // for backward-compat, but still validate sampleHash.
      //
      const hasAuthHeader = !!bearerToken;

      if (hasAuthHeader) {
        // Authenticated path: verify token matches accountKey in payload
        if (!bearerKey) { authRejectedCount++; continue; }
        if (!accountKey) accountKey = bearerKey;
        if (!accountKey || bearerKey !== accountKey) {
          authRejectedCount++;
          continue;
        }

        // FIX: Add timestamp to HMAC input to prevent replay attacks.
        // New sig = HMAC(body + '|' + requestTimestamp, accountKey)
        // For backward compat, also accept HMAC(body, accountKey) if the new
        // sig fails (allows old app versions to keep syncing temporarily).
        const requestTs = c.req.header('X-Request-Ts') || '';
        const expectedSigNew = requestTs
          ? await hmacSha256Hex(rawBody + '|' + requestTs, accountKey)
          : null;
        const expectedSigLegacy = await hmacSha256Hex(rawBody, accountKey);

        const sigOk =
          (payloadSig && expectedSigNew && payloadSig.toLowerCase() === expectedSigNew.toLowerCase())
          || (payloadSig && payloadSig.toLowerCase() === expectedSigLegacy.toLowerCase());

        if (!payloadSig || !sigOk) {
          signatureRejectedCount++;
          continue;
        }

        // Device token bootstrap / validation
        let tokenOk = await isDeviceTokenValid(db, accountKey, deviceId);
        if (!tokenOk) {
          try {
            await db
              .prepare(
                `INSERT INTO device_tokens (account_key, device_id, label, last_seen_at, created_at, revoked)
                 VALUES (?, ?, ?, ?, ?, 0)
                 ON CONFLICT(account_key, device_id) DO UPDATE SET revoked = 0`
              )
              .bind(accountKey, deviceId, null, Date.now(), Date.now())
              .run();
          } catch (err) {
            console.warn('device_token_bootstrap_failed', err);
          }
          tokenOk = await isDeviceTokenValid(db, accountKey, deviceId);
        }
        if (!tokenOk) { authRejectedCount++; continue; }

      } else {
        // No auth header → try resolving accountKey from existing device_tokens
        if (!accountKey) {
          const resolved = await resolveAccountKeyForDevice(db, deviceId);
          if (resolved) accountKey = resolved;
        }
        // No accountKey at all → still accept but store without one (legacy compat)
      }

      // ── Sample hash validation ────────────────────────────────────────────
      const expectedHash = await sha256Hex(
        `${deviceId}|${timestamp}|${normalizeCoord(lat)}|${normalizeCoord(lng)}`
      );
      if (typeof sampleHash !== 'string' || sampleHash !== expectedHash) {
        rejectedCount++;
        continue;
      }

      // ── Dedup ─────────────────────────────────────────────────────────────
      const existing = await db
        .prepare('SELECT id FROM passive_locations WHERE sample_hash = ? LIMIT 1')
        .bind(sampleHash)
        .first<{ id: number }>();
      if (existing) {
        dedupedCount++;
        await db
          .prepare('UPDATE passive_locations SET received_at = ?, retained_until = ? WHERE id = ?')
          .bind(Date.now(), Date.now() + PASSIVE_RETENTION_MS, existing.id)
          .run();
        continue;
      }

      // ── Route allocation ──────────────────────────────────────────────────
      let routeId: number;
      let createdNew = false;
      let lateSample: null | Record<string, unknown> = null;
      try {
        const routeResult = await getPassiveRouteId(
          db, deviceId, accountKey, timestamp, activityType, lat, lng
        );
        routeId    = routeResult.routeId;
        createdNew = routeResult.createdNew;
        lateSample = routeResult.lateSample;
      } catch (routeErr) {
        routeId    = await createPassiveRoute(db, timestamp, accountKey, deviceId);
        createdNew = true;
        await insertTrackingEvent(db, 'PASSIVE_ROUTE_FALLBACK', 'PASSIVE',
          timestamp, routeId, accountKey, deviceId,
          { reason: 'route_allocator_error', error: String(routeErr || 'unknown') });
      }

      // ── Insert ────────────────────────────────────────────────────────────
      const result = await db
        .prepare(
          `INSERT INTO passive_locations
             (lat, lng, timestamp, device_id, account_key, sample_hash, received_at, route_id,
              activity_type, activity_confidence, reason, acc, vel, cog, alt, provider, trigger, retained_until)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(sample_hash) DO NOTHING`
        )
        .bind(lat, lng, timestamp, deviceId, accountKey, sampleHash,
          Date.now(), routeId, activityType, activityConfidence,
          reason, acc, vel, cog, alt, provider, trigger,
          Date.now() + PASSIVE_RETENTION_MS)
        .run();

      if (result.success && Number(result.meta.changes || 0) > 0) {
        insertedCount++;
        insertedIds.push(result.meta.last_row_id);

        const previous = await db
          .prepare(
            `SELECT lat, lng, timestamp FROM passive_locations
             WHERE route_id = ? AND id != ? AND timestamp <= ?
             ORDER BY timestamp DESC LIMIT 1`
          )
          .bind(routeId, result.meta.last_row_id, timestamp)
          .first<{ lat: number; lng: number; timestamp: number }>();
        const distanceDelta = previous && Number.isFinite(previous.lat) && Number.isFinite(previous.lng)
          ? haversineMeters(Number(previous.lat), Number(previous.lng), Number(lat), Number(lng))
          : 0;

        await tryUpdateRouteRollup(db, routeId, Number(timestamp), distanceDelta);
        await closeOtherOpenPassiveRoutes(db, routeId, Number(timestamp), accountKey, deviceId);
        await touchDeviceTokenSeenAt(db, accountKey, deviceId);

        // FIX: Removed duplicate insert into points table.
        // Original code inserted every passive_location into points as well,
        // meaning every passive fix was stored twice. passive_locations IS the
        // canonical passive store; points is for explicitly recorded active-route points.

        // Stay / place visit detection — only run on STILL fixes
        if (isStillType(activityType)) {
          await upsertStayVisit(db, accountKey, deviceId, lat, lng, timestamp);
        } else if (isMovingType(activityType)) {
          // Moving fix → close any open stay for this device (it has left)
          try {
            const openStay = await db
              .prepare(
                `SELECT id, last_fix_ms FROM place_visits
                 WHERE status = 'open'
                   AND (account_key = ? OR (account_key IS NULL AND device_id = ?))
                 LIMIT 1`
              )
              .bind(accountKey, deviceId)
              .first<{ id: number; last_fix_ms: number }>();
            if (openStay) {
              await closeStayVisit(db, openStay.id, Number(openStay.last_fix_ms), accountKey, deviceId);
            }
          } catch { /* never block ingest */ }
        }

        if (lateSample) {
          await insertTrackingEvent(db, 'PASSIVE_LATE_SAMPLE', 'PASSIVE',
            timestamp, routeId, accountKey, deviceId, lateSample);
        }
        if (createdNew) {
          await insertTrackingEvent(db, 'PASSIVE_ROUTE_STARTED', 'PASSIVE',
            timestamp, routeId, accountKey, deviceId,
            { reason: reason || 'passive_ingest' });
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

  // ── geofences table ───────────────────────────────────────────────────────
  if (table === 'geofences') {
    for (const row of changes) {
      const now        = Date.now();
      const name       = String(row?.name || '').trim();
      const lat        = Number(row?.lat);
      const lng        = Number(row?.lng);
      const radius     = Number(row?.radius);
      const enabled    = row?.enabled === false || Number(row?.enabled) === 0 ? 0 : 1;
      const accountKey = asSafeKey(row?.accountKey);
      const deviceId   = asSafeKey(row?.deviceId);
      const lastState  = String(row?.lastState || 'outside').toLowerCase() === 'inside' ? 'inside' : 'outside';
      const lastTransitionAt = isValidTimestamp(row?.lastTransitionAt) ? Number(row.lastTransitionAt) : null;
      const providedId = Number(row?.id);

      if (!name || !isFiniteNumber(lat) || lat < -90 || lat > 90) continue;
      if (!isFiniteNumber(lng) || lng < -180 || lng > 180) continue;
      if (!isFiniteNumber(radius) || radius < 25 || radius > 5000) continue;
      if (!accountKey && !deviceId) continue;

      if (Number.isFinite(providedId) && providedId > 0) {
        const existing = await db
          .prepare(
            `SELECT id FROM geofences
             WHERE id = ? AND (
               (account_key IS NOT NULL AND account_key = ?)
               OR (account_key IS NULL AND device_id = ?)
             ) LIMIT 1`
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
            .bind(name, lat, lng, radius, enabled, accountKey, deviceId,
              lastState, lastTransitionAt, now, providedId)
            .run();
          insertedIds.push(providedId);
          continue;
        }
      }

      const result = await db
        .prepare(
          `INSERT INTO geofences
             (name, lat, lng, radius, enabled, account_key, device_id,
              last_state, last_transition_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(name, lat, lng, radius, enabled, accountKey, deviceId,
          lastState, lastTransitionAt, now, now)
        .run();
      if (result.success) insertedIds.push(Number(result.meta.last_row_id));
    }
    return c.json({ success: true, ids: insertedIds });
  }

  return c.json({ error: 'Invalid table' }, 400);
});

// ── /sync DELETE ──────────────────────────────────────────────────────────────

/**
 * FIX: Added requireBearerAuth + ownership check.
 * Original allowed any caller to delete any row by id with no auth at all.
 */
locationSync.delete('/sync', requireBearerAuth, async (c) => {
  const callerKey = c.get('authToken') as string;
  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { table, id } = body;
  const safeId = Number(id);
  if (!Number.isFinite(safeId) || safeId <= 0) {
    return c.json({ error: 'Invalid id' }, 400);
  }

  const db = c.env.RouteDB;

  // Ownership check before deleting anything
  if (table === 'routes') {
    const row = await db
      .prepare('SELECT account_key FROM routes WHERE id = ? LIMIT 1')
      .bind(safeId).first<{ account_key: string | null }>();
    if (!row || row.account_key !== callerKey) return c.json({ error: 'Not found' }, 404);
    await db.prepare('DELETE FROM points WHERE routeId = ?').bind(safeId).run();
    await db.prepare('DELETE FROM passive_locations WHERE route_id = ?').bind(safeId).run();
    await db.prepare('DELETE FROM routes WHERE id = ?').bind(safeId).run();
  } else if (table === 'points') {
    const row = await db
      .prepare('SELECT account_key FROM points WHERE id = ? LIMIT 1')
      .bind(safeId).first<{ account_key: string | null }>();
    if (!row || row.account_key !== callerKey) return c.json({ error: 'Not found' }, 404);
    await db.prepare('DELETE FROM points WHERE id = ?').bind(safeId).run();
  } else if (table === 'passive_locations') {
    const row = await db
      .prepare('SELECT account_key FROM passive_locations WHERE id = ? LIMIT 1')
      .bind(safeId).first<{ account_key: string | null }>();
    if (!row || row.account_key !== callerKey) return c.json({ error: 'Not found' }, 404);
    await db.prepare('DELETE FROM passive_locations WHERE id = ?').bind(safeId).run();
  } else if (table === 'geofences') {
    const row = await db
      .prepare('SELECT account_key FROM geofences WHERE id = ? LIMIT 1')
      .bind(safeId).first<{ account_key: string | null }>();
    if (!row || row.account_key !== callerKey) return c.json({ error: 'Not found' }, 404);
    await db.prepare('DELETE FROM geofences WHERE id = ?').bind(safeId).run();
  } else {
    return c.json({ error: 'Invalid table' }, 400);
  }

  return c.json({ success: true });
});

// ── Timeline API ──────────────────────────────────────────────────────────────

/**
 * GET /timeline — returns merged place visits + trips for a time window.
 * This is the primary endpoint for a Life360 / Google Timeline UI.
 *
 * Query params:
 *   fromMs   – start of window (epoch ms)
 *   toMs     – end of window (epoch ms, defaults to now)
 *   limit    – max segments (default 200, max 1000)
 *   deviceId – optional, filter to one device
 *
 * Returns:
 *   {
 *     segments: [
 *       { segmentType: "place", arrivalMs, departureMs, durationMs,
 *         lat, lng, labelName, autoLabel, visitCount },
 *       { segmentType: "trip",  startMs, endMs, durationMs, routeId,
 *         distanceMeters, pointCount }
 *     ]
 *   }
 */
locationSync.get('/timeline', requireBearerAuth, async (c) => {
  const callerKey    = c.get('authToken') as string;
  const fromMs       = Math.max(0, Number(c.req.query('fromMs') || 0));
  const toMs         = Number(c.req.query('toMs') || Date.now());
  const limitRaw     = Number(c.req.query('limit') || 200);
  const limit        = Math.max(1, Math.min(1000, Math.floor(limitRaw)));
  const deviceId     = asSafeKey(c.req.query('deviceId'));

  const db = c.env.RouteDB;

  const deviceClause = deviceId ? 'AND device_id = ?' : '';
  const deviceBind   = deviceId ? [deviceId] : [];

  const [places, routes] = await Promise.all([
    db.prepare(
      `SELECT v.id, v.centroid_lat AS lat, v.centroid_lng AS lng,
              v.arrival_ms, v.departure_ms, v.duration_ms, v.fix_count,
              v.status, v.label_id,
              COALESCE(l.name, '') AS label_name,
              COALESCE(l.auto_label, 'new') AS auto_label,
              COALESCE(l.visit_count, 0) AS visit_count
       FROM place_visits v
       LEFT JOIN place_labels l ON l.id = v.label_id
       WHERE (v.account_key = ? ${deviceClause})
         AND v.arrival_ms >= ?
         AND v.arrival_ms <= ?
         AND v.status = 'closed'
       ORDER BY v.arrival_ms ASC
       LIMIT ?`
    )
      .bind(callerKey, ...deviceBind, fromMs, toMs, limit)
      .all(),
    db.prepare(
      `SELECT id, started_at, ended_at, status,
              COALESCE(distance_meters, 0) AS distance_meters,
              COALESCE(point_count, 0) AS point_count
       FROM routes
       WHERE account_key = ? ${deviceClause}
         AND source = 'PASSIVE'
         AND started_at >= ?
         AND started_at <= ?
       ORDER BY started_at ASC
       LIMIT ?`
    )
      .bind(callerKey, ...deviceBind, fromMs, toMs, limit)
      .all(),
  ]);

  // Merge into a single chronological segment list
  type Segment = { segmentType: string; startMs: number; [k: string]: unknown };
  const segments: Segment[] = [];

  for (const row of (places.results || [])) {
    segments.push({
      segmentType: 'place',
      startMs:     Number((row as any).arrival_ms),
      arrivalMs:   Number((row as any).arrival_ms),
      departureMs: (row as any).departure_ms != null ? Number((row as any).departure_ms) : null,
      durationMs:  (row as any).duration_ms  != null ? Number((row as any).duration_ms)  : null,
      lat:         Number((row as any).lat),
      lng:         Number((row as any).lng),
      fixCount:    Number((row as any).fix_count),
      labelId:     (row as any).label_id != null ? Number((row as any).label_id) : null,
      labelName:   String((row as any).label_name || ''),
      autoLabel:   String((row as any).auto_label || 'new'),
      visitCount:  Number((row as any).visit_count || 0),
    });
  }

  for (const row of (routes.results || [])) {
    segments.push({
      segmentType:    'trip',
      startMs:        Number((row as any).started_at),
      endMs:          (row as any).ended_at != null ? Number((row as any).ended_at) : null,
      durationMs:     (row as any).ended_at != null
        ? Number((row as any).ended_at) - Number((row as any).started_at)
        : null,
      routeId:        Number((row as any).id),
      distanceMeters: Number((row as any).distance_meters),
      pointCount:     Number((row as any).point_count),
      status:         String((row as any).status || ''),
    });
  }

  segments.sort((a, b) => a.startMs - b.startMs);
  const capped = segments.slice(0, limit);

  return c.json({
    success: true,
    fromMs,
    toMs,
    count: capped.length,
    segments: capped,
  });
});

// ── Place labels CRUD ─────────────────────────────────────────────────────────

/**
 * GET /places — returns all known place labels for the authenticated account.
 * Powers a "Your places" tab in the UI.
 */
locationSync.get('/places', requireBearerAuth, async (c) => {
  const callerKey = c.get('authToken') as string;
  const limitRaw  = Number(c.req.query('limit') || 100);
  const limit     = Math.max(1, Math.min(500, Math.floor(limitRaw)));

  const rows = await c.env.RouteDB
    .prepare(
      `SELECT id, centroid_lat, centroid_lng, name, auto_label,
              visit_count, first_seen_ms, last_seen_ms
       FROM place_labels
       WHERE account_key = ?
       ORDER BY visit_count DESC
       LIMIT ?`
    )
    .bind(callerKey, limit)
    .all();

  return c.json({ success: true, places: rows.results || [] });
});

/**
 * PATCH /places/:id — update the user-visible name of a place label.
 * Body: { name: string }
 */
locationSync.patch('/places/:id', requireBearerAuth, async (c) => {
  const callerKey = c.get('authToken') as string;
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: 'Invalid id' }, 400);

  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 128) : null;
  if (name === null) return c.json({ error: 'name is required' }, 400);

  const db = c.env.RouteDB;
  const row = await db
    .prepare('SELECT id FROM place_labels WHERE id = ? AND account_key = ? LIMIT 1')
    .bind(id, callerKey)
    .first<{ id: number }>();
  if (!row) return c.json({ error: 'Not found' }, 404);

  await db
    .prepare('UPDATE place_labels SET name = ? WHERE id = ?')
    .bind(name, id)
    .run();

  return c.json({ success: true });
});
