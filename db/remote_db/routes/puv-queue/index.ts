import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { adminOnlyMiddleware, authMiddleware } from '../../src/auth/middleware';
import { invalidateCachedDuration } from './cache';
import { listHolidayCalendar, syncHolidayCalendar } from './calendar';
import { ESTIMATE_RESPONSE_CACHE_SECONDS, HEATMAP_RESPONSE_CACHE_SECONDS, ROUTES_RESPONSE_CACHE_SECONDS } from './constants';
import { deleteIncident, listRouteIncidents, saveIncident } from './incidents';
import { createObservation, deleteObservation, listRouteObservations } from './observations';
import { deleteQueueRoute, getDefaultQueueRoute, getQueueRoute, listQueueRoutes, saveQueueRoute } from './repository';
import { createQueueRouteSchema, queueIncidentSchema, queueObservationSchema, updateQueueRouteSchema } from './schemas';
import type { CreateQueueRouteInput, QueueIncidentInput, QueueObservationInput, UpdateQueueRouteInput } from './schemas';
import { buildHeatmap, buildQueueEstimate } from './service';
import type { PuvQueueEnv } from './types';
import { discoverNearbyVenues } from './venues';

export const puvQueueRoute = new Hono<PuvQueueEnv>();

puvQueueRoute.use('/admin/*', authMiddleware, adminOnlyMiddleware);

function setPublicCache(c: any, seconds: number): void {
  c.header('Cache-Control', `public, max-age=${seconds}, s-maxage=${seconds}`);
}

function getRequestedYear(value: string | undefined): number {
  const year = Number(value ?? new Date().getUTCFullYear());
  return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : new Date().getUTCFullYear();
}

function getRequestedLimit(value: string | undefined, fallback: number): number {
  const limit = Number(value ?? fallback);
  return Number.isInteger(limit) ? Math.max(1, Math.min(limit, 100)) : fallback;
}

function getRequestedRadius(value: string | undefined): number {
  const radius = Number(value ?? 2500);
  return Number.isFinite(radius) ? Math.max(250, Math.min(radius, 10000)) : 2500;
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
  return c.json(await buildHeatmap(c.env.RouteDB, route));
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
  const input = c.req.valid('json') as CreateQueueRouteInput;
  const existing = await getQueueRoute(c.env.RouteDB, input.route_key);

  if (existing) {
    return c.json({ error: 'Route key already exists' }, 409);
  }

  const route = await saveQueueRoute(c.env.RouteDB, input);
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

puvQueueRoute.get('/admin/holidays', async (c) => {
  const year = getRequestedYear(c.req.query('year'));
  const holidays = await listHolidayCalendar(c.env.RouteDB, year);
  return c.json({ year, holidays });
});

puvQueueRoute.post('/admin/holidays/sync', async (c) => {
  const year = getRequestedYear(c.req.query('year'));
  const result = await syncHolidayCalendar(c.env.RouteDB, year);
  return c.json(result);
});

puvQueueRoute.get('/admin/incidents', async (c) => {
  const routeKey = c.req.query('routeKey');
  if (!routeKey) {
    return c.json({ error: 'Route key is required' }, 400);
  }

  const incidents = await listRouteIncidents(c.env.RouteDB, routeKey);
  return c.json({ route_key: routeKey, incidents });
});

puvQueueRoute.post('/admin/incidents', zValidator('json', queueIncidentSchema), async (c) => {
  const incident = await saveIncident(c.env.RouteDB, c.req.valid('json') as QueueIncidentInput);
  return c.json(incident, 201);
});

puvQueueRoute.put('/admin/incidents/:id', zValidator('json', queueIncidentSchema), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) {
    return c.json({ error: 'Invalid incident id' }, 400);
  }

  const incident = await saveIncident(c.env.RouteDB, c.req.valid('json') as QueueIncidentInput, id);
  return c.json(incident);
});

puvQueueRoute.delete('/admin/incidents/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) {
    return c.json({ error: 'Invalid incident id' }, 400);
  }

  const deleted = await deleteIncident(c.env.RouteDB, id);
  if (!deleted) {
    return c.json({ error: 'Incident not found' }, 404);
  }
  return c.json({ deleted: true });
});

puvQueueRoute.get('/admin/observations', async (c) => {
  const routeKey = c.req.query('routeKey');
  if (!routeKey) {
    return c.json({ error: 'Route key is required' }, 400);
  }

  const observations = await listRouteObservations(
    c.env.RouteDB,
    routeKey,
    getRequestedLimit(c.req.query('limit'), 20),
  );
  return c.json({ route_key: routeKey, observations });
});

puvQueueRoute.post('/admin/observations', zValidator('json', queueObservationSchema), async (c) => {
  const observation = await createObservation(c.env.RouteDB, c.req.valid('json') as QueueObservationInput);
  return c.json(observation, 201);
});

puvQueueRoute.delete('/admin/observations/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) {
    return c.json({ error: 'Invalid observation id' }, 400);
  }

  const deleted = await deleteObservation(c.env.RouteDB, id);
  if (!deleted) {
    return c.json({ error: 'Observation not found' }, 404);
  }
  return c.json({ deleted: true });
});

puvQueueRoute.get('/admin/venues/discover', async (c) => {
  const routeKey = c.req.query('routeKey');
  if (!routeKey) {
    return c.json({ error: 'Route key is required' }, 400);
  }

  const route = await getQueueRoute(c.env.RouteDB, routeKey);
  if (!route) {
    return c.json({ error: 'Route not found' }, 404);
  }

  const venues = await discoverNearbyVenues(c.env.GOOGLE_MAPS_API_KEY, route, getRequestedRadius(c.req.query('radiusMeters')));
  return c.json({ route_key: routeKey, venues });
});

puvQueueRoute.post('/cache/invalidate', authMiddleware, adminOnlyMiddleware, async (c) => {
  const routeKey = c.req.query('routeKey');
  const invalidated = await invalidateCachedDuration(c.env.RouteDB, routeKey);
  return c.json({ invalidated, route_key: routeKey ?? null });
});
