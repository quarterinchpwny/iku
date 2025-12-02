// db/remote_db/src/auth/middleware.ts
import { createMiddleware } from 'hono/factory';
import { getSession } from './session';
import type { D1Database } from '@cloudflare/workers-types';

type Env = {
  Bindings: {
    RouteDB: D1Database;
  }
}

// Define the shape of the 'user' object we'll add to the context
export type AuthenticatedUser = {
  id: number;
}

export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.substring(7); // Remove "Bearer "
  const session = await getSession(c.env.RouteDB, token);

  if (!session) {
    return c.json({ error: 'Unauthorized', message: 'Invalid or expired session token' }, 401);
  }

  // Make user information available on the context
  c.set('user', { id: session.user_id });

  await next();
});
