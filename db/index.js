import Dexie from 'dexie';

export const db = new Dexie('RouteDB');

// Current schema (v1) with lat/lng and composite index
db.version(1).stores({
  routes: '++id, timestamp',
  points: '++id, routeId, lat, lng, timestamp, [routeId+timestamp]'
});

// Example sync function
async function syncToCloudflare(table, changes) {
  console.log('test');
  try {
    const res = await fetch(
      'https://route-sync.galindez-johnfrancisagustin.workers.dev/api/sync',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, changes })
      }
    );

    if (!res.ok) {
      console.error('Worker error:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Sync failed:', err);
  }
}

// Listen to Dexie changes
db.routes.hook('creating', function (_primKey, obj) {
  syncToCloudflare('routes', [obj]);
});

db.points.hook('creating', function (_primKey, obj) {
  syncToCloudflare('points', [obj]);
});

export default db;
