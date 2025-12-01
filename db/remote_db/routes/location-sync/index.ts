import { Hono } from 'hono';

export const locationSync = new Hono();



/*** ROUTE & POINTS SYNC API ***/
locationSync.get('/test', async (c) => {

  return c.json({ 'test':'test' });
});

// Fetch all routes and points
locationSync.get('/fetchAll', async (c) => {
  const routes = await c.env.RouteDB.prepare('SELECT * FROM routes').all();
  const points = await c.env.RouteDB.prepare('SELECT * FROM points').all();
  return c.json({ routes: routes.results, points: points.results });
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

  return c.json({ error: 'Invalid table' }, 400);
});

// Delete row
locationSync.delete('/sync', async (c) => {
  const body = await c.req.json();
  const { table, id } = body;

  if (table === 'routes') {
    await c.env.RouteDB.prepare('DELETE FROM routes WHERE id = ?').bind(id).run();
  } else if (table === 'points') {
    await c.env.RouteDB.prepare('DELETE FROM points WHERE id = ?').bind(id).run();
  } else {
    return c.json({ error: 'Invalid table' }, 400);
  }

  return c.json({ success: true });
});
