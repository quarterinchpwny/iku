// src/db.js
import Dexie from 'dexie';

export const db = new Dexie('RouteDB');

db.version(1).stores({
  routes: '++id, timestamp', // Each route
  points: '++id, routeId, timestamp' // All GPS points
});

export default db;
