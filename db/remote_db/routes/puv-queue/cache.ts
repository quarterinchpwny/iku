import type { D1Database } from '@cloudflare/workers-types';

type OrsCacheRow = {
  duration_seconds: number;
  fetched_at: number;
};

export type CachedDuration = {
  durationSeconds: number;
  fetchedAt: number;
  ageMs: number;
};

export async function getCachedDuration(
  db: D1Database,
  routeKey: string,
  ttlMs: number,
): Promise<CachedDuration | null> {
  const row = await db
    .prepare('SELECT duration_seconds, fetched_at FROM ors_cache WHERE route_key = ? LIMIT 1')
    .bind(routeKey)
    .first<OrsCacheRow>();

  if (!row) return null;

  const ageMs = Date.now() - row.fetched_at;
  if (ageMs > ttlMs) return null;

  return {
    durationSeconds: row.duration_seconds,
    fetchedAt: row.fetched_at,
    ageMs,
  };
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

export async function invalidateCachedDuration(db: D1Database, routeKey?: string): Promise<number> {
  const result = routeKey
    ? await db.prepare('DELETE FROM ors_cache WHERE route_key = ?').bind(routeKey).run()
    : await db.prepare('DELETE FROM ors_cache').run();

  return Number(result.meta.changes ?? 0);
}
