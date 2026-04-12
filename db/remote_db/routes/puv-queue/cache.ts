import type { D1Database } from '@cloudflare/workers-types';

type OrsCacheRow = {
  duration_seconds: number;
  fetched_at: number;
  walking_duration_seconds: number | null;
  walking_fetched_at: number | null;
};

export type CachedDuration = {
  durationSeconds: number;
  fetchedAt: number;
  ageMs: number;
};

type CachedDurationKind = 'drive' | 'walk';

function toCachedDuration(
  row: OrsCacheRow | null,
  ttlMs: number,
  kind: CachedDurationKind,
): CachedDuration | null {
  if (!row) return null;

  const durationSeconds = kind === 'drive' ? row.duration_seconds : row.walking_duration_seconds;
  const fetchedAt = kind === 'drive' ? row.fetched_at : row.walking_fetched_at;

  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds)) return null;
  if (typeof fetchedAt !== 'number' || !Number.isFinite(fetchedAt)) return null;

  const ageMs = Date.now() - fetchedAt;
  if (ageMs > ttlMs) return null;

  return {
    durationSeconds,
    fetchedAt,
    ageMs,
  };
}

async function getCacheRow(db: D1Database, routeKey: string): Promise<OrsCacheRow | null> {
  return db
    .prepare(
      'SELECT duration_seconds, fetched_at, walking_duration_seconds, walking_fetched_at FROM ors_cache WHERE route_key = ? LIMIT 1',
    )
    .bind(routeKey)
    .first<OrsCacheRow>();
}

export async function getCachedDuration(
  db: D1Database,
  routeKey: string,
  ttlMs: number,
): Promise<CachedDuration | null> {
  return toCachedDuration(await getCacheRow(db, routeKey), ttlMs, 'drive');
}

export async function getCachedWalkingDuration(
  db: D1Database,
  routeKey: string,
  ttlMs: number,
): Promise<CachedDuration | null> {
  return toCachedDuration(await getCacheRow(db, routeKey), ttlMs, 'walk');
}

export async function upsertCachedDuration(
  db: D1Database,
  routeKey: string,
  durationSeconds: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO ors_cache (route_key, duration_seconds, fetched_at)
       VALUES (?, ?, ?)
       ON CONFLICT(route_key)
       DO UPDATE SET duration_seconds = excluded.duration_seconds,
                     fetched_at = excluded.fetched_at`,
    )
    .bind(routeKey, durationSeconds, Date.now())
    .run();
}

export async function upsertCachedWalkingDuration(
  db: D1Database,
  routeKey: string,
  durationSeconds: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO ors_cache (route_key, walking_duration_seconds, walking_fetched_at)
       VALUES (?, ?, ?)
       ON CONFLICT(route_key)
       DO UPDATE SET walking_duration_seconds = excluded.walking_duration_seconds,
                     walking_fetched_at = excluded.walking_fetched_at`,
    )
    .bind(routeKey, durationSeconds, Date.now())
    .run();
}

export async function invalidateCachedDuration(db: D1Database, routeKey?: string): Promise<number> {
  const result = routeKey
    ? await db.prepare('DELETE FROM ors_cache WHERE route_key = ?').bind(routeKey).run()
    : await db.prepare('DELETE FROM ors_cache').run();

  return Number(result.meta.changes ?? 0);
}
