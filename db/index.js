import Dexie from 'dexie';

export const db = new Dexie('RouteDB');

db.version(1).stores({
  routes: '++id, timestamp',
  points: '++id, routeId, lat, lng, timestamp, [routeId+timestamp]'
});

// Sync helper
async function syncToCloudflare(table, changes) {
  try {
    const res = await fetch('https://route-sync.galindez-johnfrancisagustin.workers.dev/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, changes })
    });

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

// --- Hooks ---

// Route sync hook
db.routes.hook('creating', async function (primKey, obj, transaction) {
  const res = await syncToCloudflare('routes', [obj]);

  if (res && res.ids && res.ids.length > 0) {
    const realId = res.ids[0];

    // After Dexie assigns temp id, replace with real id
    transaction.on('complete', async () => {
      const tempId = primKey; // Dexie's generated id
      if (tempId !== realId) {
        // Update record with real id
        const route = await db.routes.get(tempId);
        if (route) {
          route.id = realId;
          await db.routes.add(route); // insert under real id
          await db.routes.delete(tempId); // remove temp id
        }
      }
    });
  }
});

// Points sync hook
db.points.hook('creating', function (_primKey, obj) {
  syncToCloudflare('points', [obj]);
});

export default db;
