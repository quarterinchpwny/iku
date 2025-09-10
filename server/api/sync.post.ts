import { useDB } from '../utils/d2';

// This is a placeholder for your authentication logic
async function authenticateUser(event) {
  // In a real app, you would get a token from the request headers
  // and verify it to get the current user.
  console.log('AUTH: Authenticating user...');
  return { id: 'user123' }; // Dummy user
}

export default defineEventHandler(async (event) => {
  // 1. Authenticate the user
  const user = await authenticateUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const db = useDB(event);
  const body = await readBody(event);
  const clientChanges = body.changes || [];
  const lastSyncedAt = body.lastSyncedAt || 0;

  console.log(`Sync request from client for user ${user.id}`);

  // 2. Process incoming changes from the client
  if (clientChanges.length > 0) {
    console.log(`Processing ${clientChanges.length} changes from client...`);
    for (const change of clientChanges) {
      const { table, type, keys, objects } = change;

      if (!['routes', 'points'].includes(table)) {
        console.warn(`Unknown table: ${table}`);
        continue;
      }

      switch (type) {
        case 1: // Create
          for (const obj of objects) {
            await db.create(table, { ...obj, userId: user.id });
          }
          break;
        case 2: // Update
          for (let i = 0; i < keys.length; i++) {
            await db.update(table, { id: keys[i], userId: user.id }, objects[i]);
          }
          break;
        case 3: // Delete
          for (const key of keys) {
            await db.delete(table, { id: key, userId: user.id });
          }
          break;
      }
    }
  }

  // 3. Get changes from the server to send back to the client
  console.log(`Getting server changes for client since ${new Date(lastSyncedAt).toISOString()}`);
  const routeChanges = await db.getChangesSince('routes', user.id, lastSyncedAt);
  const pointChanges = await db.getChangesSince('points', user.id, lastSyncedAt);
  const serverChanges = [...routeChanges, ...pointChanges];

  // 4. Send back the server changes and the new sync timestamp
  return {
    changes: serverChanges,
    timestamp: Date.now()
  };
});
