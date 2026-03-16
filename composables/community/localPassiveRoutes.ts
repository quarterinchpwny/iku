import { Capacitor } from '@capacitor/core';
import { ActivityRecognition } from '@/src/plugins/activityRecognition';

type PassiveEvent = {
  timestamp: number;
  lat: number;
  lng: number;
  trigger: string;
  provider: string;
  acc: number;
  source: string;
  uploadedAt: number;
};

type RouteStory = {
  story: string;
  durationLabel: string;
  durationMs: number;
};

type BuildRouteStory = (cls: string, pts: any[]) => RouteStory;
type DistanceFn = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => number;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function utcDayKeyFromTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function utcDayIdFromTimestamp(timestamp: number): number {
  const d = new Date(timestamp);
  return Number(`${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`);
}

async function loadAllPassiveEvents(): Promise<PassiveEvent[]> {
  if (!Capacitor.isPluginAvailable('qipz-activity')) return [];
  const merged: PassiveEvent[] = [];
  let cursor: number | undefined;
  for (let i = 0; i < 40; i++) {
    const response = await ActivityRecognition.getPassiveEvents({
      fromTs: 0,
      toTs: 0,
      cursor,
      limit: 400
    });
    const events = Array.isArray(response?.events) ? response.events : [];
    if (!events.length) break;
    merged.push(
      ...events.map((row: any) => ({
        timestamp: Number(row?.timestamp || 0),
        lat: Number(row?.lat),
        lng: Number(row?.lng),
        trigger: String(row?.trigger || ''),
        provider: String(row?.provider || ''),
        acc: Number(row?.acc || 0),
        source: String(row?.source || ''),
        uploadedAt: Number(row?.uploadedAt || 0)
      }))
    );
    if (!response?.hasMore || !response?.nextCursor) break;
    cursor = Number(response.nextCursor);
    if (!Number.isFinite(cursor) || cursor <= 0) break;
  }
  return merged
    .filter(
      (row) =>
        Number.isFinite(row.timestamp) &&
        row.timestamp > 0 &&
        Number.isFinite(row.lat) &&
        Number.isFinite(row.lng)
    )
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
}

export async function buildLocalRoutesFromPlugin(
  existingPassiveDayKeys: Set<string>,
  buildRouteStory: BuildRouteStory,
  distanceMeters: DistanceFn
): Promise<{ routes: any[]; pointsById: Map<number, any[]> }> {
  const events = await loadAllPassiveEvents();
  if (!events.length) return { routes: [], pointsById: new Map() };
  const grouped = new Map<string, PassiveEvent[]>();
  for (const row of events) {
    const ts = Number(row?.timestamp || 0);
    if (!Number.isFinite(ts) || ts <= 0) continue;
    const dayKey = utcDayKeyFromTimestamp(ts);
    if (existingPassiveDayKeys.has(dayKey)) continue;
    if (!grouped.has(dayKey)) grouped.set(dayKey, []);
    grouped.get(dayKey)!.push(row);
  }
  if (!grouped.size) return { routes: [], pointsById: new Map() };
  const todayKey = utcDayKeyFromTimestamp(Date.now());
  const routes: any[] = [];
  const pointsById = new Map<number, any[]>();
  for (const [dayKey, rows] of grouped.entries()) {
    const sorted = [...rows].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    const points = sorted.map((row) => ({
      lat: row.lat,
      lng: row.lng,
      timestamp: row.timestamp,
      routeId: utcDayIdFromTimestamp(row.timestamp),
      source: 'PASSIVE'
    }));
    const routeId = utcDayIdFromTimestamp(sorted[0]?.timestamp || 0);
    if (!Number.isFinite(routeId)) continue;
    pointsById.set(routeId, points);
    const story = buildRouteStory('PASSIVE', points);
    const startTimestamp = Number(sorted[0]?.timestamp || 0);
    const endTimestamp = Number(sorted[sorted.length - 1]?.timestamp || 0);
    let routeDistanceMeters = 0;
    for (let i = 1; i < points.length; i++) {
      routeDistanceMeters += distanceMeters(points[i - 1], points[i]);
    }
    const latest = sorted[sorted.length - 1];
    routes.push({
      id: routeId,
      timestamp: startTimestamp,
      startTimestamp,
      endTimestamp,
      pointCount: points.length,
      classification: 'PASSIVE',
      story: story.story,
      durationLabel: story.durationLabel,
      durationMs: story.durationMs,
      routeStatus: dayKey === todayKey ? 'OPEN' : 'CLOSED',
      routeDistanceMeters,
      passiveMeta: latest
        ? {
            trigger: String(latest?.trigger || ''),
            provider: String(latest?.provider || ''),
            acc: Number(latest?.acc || 0),
            uploadedAt: Number(latest?.uploadedAt || 0)
          }
        : null,
      localOnly: true
    });
  }
  return { routes, pointsById };
}

export async function buildLocalPassiveTimelineData(
  existingPassiveDayKeys: Set<string>
): Promise<{ routes: any[]; points: any[]; passiveLocations: any[] }> {
  const events = await loadAllPassiveEvents();
  if (!events.length) return { routes: [], points: [], passiveLocations: [] };
  const grouped = new Map<string, PassiveEvent[]>();
  for (const row of events) {
    const ts = Number(row?.timestamp || 0);
    if (!Number.isFinite(ts) || ts <= 0) continue;
    const dayKey = utcDayKeyFromTimestamp(ts);
    if (existingPassiveDayKeys.has(dayKey)) continue;
    if (!grouped.has(dayKey)) grouped.set(dayKey, []);
    grouped.get(dayKey)!.push(row);
  }
  if (!grouped.size) return { routes: [], points: [], passiveLocations: [] };
  const todayKey = utcDayKeyFromTimestamp(Date.now());
  const routes: any[] = [];
  const points: any[] = [];
  const passiveLocations: any[] = [];
  for (const [dayKey, rows] of grouped.entries()) {
    const sorted = [...rows].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    const routeId = utcDayIdFromTimestamp(sorted[0]?.timestamp || 0);
    if (!Number.isFinite(routeId)) continue;
    for (const row of sorted) {
      points.push({
        lat: row.lat,
        lng: row.lng,
        timestamp: row.timestamp,
        routeId,
        source: 'PASSIVE'
      });
      passiveLocations.push({
        route_id: routeId,
        lat: row.lat,
        lng: row.lng,
        timestamp: row.timestamp,
        trigger: row.trigger,
        provider: row.provider,
        acc: row.acc,
        source: row.source,
        uploadedAt: row.uploadedAt
      });
    }
    const startTimestamp = Number(sorted[0]?.timestamp || 0);
    routes.push({
      id: routeId,
      timestamp: startTimestamp,
      source: 'PASSIVE',
      status: dayKey === todayKey ? 'OPEN' : 'CLOSED',
      localOnly: true
    });
  }
  return { routes, points, passiveLocations };
}
