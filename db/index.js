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

        if (realId !== generatedKey) {
          const route = await db.routes.get(generatedKey);
          if (route) {
            route.id = realId;

            await db.transaction('rw', db.routes, async () => {
              await db.routes.add({ ...route, _noSync: true });
              await db.routes.delete(generatedKey);
            });
          }
        }
      }
    });
  };
});

// Points sync hook
db.points.hook('creating', function (_primKey, obj) {
  if (obj._noSync) return; // skip system inserts
  syncToCloudflare('points', [obj]);
});

// Passive locations sync hook
db.passive_locations.hook('creating', function (_primKey, obj) {
  if (obj._noSync) return; // skip system inserts
  syncToCloudflare('passive_locations', [obj]);
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
