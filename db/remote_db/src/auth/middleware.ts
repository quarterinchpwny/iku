// db/remote_db/src/auth/middleware.ts
import { jwt } from 'hono/jwt'
import { createMiddleware } from 'hono/factory'

type Env = {
  Bindings: {
    JWT_SECRET: string;
  }
}

/**
 * Middleware to verify the JWT token is valid.
 * It uses the HS256 algorithm and the JWT_SECRET from the environment.
 * If valid, the payload is available at `c.get('jwtPayload')`.
 */
export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const auth = jwt({ secret: c.env.JWT_SECRET, alg: 'HS256' });
  return auth(c, next);
});

/**
 * Middleware to be used *after* authMiddleware.
 * It checks if the validated JWT payload contains the 'admin' role.
 */
export const adminOnlyMiddleware = createMiddleware<Env>(async (c, next) => {
  const payload = c.get('jwtPayload');
  
  if (!payload) {
    return c.json({ error: 'Unauthorized', message: 'Invalid token payload.' }, 401);
  }

  if (payload.role !== 'admin') {
    return c.json({ error: 'Forbidden', message: 'You do not have administrative privileges.' }, 403);
  }
  
  await next();
});