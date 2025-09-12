// src/db.js
import Dexie from 'dexie';
import 'dexie-observable'; // npm install dexie-observable

export const db = new Dexie('RouteDB');

db.version(1).stores({
  routes: '++id, timestamp',
  points: '++id, routeId, timestamp'
});

// Listen to local changes
db.on('changes', (changes) => {
  changes.forEach(async (change) => {
    if (change.type === 1) {
      await syncUp(change.table, change.obj); // CREATE
    } else if (change.type === 2) {
      await syncUp(change.table, { id: change.key, ...change.mods }); // UPDATE
    } else if (change.type === 3) {
      await syncDelete(change.table, change.key); // DELETE
    }
  });
});

async function syncUp(table, data) {
  try {
    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, data })
    });
  } catch (err) {
    console.error('Sync up failed:', err);
  }
}

async function syncDelete(table, id) {
  try {
    await fetch('/api/sync', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, id })
    });
  } catch (err) {
    console.error('Delete sync failed:', err);
  }
}

export default db;
