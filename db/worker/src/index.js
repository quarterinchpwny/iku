export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    try {
      // Fetch everything
      if (url.pathname === '/api/fetchAll' && method === 'GET') {
        const routes = await env.RouteDB.prepare('SELECT * FROM routes').all();
        const points = await env.RouteDB.prepare('SELECT * FROM points').all();

        return Response.json({
          routes: routes.results,
          points: points.results
        });
      }

      // Sync (insert/update)
      if (url.pathname === '/api/sync' && method === 'POST') {
        const body = await request.json();
        const { table, data } = body;

        if (table === 'routes') {
          await env.RouteDB.prepare(`INSERT INTO routes (timestamp) VALUES (?)`)
            .bind(data.timestamp)
            .run();
        }

        if (table === 'points') {
          await env.RouteDB.prepare(`INSERT INTO points (routeId, timestamp) VALUES (?, ?)`)
            .bind(data.routeId, data.timestamp)
            .run();
        }

        return Response.json({ success: true });
      }

      // Delete
      if (url.pathname === '/api/sync' && method === 'DELETE') {
        const body = await request.json();
        const { table, id } = body;

        if (table === 'routes') {
          await env.RouteDB.prepare('DELETE FROM routes WHERE id = ?').bind(id).run();
        }

        if (table === 'points') {
          await env.RouteDB.prepare('DELETE FROM points WHERE id = ?').bind(id).run();
        }

        return Response.json({ success: true });
      }

      return new Response('Not found', { status: 404 });
    } catch (err) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  }
};
