import { Hono } from 'hono';

type Bindings = {
  RouteDB: D1Database;
};

export const locationSync = new Hono<{ Bindings: Bindings }>();



/*** ROUTE & POINTS SYNC API ***/
locationSync.get('/test', async (c) => {

  return c.json({ 'test':'test' });
});

// Fetch all routes and points
locationSync.get('/fetchAll', async (c) => {
  const routes = await c.env.RouteDB.prepare('SELECT * FROM routes').all();
  const points = await c.env.RouteDB.prepare('SELECT * FROM points').all();
  const passive = await c.env.RouteDB.prepare('SELECT * FROM passive_locations').all();
  return c.json({ 
    routes: routes.results, 
    points: points.results,
    passive_locations: passive.results 
  });
});

// Sync insert
locationSync.post('/sync', async (c) => {
  const body = await c.req.json();
  const { table, changes } = body;
  const idMap: Record<number, number> = {};
  const insertedIds: number[] = [];

  if (table === 'routes') {
    for (const row of changes) {
      const tempId = row.id;
      const result = await c.env.RouteDB.prepare(
        'INSERT INTO routes (timestamp) VALUES (?)'
      ).bind(row.timestamp).run();

      if (result.success) {
        const newId = result.meta.last_row_id;
        insertedIds.push(newId);
        idMap[tempId] = newId;
      }
    }
    return c.json({ success: true, ids: insertedIds, idMap });
  }

  if (table === 'points') {
    for (const row of changes) {
      const realRouteId = idMap[row.routeId] || row.routeId;
      const result = await c.env.RouteDB.prepare(
        'INSERT INTO points (routeId, lat, lng, timestamp) VALUES (?, ?, ?, ?)'
      ).bind(realRouteId, row.lat, row.lng, row.timestamp).run();

      if (result.success) insertedIds.push(result.meta.last_row_id);
    }
    return c.json({ success: true, ids: insertedIds });
  }

  if (table === 'passive_locations') {
    for (const row of changes) {
      const result = await c.env.RouteDB.prepare(
        'INSERT INTO passive_locations (lat, lng, timestamp) VALUES (?, ?, ?)'
      ).bind(row.lat, row.lng, row.timestamp).run();

      if (result.success) insertedIds.push(result.meta.last_row_id);
    }
    return c.json({ success: true, ids: insertedIds });
  }

  return c.json({ error: 'Invalid table' }, 400);
});

// Delete row
locationSync.delete('/sync', async (c) => {
  const body = await c.req.json();
  const { table, id } = body;

  if (table === 'routes') {
    // Delete associated points first (though schema has CASCADE, being explicit doesn't hurt)
    await c.env.RouteDB.prepare('DELETE FROM points WHERE routeId = ?').bind(id).run();
    await c.env.RouteDB.prepare('DELETE FROM routes WHERE id = ?').bind(id).run();
  } else if (table === 'points') {
    await c.env.RouteDB.prepare('DELETE FROM points WHERE id = ?').bind(id).run();
  } else if (table === 'passive_locations') {
    await c.env.RouteDB.prepare('DELETE FROM passive_locations WHERE id = ?').bind(id).run();
  } else {
    return c.json({ error: 'Invalid table' }, 400);
  }

  return c.json({ success: true });
});
