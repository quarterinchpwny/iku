import { db } from '@/db/index.js';
import { loadAllPassiveEvents, utcDayIdFromTimestamp } from '@/composables/community/localPassiveRoutes';

function normalizeCoord(value: number): string {
  return Number(value).toFixed(6);
}

function hash32(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildLocalId(row: {
  timestamp: number;
  lat: number;
  lng: number;
  trigger: string;
  provider: string;
  source: string;
}): number {
  const key = [
    Number(row.timestamp || 0),
    normalizeCoord(row.lat),
    normalizeCoord(row.lng),
    String(row.trigger || ''),
    String(row.provider || ''),
    String(row.source || '')
  ].join('|');
  const h = hash32(key) || 1;
  return -1 * h;
}

export async function syncPassiveFromPluginToDexie(): Promise<{ total: number }> {
  const events = await loadAllPassiveEvents();
  if (!events.length) return { total: 0 };
  const rows = events.map((row) => ({
    id: buildLocalId(row),
    route_id: utcDayIdFromTimestamp(row.timestamp),
    lat: row.lat,
    lng: row.lng,
    timestamp: row.timestamp,
    trigger: row.trigger,
    provider: row.provider,
    acc: row.acc,
    source: row.source,
    uploadedAt: row.uploadedAt,
    localOnly: true
  }));
  await db.transaction('rw', db.passive_locations, async () => {
    await db.passive_locations.bulkPut(rows);
  });
  return { total: rows.length };
}
