import { Hono } from 'hono'
import { otaRoute } from '../routes/ota';
import { locationSync } from '../routes/location-sync';
import { authRoutes } from './auth/routes';
import { apiAccessLogMiddleware } from './observability/api-access-log';


import { cors } from 'hono/cors';

const app = new Hono<{ Bindings: { RouteDB: D1Database, JWT_SECRET: string, BUNDLES: KVNamespace, OTA_MANIFEST: KVNamespace, ASSETS: Fetcher } }>()

// This middleware runs on all requests to check for the DB binding.
// It provides a clear JSON error if the binding is missing.
app.use('*', async (c, next) => {
  if (!c.env.RouteDB) {
    return c.json({ 
      error: "Database binding not found", 
      message: "The D1 database binding 'RouteDB' is not configured. Please check your wrangler.toml file and Cloudflare dashboard." 
    }, 500);
  }
  if (!c.env.JWT_SECRET) {
    return c.json({ 
      error: "JWT secret not found", 
      message: "The JWT secret 'JWT_SECRET' is not configured. Please add it using 'wrangler secret put JWT_SECRET'." 
    }, 500);
  }
  if (!c.env.BUNDLES) { // Check for KV BUNDLES
    return c.json({
      error: "KV BUNDLES binding not found",
      message: "The KV Namespace binding 'BUNDLES' is not configured. Please check your wrangler.toml file."
    }, 500);
  }
  if (!c.env.OTA_MANIFEST) { // Check for KV OTA_MANIFEST
    return c.json({
      error: "KV OTA_MANIFEST binding not found",
      message: "The KV Namespace binding 'OTA_MANIFEST' is not configured. Please check your wrangler.toml file."
    }, 500);
  }
  if (!c.env.ASSETS) {
    return c.json({
      error: "ASSETS binding not found",
      message: "The static assets binding 'ASSETS' is not configured. Please check your wrangler.toml file."
    }, 500);
  }
  await next();
});

app.use('*', cors({ origin: '*' }));
app.use('/api/*', apiAccessLogMiddleware);



const _apiRoutes = app
  .basePath("/api")
    .route("/ota", otaRoute)
    .route("/location",locationSync)
    .route('/auth', authRoutes);

app.get('*', async (c) => {
  const assetResponse = await c.env.ASSETS.fetch(c.req.raw);
  if (assetResponse.status !== 404) {
    return assetResponse;
  }

  const url = new URL(c.req.url);
  if (url.pathname.startsWith('/api/')) {
    return assetResponse;
  }
  const hasExtension = /\/[^/]+\.[^/]+$/.test(url.pathname);
  if (hasExtension) {
    return assetResponse;
  }

  const fallbackUrl = new URL(c.req.url);
  fallbackUrl.pathname = '/index.html';
  fallbackUrl.search = '';
  return c.env.ASSETS.fetch(new Request(fallbackUrl.toString(), c.req.raw));
});


export default app;
export type ApiRoutes = typeof _apiRoutes;
