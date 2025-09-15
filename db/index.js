import Dexie from 'dexie';

export const db = new Dexie('RouteDB');

db.version(1).stores({
  routes: '++id, timestamp', // Each route
  points: '++id, routeId, timestamp' // GPS points
});

// Example sync function
async function syncToCloudflare(table, changes) {
  console.log('test')
  try {
    await fetch('https://route-sync.galindez-johnfrancisagustin.workers.dev/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, changes })
    });
  } catch (err) {
    console.error('Sync failed:', err);
  }
}

// Listen to Dexie changes
db.routes.hook('creating', function (primKey, obj) {
  syncToCloudflare('routes', [obj]);
});

db.points.hook('creating', function (primKey, obj) {
  syncToCloudflare('points', [obj]);
});

export default db;
