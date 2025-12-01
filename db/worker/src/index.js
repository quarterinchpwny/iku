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
      /**
       * -----------------------------------------------------
       * OTA ENDPOINTS
       * -----------------------------------------------------
       */

      // 1) Upload bundle to cloudflare → from VSCode server
      if (url.pathname === '/api/ota/upload' && method === 'POST') {
        const form = await request.formData();
        const file = form.get("file");
        const version = form.get("version") || Date.now().toString();
        const channel = form.get("channel") || "stable";

        if (!file) {
          return new Response("Missing file", { status: 400, headers: corsHeaders });
        }

        const key = `${channel}-${version}.zip`;

        await env.BUNDLES.put(key, file.stream());

        const manifest = {
          version,
          key,
          url: `${url.origin}/api/ota/bundle/${key}`,
          updated: new Date().toISOString()
        };

        await env.OTA_MANIFEST.put(`manifest:${channel}`, JSON.stringify(manifest));

        return new Response(JSON.stringify({ ok: true, manifest }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // 2) Check update → app calls this on startup
      if (url.pathname === '/api/ota/check' && method === 'GET') {
        const channel = url.searchParams.get("channel") || "stable";
        const currentVersion = url.searchParams.get("version") || null;
        const data = await env.OTA_MANIFEST.get(`manifest:${channel}`);

        if (!data) {
          return new Response(JSON.stringify({ update: false }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const manifest = JSON.parse(data);

        const shouldUpdate = currentVersion !== manifest.version;

        return new Response(JSON.stringify({
          update: shouldUpdate,
          version: manifest.version,
          url: manifest.key
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }


      // 3) Serve bundle zip file
      const bundleMatch = url.pathname.match(/^\/api\/ota\/bundle\/(.+)$/);
      if (bundleMatch) {
        const key = bundleMatch[1];
        const obj = await env.BUNDLES.get(key);

        if (!obj) {
          return new Response("Bundle not found", { status: 404, headers: corsHeaders });
        }

        return new Response(obj.body, {
          headers: {
            'Content-Type': 'application/zip',
            'Cache-Control': 'public, max-age=60',
            ...corsHeaders
          }
        });
      }

      /**
       * -----------------------------------------------------
       * Routes api (unchanged)
       * -----------------------------------------------------
       */

      // Fetch everything
      if (url.pathname === '/api/fetchAll' && method === 'GET') {
        const routes = await env.RouteDB.prepare('SELECT * FROM routes').all();
        const points = await env.RouteDB.prepare('SELECT * FROM points').all();

        return new Response(
          JSON.stringify({ routes: routes.results, points: points.results }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Sync (insert/update)
      if (url.pathname === '/api/sync' && method === 'POST') {
        const body = await request.json();
        const { table, changes } = body;

        const idMap = {};

        if (table === 'routes') {
          const insertedIds = [];

          for (const row of changes) {
            const tempId = row.id;
            const result = await env.RouteDB.prepare(
              `INSERT INTO routes (timestamp) VALUES (?)`
            ).bind(row.timestamp).run();

            if (result.success) {
              const newId = result.meta.last_row_id;
              insertedIds.push(newId);
              idMap[tempId] = newId;
            }
          }

          return new Response(JSON.stringify({ success: true, ids: insertedIds, idMap }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        if (table === 'points') {
          const insertedIds = [];

          for (const row of changes) {
            const realRouteId = idMap[row.routeId] || row.routeId;

            const result = await env.RouteDB.prepare(
              `INSERT INTO points (routeId, lat, lng, timestamp) VALUES (?, ?, ?, ?)`
            )
              .bind(realRouteId, row.lat, row.lng, row.timestamp)
              .run();

            if (result.success) insertedIds.push(result.meta.last_row_id);
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
