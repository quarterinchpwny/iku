// db/remote_db/src/auth/routes.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { hashPassword, verifyPassword } from './password';
import { createSession, deleteSession, getSession } from './session';
import { authMiddleware } from './middleware';

import type { D1Database } from '@cloudflare/workers-types';

type Env = {
  Bindings: {
    RouteDB: D1Database;
  }
}

export const authRoutes = new Hono<Env>();

// Schema for registration and login
const authSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

/**
 * [POST] /login
 * Authenticates a user and returns a session token.
 */
authRoutes.post('/login', zValidator('json', authSchema), async (c) => {
  const { username, password } = c.req.valid('json');

  const { results } = await c.env.RouteDB.prepare('SELECT * FROM users WHERE username = ?')
    .bind(username)
    .all<{ id: number; password: string }>();
  
  const user = results[0];

  if (!user) {
    return c.json({ error: 'Invalid username or password' }, 401);
  }

  // Defensively check if password from DB is a valid string before processing
  if (typeof user.password !== 'string' || !user.password.includes(':')) {
    console.error(`User "${username}" has a corrupt password entry in the database.`);
    return c.json({ error: 'Internal Server Error', message: 'Corrupt user data.' }, 500);
  }

  const passwordMatch = await verifyPassword(password, user.password);
  if (!passwordMatch) {
    return c.json({ error: 'Invalid username or password' }, 401);
  }

  const sessionId = await createSession(c.env.RouteDB, user.id);

  return c.json({ success: true, token: sessionId });
});

/**
 * [POST] /logout
 * Invalidates the user's session token.
 */
authRoutes.post('/logout', authMiddleware, async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.substring(7);

  if (token) {
    await deleteSession(c.env.RouteDB, token);
  }

  return c.json({ success: true, message: 'Logged out successfully' });
});

/**
 * [GET] /me
 * Returns the current authenticated user's information.
 */
authRoutes.get('/me', authMiddleware, async (c) => {
    const user = c.get('user');
    return c.json({ user });
});
