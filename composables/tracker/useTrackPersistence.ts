import { db, syncToCloudflare } from '@/db/index.js';
import type { TrackPoint } from '@/composables/tracker/types';

interface SaveTrackInput {
  startedAt: number;
  endedAt: number;
  distanceKm: number;
  elapsedMs: number;
  movingMs: number;
  points: TrackPoint[];
}

export function useTrackPersistence() {
  function getAccountKey(): string | null {
    if (typeof window === 'undefined') return null;
    const key = String(localStorage.getItem('auth_account_key') || '').trim();
    return key || null;
  }

  function getDeviceId(): string | null {
    if (typeof window === 'undefined') return null;
    const pluginId = String(localStorage.getItem('iku_plugin_device_id') || '').trim();
    if (pluginId) return pluginId;
    const deviceId = String(localStorage.getItem('iku_device_id') || '').trim();
    return deviceId || null;
  }

  async function saveCompletedTrack(input: SaveTrackInput) {
    if (!input.points.length) return null;
    const accountKey = getAccountKey();
    const deviceId = getDeviceId();
    const saved = await db.transaction('rw', db.routes, db.points, async () => {
      const routeId = await db.routes.add({
        timestamp: input.startedAt,
        source: 'ACTIVE',
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        status: 'closed',
        distanceMeters: input.distanceKm * 1000,
        durationMs: input.elapsedMs,
        movingDurationMs: input.movingMs,
        accountKey: accountKey || undefined,
        deviceId: deviceId || undefined,
        _noSync: true,
      });

      const pointIds: number[] = [];
      for (const point of input.points) {
        const pointId = await db.points.add({
          routeId,
          lat: point.lat,
          lng: point.lng,
          timestamp: point.timestamp,
          accuracy: point.accuracy,
          speed: point.speed,
          heading: point.heading,
          altitude: point.altitude,
          source: 'ACTIVE',
          accountKey: accountKey || undefined,
          deviceId: deviceId || undefined,
          _noSync: true,
        });
        pointIds.push(Number(pointId));
      }

      return { routeId: Number(routeId), pointIds };
    });

    const route = await db.routes.get(saved.routeId);
    if (!route) {
      throw new Error(`Saved route ${saved.routeId} not found`);
    }

    const routeSync = await syncToCloudflare('routes', [
      {
        timestamp: route.timestamp,
        source: route.source,
        startedAt: route.startedAt,
        endedAt: route.endedAt,
        status: route.status,
        distanceMeters: route.distanceMeters,
        durationMs: route.durationMs,
        movingDurationMs: route.movingDurationMs,
        accountKey: route.accountKey,
        deviceId: route.deviceId,
      },
    ]);
    const remoteRouteId = Number(routeSync?.ids?.[0]);
    if (!Number.isFinite(remoteRouteId) || remoteRouteId <= 0) {
      throw new Error('Active route sync failed');
    }

    await db.routes.update(saved.routeId, { remoteId: remoteRouteId, _noSync: true });

    const points = (await db.points.bulkGet(saved.pointIds)).filter(Boolean);
    if (!points.length) {
      return saved.routeId;
    }

    const pointSync = await syncToCloudflare(
      'points',
      points.map((point) => ({
        routeId: remoteRouteId,
        lat: point.lat,
        lng: point.lng,
        timestamp: point.timestamp,
        accuracy: point.accuracy,
        speed: point.speed,
        heading: point.heading,
        altitude: point.altitude,
        source: point.source,
        accountKey: point.accountKey,
        deviceId: point.deviceId,
      })),
    );

    const remotePointIds = Array.isArray(pointSync?.ids) ? pointSync.ids : [];
    if (remotePointIds.length !== points.length) {
      throw new Error('Active point sync failed');
    }

    await Promise.all(
      points.map((point, index) =>
        db.points.update(Number(point.id), {
          remoteId: Number(remotePointIds[index]),
          routeId: saved.routeId,
          _noSync: true,
        }),
      ),
    );

    return saved.routeId;
  }

  return {
    saveCompletedTrack,
  };
}
