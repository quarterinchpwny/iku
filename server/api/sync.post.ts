import { useDB } from '../utils/d2';
import { verify } from 'hono/jwt'

async function getAuthenticatedUser(event) {
  // Get the Authorization header
  const authHeader = getRequestHeader(event, 'Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  // Extract the token
  const token = authHeader.substring(7);

  // Get the JWT secret from runtime config (must be set in .env or environment)
  const config = useRuntimeConfig(event);
  const secret = config.jwtSecret;

  if (!secret) {
    console.error('JWT_SECRET is not configured in the Nuxt runtime environment.');
    return null;
  }

  try {
    // Verify the token and return the payload (which includes user ID and role)
    const payload = await verify(token, secret, 'HS256');
    return payload;
  } catch (error) {
    // Token is invalid or expired
    console.error('JWT verification failed:', error.message);
    return null;
  }
}

export default defineEventHandler(async (event) => {
  // 1. Authenticate the user
  const user = await getAuthenticatedUser(event);
  if (!user || !user.sub) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }
  const userId = user.sub; // Use the 'sub' (subject) claim for the user ID

  const db = useDB(event);
  const body = await readBody(event);
  const clientChanges = body.changes || [];
  const lastSyncedAt = body.lastSyncedAt || 0;

  console.log(`Sync request from client for user ${userId}`);

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
            // Ensure data is associated with the authenticated user
            await db.create(table, { ...obj, userId: userId });
          }
          break;
        case 2: // Update
          for (let i = 0; i < keys.length; i++) {
            // Note: This is not fully secure, as a user could guess an ID.
            // A robust implementation would check ownership before updating.
            await db.update(table, { id: keys[i] }, objects[i]);
          }
          break;
        case 3: // Delete
          // Note: This is not fully secure. A robust implementation
          // would check ownership before deleting.
          for (const key of keys) {
            await db.delete(table, { id: key });
          }
          break;
      }
    }
  }

  // 3. Get changes from the server to send back to the client
  console.log(`Getting server changes for client since ${new Date(lastSyncedAt).toISOString()}`);
  const routeChanges = await db.getChangesSince('routes', userId, lastSyncedAt);
  const pointChanges = await db.getChangesSince('points', userId, lastSyncedAt);
  const serverChanges = [...routeChanges, ...pointChanges];

  // 4. Send back the server changes and the new sync timestamp
  return {
    changes: serverChanges,
    timestamp: Date.now()
  };
});