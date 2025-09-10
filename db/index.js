// src/db.js
import Dexie from 'dexie';
import { useRuntimeConfig } from '#app';

export const db = new Dexie('RouteDB');

db.version(1).stores({
  routes: '++id, timestamp', // Each route
  points: '++id, routeId, timestamp' // All GPS points
});

// Get the sync endpoint from runtime config
const syncEndpoint = () => useRuntimeConfig().public.syncUrl;

// Use localStorage to keep track of the last time we synced with the server
let lastSyncedAt = localStorage.getItem('lastSyncedAt') || 0;

// Function to send changes to the server
async function syncWithServer(changesToSync) {
  try {
    const response = await fetch(syncEndpoint(), {
      method: 'POST',
      body: JSON.stringify({
        changes: changesToSync,
        lastSyncedAt: lastSyncedAt
      }),
      headers: { 'Content-Type': 'application/json' }
    });
    const { changes, timestamp } = await response.json();
    if (changes && changes.length > 0) {
      // We got changes from the server, apply them locally
      applyServerChanges(changes);
    }
    // Update the last synced timestamp
    lastSyncedAt = timestamp;
    localStorage.setItem('lastSyncedAt', lastSyncedAt);

  } catch (e) {
    console.error("Failed to sync with server", e);
  }
}

// Listen for changes in the database
db.on('mutated', (parts) => {
  const { table, type, keys, objects } = parts;
  // We only care about creates, updates, and deletes
  if (type < 1 || type > 3) return;

  const change = {
    table,
    type, // 1:create, 2:update, 3:delete
    keys,
    objects
  };

  console.log("Change detected:", change);
  // Note: In a real app, you might want to batch changes
  // instead of sending them one by one.
  syncWithServer([change]);
});

function applyServerChanges(changes) {
  db.transaction('rw', db.routes, db.points, () => {
    changes.forEach(change => {
      const { table, type, keys, objects } = change;
      const store = db[table];

      switch (type) {
        case 1: // create
          store.bulkAdd(objects);
          break;
        case 2: // update
          keys.forEach((key, i) => {
            store.update(key, objects[i]);
          });
          break;
        case 3: // delete
          store.bulkDelete(keys);
          break;
      }
    });
  });
}

// Function to fetch changes from the server and apply them locally
export async function syncFromServer() {
  console.log('Performing full sync with server...');
  await syncWithServer([]); // Send an empty array to just fetch changes
}

export default db;
