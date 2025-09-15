export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // Fetch everything
      if (url.pathname === '/api/fetchAll' && method === 'GET') {
        const routes = await env.RouteDB.prepare('SELECT * FROM routes').all();
        const points = await env.RouteDB.prepare('SELECT * FROM points').all();

        return new Response(JSON.stringify({ routes: routes.results, points: points.results }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Sync (insert/update)
      if (url.pathname === '/api/sync' && method === 'POST') {
        const body = await request.json();
        const { table, changes } = body;

        // Store mapping from tempId → new DB id
        const idMap = {};

        // Insert routes
        if (table === 'routes') {
          const insertedIds = [];

          for (const row of changes) {
            const tempId = row.id; // Dexie local id
            const result = await env.RouteDB.prepare(`INSERT INTO routes (timestamp) VALUES (?)`)
              .bind(row.timestamp)
              .run();

            if (result.success) {
              const newId = result.meta.last_row_id;
              insertedIds.push(newId);
              if (tempId !== undefined) idMap[tempId] = newId;
            }
          }

          return new Response(JSON.stringify({ success: true, ids: insertedIds, idMap }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Insert points
        if (table === 'points') {
          const insertedIds = [];

          for (const row of changes) {
            // Replace routeId with real id if it's in the idMap
            const realRouteId = idMap[row.routeId] || row.routeId;

            const result = await env.RouteDB.prepare(
              `INSERT INTO points (routeId, lat, lng, timestamp) VALUES (?, ?, ?, ?)`
            )
              .bind(realRouteId, row.lat, row.lng, row.timestamp)
              .run();

            if (result.success) {
              insertedIds.push(result.meta.last_row_id);
            }
          }

          return new Response(JSON.stringify({ success: true, ids: insertedIds }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
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

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      return new Response('Not found', { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(`Error: ${err.message}`, {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};
