// db/remote_db/src/auth/routes.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sign } from 'hono/jwt'
import { hashPassword, verifyPassword } from './password';
import { authMiddleware } from './middleware';

import type { D1Database } from '@cloudflare/workers-types';

type Env = {
  Bindings: {
    RouteDB: D1Database;
    JWT_SECRET: string;
  }
}

export const authRoutes = new Hono<Env>();

// Schema for login
const authSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

/**
 * [POST] /register
 * Creates a new regular user.
 */
authRoutes.post('/register', zValidator('json', authSchema), async (c) => {
  const { username, password } = c.req.valid('json');

  try {
    const hashedPassword = await hashPassword(password);
    // Explicitly set the role to 'user' for public registrations.
    const { results } = await c.env.RouteDB.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
      .bind(username, hashedPassword, 'user')
      .run();

    return c.json({ success: true, message: 'User created successfully.' }, 201);

  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Username already taken' }, 409);
    }
    console.error('Registration error:', e);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});


/**
 * [POST] /login
 * Authenticates a user and returns a signed JWT.
 */
authRoutes.post('/login', zValidator('json', authSchema), async (c) => {
  const { username, password } = c.req.valid('json');

  const { results } = await c.env.RouteDB.prepare('SELECT * FROM users WHERE username = ?')
    .bind(username)
    .all<{ id: number; password: string; role: string }>();
  
  const user = results[0];

  if (!user) {
    return c.json({ error: 'Invalid username or password' }, 401);
  }

  const passwordMatch = await verifyPassword(password, user.password);
  if (!passwordMatch) {
    return c.json({ error: 'Invalid username or password' }, 401);
  }

  // Create the JWT payload, including the user's role
  const payload = {
    sub: user.id, // 'sub' (subject) is a standard JWT claim for the user ID
    username: username, 

    role: user.role,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // 7 day expiration
  };

  // Sign the token with the secret, explicitly using HS256
  const token = await sign(payload, c.env.JWT_SECRET);

  return c.json({ success: true, token: token });
});

/**
 * [POST] /logout
 * This is a no-op on the server for stateless JWTs. The client is responsible
 * for deleting the token. This endpoint exists so the client can have a URL
 * to call for logging out.
 */
authRoutes.post('/logout', authMiddleware, async (c) => {
  return c.json({ success: true, message: 'Logged out successfully' });
});

/**
 * [GET] /me
 * Returns the current authenticated user's information from the JWT payload.
 */
authRoutes.get('/me', authMiddleware, async (c) => {
    // The 'user' payload from the JWT is automatically added to the context by the middleware
    const userPayload = c.get('jwtPayload'); 
    return c.json({ user: userPayload });
});