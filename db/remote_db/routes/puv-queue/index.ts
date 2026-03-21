import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { adminOnlyMiddleware, authMiddleware } from '../../src/auth/middleware';
import { ESTIMATE_RESPONSE_CACHE_SECONDS, HEATMAP_RESPONSE_CACHE_SECONDS, ROUTES_RESPONSE_CACHE_SECONDS } from './constants';
import { invalidateCachedDuration } from './cache';
import { deleteQueueRoute, getDefaultQueueRoute, getQueueRoute, listQueueRoutes, saveQueueRoute } from './repository';
import { createQueueRouteSchema, updateQueueRouteSchema } from './schemas';
import type { CreateQueueRouteInput, UpdateQueueRouteInput } from './schemas';
import { buildHeatmap, buildQueueEstimate } from './service';
import type { PuvQueueEnv } from './types';

export const puvQueueRoute = new Hono<PuvQueueEnv>();

puvQueueRoute.use('/admin/*', authMiddleware, adminOnlyMiddleware);

function setPublicCache(c: any, seconds: number): void {
  c.header('Cache-Control', `public, max-age=${seconds}, s-maxage=${seconds}`);
}

async function resolveRoute(c: any, routeKey: string | undefined) {
  const route = routeKey
    ? await getQueueRoute(c.env.RouteDB, routeKey)
    : await getDefaultQueueRoute(c.env.RouteDB);

  if (!route || !route.is_active) {
    return null;
  }

  return route;
}

puvQueueRoute.get('/routes', async (c) => {
  setPublicCache(c, ROUTES_RESPONSE_CACHE_SECONDS);
  const routes = await listQueueRoutes(c.env.RouteDB, true);
  return c.json({ routes });
});

puvQueueRoute.get('/routes/:routeKey', async (c) => {
  setPublicCache(c, ROUTES_RESPONSE_CACHE_SECONDS);
  const route = await getQueueRoute(c.env.RouteDB, c.req.param('routeKey'));
  if (!route || !route.is_active) {
    return c.json({ error: 'Route not found' }, 404);
  }
  return c.json(route);
});

puvQueueRoute.get('/estimate', async (c) => {
  const route = await resolveRoute(c, c.req.query('routeKey'));
  if (!route) {
    return c.json({ error: 'Route not found or no default route configured' }, 404);
  }

  setPublicCache(c, ESTIMATE_RESPONSE_CACHE_SECONDS);
  const includePolyline = c.req.query('polyline') === '1';
  const estimate = await buildQueueEstimate(c.env.RouteDB, c.env.ORS_API_KEY, route, includePolyline);
  return c.json(estimate);
});

puvQueueRoute.get('/heatmap', async (c) => {
  const route = await resolveRoute(c, c.req.query('routeKey'));
  if (!route) {
    return c.json({ error: 'Route not found or no default route configured' }, 404);
  }

  setPublicCache(c, HEATMAP_RESPONSE_CACHE_SECONDS);
  return c.json(buildHeatmap(route));
});

puvQueueRoute.get('/admin/routes', async (c) => {
  const routes = await listQueueRoutes(c.env.RouteDB, false);
  return c.json({ routes });
});

puvQueueRoute.get('/admin/routes/:routeKey', async (c) => {
  const route = await getQueueRoute(c.env.RouteDB, c.req.param('routeKey'));
  if (!route) {
    return c.json({ error: 'Route not found' }, 404);
  }
  return c.json(route);
});

puvQueueRoute.post('/admin/routes', zValidator('json', createQueueRouteSchema), async (c) => {
  const route = await saveQueueRoute(c.env.RouteDB, c.req.valid('json') as CreateQueueRouteInput);
  return c.json(route, 201);
});

puvQueueRoute.put('/admin/routes/:routeKey', zValidator('json', updateQueueRouteSchema), async (c) => {
  const routeKey = c.req.param('routeKey');
  const existing = await getQueueRoute(c.env.RouteDB, routeKey);

  if (!existing) {
    return c.json({ error: 'Route not found' }, 404);
  }

  const input = c.req.valid('json') as UpdateQueueRouteInput;
  const route = await saveQueueRoute(c.env.RouteDB, {
    route_key: routeKey,
    ...input,
  });

  return c.json(route);
});

puvQueueRoute.delete('/admin/routes/:routeKey', async (c) => {
  const deleted = await deleteQueueRoute(c.env.RouteDB, c.req.param('routeKey'));
  if (!deleted) {
    return c.json({ error: 'Route not found' }, 404);
  }
  return c.json({ deleted: true });
});

puvQueueRoute.post('/admin/cache/invalidate', async (c) => {
  const routeKey = c.req.query('routeKey');
  const invalidated = await invalidateCachedDuration(c.env.RouteDB, routeKey);
  return c.json({ invalidated, route_key: routeKey ?? null });
});

puvQueueRoute.post('/cache/invalidate', authMiddleware, adminOnlyMiddleware, async (c) => {
  const routeKey = c.req.query('routeKey');
  const invalidated = await invalidateCachedDuration(c.env.RouteDB, routeKey);
  return c.json({ invalidated, route_key: routeKey ?? null });
});
