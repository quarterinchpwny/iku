import { createMiddleware } from 'hono/factory';

type Env = {
  Bindings: {
    RouteDB: D1Database;
  };
};

function toSafeText(value: string | null | undefined, maxLen: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function toSafeInt(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
}

function inferAuthSubject(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const normalized = authHeader.trim();
  if (!normalized.toLowerCase().startsWith('bearer ')) return 'non-bearer';
  const token = normalized.slice(7).trim();
  if (!token) return null;
  if (token.includes('.')) return 'jwt';
  return token.slice(0, 128);
}

function toErrorText(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 512);
  return String(error).slice(0, 512);
}

export const apiAccessLogMiddleware = createMiddleware<Env>(async (c, next) => {
  if (!c.req.path.startsWith('/api/')) {
    await next();
    return;
  }

  const startedAt = Date.now();
  let thrownError: unknown = null;

  try {
    await next();
  } catch (error) {
    thrownError = error;
    throw error;
  } finally {
    const url = new URL(c.req.url);
    const requestId = toSafeText(c.req.header('cf-ray'), 64) || crypto.randomUUID();
    const method = c.req.method.slice(0, 12);
    const path = url.pathname.slice(0, 256);
    const query = toSafeText(url.search || null, 1024);
    const status = Number.isFinite(c.res?.status) ? Number(c.res.status) : 500;
    const durationMs = Math.max(0, Date.now() - startedAt);
    const timestamp = Date.now();
    const ip = toSafeText(c.req.header('CF-Connecting-IP'), 64);
    const userAgent = toSafeText(c.req.header('user-agent'), 512);
    const cfRay = toSafeText(c.req.header('cf-ray'), 64);
    const requestBytes = toSafeInt(c.req.header('content-length'));
    const responseBytes = toSafeInt(c.res?.headers?.get('content-length'));
    const authSubject = inferAuthSubject(c.req.header('authorization'));
    const errorText = toErrorText(thrownError);

    await c.env.RouteDB.prepare(
      `INSERT INTO api_access_logs
         (request_id, method, path, query, status, duration_ms, timestamp, ip, user_agent, cf_ray, request_bytes, response_bytes, auth_subject, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        requestId,
        method,
        path,
        query,
        status,
        durationMs,
        timestamp,
        ip,
        userAgent,
        cfRay,
        requestBytes,
        responseBytes,
        authSubject,
        errorText
      )
      .run();
  }
});
