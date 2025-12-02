import { Hono } from 'hono'
import { otaRoute } from '../routes/ota';
import { locationSync } from '../routes/location-sync';
import { authRoutes } from './auth/routes';


import { cors } from 'hono/cors';

const app = new Hono<{ Bindings: { RouteDB: D1Database } }>()

// This middleware runs on all requests to check for the DB binding.
// It provides a clear JSON error if the binding is missing.
app.use('*', async (c, next) => {
  if (!c.env.RouteDB) {
    return c.json({ 
      error: "Database binding not found", 
      message: "The D1 database binding 'RouteDB' is not configured. Please check your wrangler.toml file and Cloudflare dashboard." 
    }, 500);
  }
  await next();
});

app.use('*', cors({ origin: '*' }));



const _apiRoutes = app
  .basePath("/api")
    .route("/ota", otaRoute)
    .route("/location",locationSync)
    .route('/auth', authRoutes);


export default app;
export type ApiRoutes = typeof _apiRoutes;