import Dexie from 'dexie';

export const db = new Dexie('RouteDB');
const apiUrl = import.meta.env.VITE_CF_API_URL


db.version(2).stores({
  routes: '++id, timestamp',
  points: '++id, routeId, lat, lng, timestamp, [routeId+timestamp]',
  passive_locations: '++id, lat, lng, timestamp',
  geofences: '++id, name, lat, lng, radius'
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
  if (!import.meta.client) return 'unknown';
  const key = 'iku_passive_device_id';
  const cached = String(localStorage.getItem(key) || '').trim();
  if (cached) return cached;
  const generated = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(key, generated);
  return generated;
}

async function sha256Hex(input) {
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
    const res = await fetch(
      `${apiUrl}/api/location/fetchAll`,
    );
    console.log('test',res , import.meta.env.VITE_CF_API_URL)

    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    await db.transaction('rw', db.routes, db.points, db.passive_locations, async () => {
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
      await db.routes.add({
        id: rid,
        timestamp: Number.isFinite(ts) ? ts : Date.now(),
        source: 'UNKNOWN',
        startedAt: Number.isFinite(ts) ? ts : Date.now(),
        _noSync: true
      });
    }
  } catch (err) {
    console.error('repairOrphanPointRoutes failed:', err);
  }
}


// --- Hooks ---

// Route sync hook
db.routes.hook('creating', function (primKey, obj, transaction) {
  if (obj._noSync) return; // skip system inserts

  this.onsuccess = (generatedKey) => {
    transaction.on('complete', async () => {
      const cleanObj = JSON.parse(JSON.stringify(obj));
      const res = await syncToCloudflare('routes', [cleanObj]);

      if (res && res.ids && res.ids.length > 0) {
        const realId = res.ids[0];
        // Keep local route IDs stable. Store remote ID mapping on the route so
        // point sync can translate routeId safely.
        if (Number.isFinite(Number(realId))) {
          await db.routes.update(generatedKey, { remoteId: Number(realId), _noSync: true });
        }
      }
    });
  };
});

// Points sync hook
db.points.hook('creating', function (_primKey, obj, transaction) {
  if (obj._noSync) return; // skip system inserts
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
  if (obj._noSync) return; // skip system inserts
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

db.routes.hook('deleting', function (primKey, obj, transaction) {
  if (transaction.explicit) {
    // We only want to sync if it's a direct delete, not part of another operation
    // Actually Dexie hooks don't easily tell if it's _noSync during deletion
    // but we can use a custom property if we really need to.
    // For now, let's assume all deletes should sync unless we mark them.
  }
  deleteFromCloudflare('routes', primKey);
});

db.passive_locations.hook('deleting', function (primKey, obj, transaction) {
  deleteFromCloudflare('passive_locations', primKey);
});

export default db;
