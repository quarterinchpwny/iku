import Dexie from 'dexie';

export const db = new Dexie('RouteDB');
const apiUrl = import.meta.env.VITE_CF_API_URL

db.version(3).stores({
  routes: '++id, timestamp',
  points: '++id, routeId, lat, lng, timestamp, [routeId+timestamp]',
  passive_locations: '++id, lat, lng, timestamp',
  geofences: '++id, remoteId, name, lat, lng, radius, enabled, updatedAt, accountKey, deviceId'
});

// --- Sync helpers ---

async function syncToCloudflare(table, changes) {
  try {
    const res = await fetch(
      `${apiUrl}/api/location/sync`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, changes })
      }
    );

    if (!res.ok) {
      console.error('Worker error:', res.status, await res.text());
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error('Sync failed:', err);
    return null;
  }
}

function normalizeCoord(value) {
  return Number(value).toFixed(6);
}

function getPassiveSyncDeviceId(obj) {
  const existing = typeof obj?.deviceId === 'string' ? obj.deviceId.trim() : '';
  if (existing) return existing;
  if (typeof window === 'undefined') return 'unknown';
  const key = 'iku_passive_device_id';
  const cached = String(localStorage.getItem(key) || '').trim();
  if (cached) return cached;
  const generated = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(key, generated);
  return generated;
}

async function sha256Hex(input) {
  if (typeof crypto?.subtle?.digest !== 'function') {
    console.warn('sha256Hex: crypto.subtle unavailable (insecure context?), skipping hash');
    return 'unavailable';
  }
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deleteFromCloudflare(table, id) {
  try {
    const res = await fetch(
      `${apiUrl}/api/location/sync`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, id })
      }
    );

    if (!res.ok) {
      console.error('Worker error:', res.status, await res.text());
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error('Delete sync failed:', err);
    return null;
  }
}

// --- Server → Local sync (downstream) ---
export async function syncDownFromCloudflare() {
  try {
    const res = await fetch(`${apiUrl}/api/location/fetchAll`);

    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    await db.transaction('rw', db.routes, db.points, db.passive_locations, db.geofences, async () => {
      // --- Sync routes ---
      for (const r of data.routes) {
        const existing = await db.routes.get(r.id);
        if (!existing) {
          await db.routes.add({ ...r, _noSync: true });
        } else {
          await db.routes.update(r.id, { ...r, _noSync: true });
        }
      }

      // --- Sync points ---
      for (const p of data.points) {
        const existing = await db.points.get(p.id);
        if (!existing) {
          await db.points.add({ ...p, _noSync: true });
        } else {
          await db.points.update(p.id, { ...p, _noSync: true });
        }
      }

      // --- Sync passive_locations ---
      if (data.passive_locations) {
        for (const pl of data.passive_locations) {
          const existing = await db.passive_locations.get(pl.id);
          if (!existing) {
            await db.passive_locations.add({ ...pl, _noSync: true });
          } else {
            await db.passive_locations.update(pl.id, { ...pl, _noSync: true });
          }
        }
      }

      if (data.geofences) {
        for (const geofence of data.geofences) {
          const { id: serverId, ...rest } = geofence || {};
          const remoteId = Number(geofence?.id);
          if (!Number.isFinite(remoteId) || remoteId <= 0) continue;
          const existingByRemote = await db.geofences
            .where('remoteId')
            .equals(remoteId)
            .first();

          if (existingByRemote) {
            await db.geofences.update(existingByRemote.id, {
              ...rest,
              remoteId,
              _noSync: true
            });
            continue;
          }

          const existingById = await db.geofences.get(remoteId);
          if (!existingById) {
            await db.geofences.add({ ...geofence, remoteId, _noSync: true });
          } else {
            await db.geofences.update(remoteId, { ...rest, remoteId, _noSync: true });
          }
        }
      }
    });

    console.log('Local DB merged with server');
  } catch (err) {
    console.error('Sync-down failed:', err);
  }
}

export async function repairOrphanPointRoutes() {
  try {
    const [routes, points] = await Promise.all([
      db.routes.toArray(),
      db.points.toArray()
    ]);
    if (!points.length) return;

    const existingRouteIds = new Set(
      routes
        .map((r) => Number(r?.id))
        .filter((id) => Number.isFinite(id))
    );

    const orphanBuckets = new Map();
    for (const p of points) {
      const rid = Number(p?.routeId);
      if (!Number.isFinite(rid) || existingRouteIds.has(rid)) continue;
      if (!orphanBuckets.has(rid)) orphanBuckets.set(rid, []);
      orphanBuckets.get(rid).push(Number(p?.timestamp || Date.now()));
    }

    if (!orphanBuckets.size) return;

    for (const [rid, timestamps] of orphanBuckets.entries()) {
      const ts = Math.min(...timestamps);
      try {
        await db.routes.add({
          id: rid,
          timestamp: Number.isFinite(ts) ? ts : Date.now(),
          source: 'UNKNOWN',
          startedAt: Number.isFinite(ts) ? ts : Date.now(),
          _noSync: true
        });
      } catch (err) {
        if (err.name === 'ConstraintError') {
          // Route already exists (race condition or re-run) — safe to ignore
          console.warn(`repairOrphanPointRoutes: route ${rid} already exists, skipping`);
        } else {
          console.error(`repairOrphanPointRoutes: failed to create route ${rid}`, err);
        }
      }
    }
  } catch (err) {
    console.error('repairOrphanPointRoutes failed:', err);
  }
}


// --- Hooks ---

// Route sync hook
db.routes.hook('creating', function (primKey, obj, transaction) {
  if (obj._noSync) return;
  const source = String(obj?.source || '').toUpperCase();
  if (source === 'PASSIVE') return;

  this.onsuccess = (generatedKey) => {
    transaction.on('complete', async () => {
      const cleanObj = JSON.parse(JSON.stringify(obj));
      const res = await syncToCloudflare('routes', [cleanObj]);

      if (res && res.ids && res.ids.length > 0) {
        const realId = res.ids[0];
        if (Number.isFinite(Number(realId))) {
          await db.routes.update(generatedKey, { remoteId: Number(realId), _noSync: true });
        }
      }
    });
  };
});

// Points sync hook
db.points.hook('creating', function (_primKey, obj, transaction) {
  if (obj._noSync) return;
  const source = String(obj?.source || '').toUpperCase();
  if (source === 'PASSIVE') return;

  this.onsuccess = () => {
    transaction.on('complete', async () => {
      try {
        let routeIdForSync = obj.routeId;
        if (Number.isFinite(Number(obj.routeId))) {
          const route = await db.routes.get(Number(obj.routeId));
          if (route && Number.isFinite(Number(route.remoteId))) {
            routeIdForSync = Number(route.remoteId);
          }
        }

        await syncToCloudflare('points', [
          {
            ...obj,
            routeId: routeIdForSync
          }
        ]);
      } catch (err) {
        console.error('Point sync hook failed:', err);
      }
    });
  };
});

// Passive locations sync hook
db.passive_locations.hook('creating', function (_primKey, obj, transaction) {
  if (obj._noSync) return;

  this.onsuccess = () => {
    transaction.on('complete', async () => {
      try {
        const lat = Number(obj?.lat);
        const lng = Number(obj?.lng);
        const timestamp = Number(obj?.timestamp || Date.now());
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const deviceId = getPassiveSyncDeviceId(obj);
        const sampleHash = await sha256Hex(
          `${deviceId}|${timestamp}|${normalizeCoord(lat)}|${normalizeCoord(lng)}`
        );

        await syncToCloudflare('passive_locations', [
          {
            ...obj,
            deviceId,
            timestamp,
            sampleHash
          }
        ]);
      } catch (err) {
        console.error('Passive location sync hook failed:', err);
      }
    });
  };
});

db.geofences.hook('creating', function (_primKey, obj, transaction) {
  if (obj._noSync) return;

  this.onsuccess = (generatedKey) => {
    transaction.on('complete', async () => {
      try {
        const outboundId = Number.isFinite(Number(obj?.remoteId))
          ? Number(obj.remoteId)
          : Number(obj?.id);
        const row = {
          ...obj,
          id: Number.isFinite(outboundId) && outboundId > 0 ? outboundId : undefined
        };
        const res = await syncToCloudflare('geofences', [row]);
        const syncedId = Number(res?.ids?.[0]);
        if (Number.isFinite(syncedId) && syncedId > 0) {
          await db.geofences.update(generatedKey, { remoteId: syncedId, _noSync: true });
        }
      } catch (err) {
        console.error('Geofence create sync hook failed:', err);
      }
    });
  };
});

db.geofences.hook('updating', function (mods, primKey, obj, transaction) {
  if (obj?._noSync) return;

  this.onsuccess = () => {
    transaction.on('complete', async () => {
      try {
        const outboundId = Number.isFinite(Number(obj?.remoteId))
          ? Number(obj.remoteId)
          : Number(primKey);
        const payload = {
          ...obj,
          ...mods,
          id: Number.isFinite(outboundId) && outboundId > 0 ? outboundId : Number(primKey)
        };
        await syncToCloudflare('geofences', [payload]);
      } catch (err) {
        console.error('Geofence update sync hook failed:', err);
      }
    });
  };
});

// Route deleting hook
db.routes.hook('deleting', function (primKey, obj) {
  if (obj?._noSync) return;
  const source = String(obj?.source || '').toUpperCase();
  if (source === 'PASSIVE') return;
  deleteFromCloudflare('routes', primKey);
});

// Passive locations deleting hook
db.passive_locations.hook('deleting', function (primKey, obj) {
  if (obj?._noSync) return;
  deleteFromCloudflare('passive_locations', primKey);
});

db.geofences.hook('deleting', function (primKey, obj) {
  if (obj?._noSync) return;
  const remoteId = Number(obj?.remoteId);
  const targetId = Number.isFinite(remoteId) && remoteId > 0 ? remoteId : primKey;
  deleteFromCloudflare('geofences', targetId);
});

export default db;
