export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      /**
       * =====================================================
       * OTA ADMIN ENDPOINTS
       * =====================================================
       */

      // List all bundles stored in KV
      if (url.pathname === "/api/ota/admin/bundles" && method === "GET") {
        const list = await env.BUNDLES.list();
        return json({ bundles: list.objects }, corsHeaders);
      }

      // Delete bundle
      if (url.pathname === "/api/ota/admin/bundle" && method === "DELETE") {
        const body = await request.json();
        const key = body.key;
        if (!key) return err("Missing key", corsHeaders);

        await env.BUNDLES.delete(key);
        return json({ ok: true, deleted: key }, corsHeaders);
      }

      // List OTA channels / manifests
      if (url.pathname === "/api/ota/admin/channels" && method === "GET") {
        const list = await env.OTA_MANIFEST.list();
        const manifests = {};

        for (const obj of list.keys) {
          const data = await env.OTA_MANIFEST.get(obj.name);
          manifests[obj.name.replace("manifest:", "")] = JSON.parse(data);
        }

        return json({ channels: manifests }, corsHeaders);
      }

      // Get single manifest
      if (url.pathname.startsWith("/api/ota/admin/manifest/") && method === "GET") {
        const channel = url.pathname.split("/").pop();
        const data = await env.OTA_MANIFEST.get(`manifest:${channel}`);

        if (!data) return err("Channel not found", corsHeaders);

        return json(JSON.parse(data), corsHeaders);
      }

      // Update manifest (rollback, switch version)
      if (url.pathname.startsWith("/api/ota/admin/manifest/") && method === "PUT") {
        const channel = url.pathname.split("/").pop();
        const manifest = await request.json();

        await env.OTA_MANIFEST.put(`manifest:${channel}`, JSON.stringify(manifest));

        return json({ ok: true, manifest }, corsHeaders);
      }

      /**
       * =====================================================
       * OTA APP ENDPOINTS
       * =====================================================
       */

      // UPLOAD OTA BUILD
      if (url.pathname === "/api/ota/upload" && method === "POST") {
        const form = await request.formData();
        const file = form.get("file");
        const version = form.get("version") || Date.now().toString();
        const channel = form.get("channel") || "stable";

        if (!file) return err("Missing file", corsHeaders);

        const key = `${channel}-${version}.zip`;

        // Store bundle
        await env.BUNDLES.put(key, file.stream());

        const manifest = {
          version,
          key,
          url: `${url.origin}/api/ota/bundle/${key}`,
          updated: new Date().toISOString()
        };

        // Update active manifest
        await env.OTA_MANIFEST.put(`manifest:${channel}`, JSON.stringify(manifest));

        // Insert into OTA history (D1)
        await env.OTA_HISTORY.prepare(
          `INSERT INTO history (channel, version, filename, uploaded_at)
           VALUES (?, ?, ?, datetime('now'))`
        )
          .bind(channel, version, key)
          .run();

        return json({ ok: true, manifest }, corsHeaders);
      }

      // CHECK FOR UPDATE
      if (url.pathname === "/api/ota/check" && method === "GET") {
        const channel = url.searchParams.get("channel") || "stable";
        const currentVersion = url.searchParams.get("version");

        const data = await env.OTA_MANIFEST.get(`manifest:${channel}`);
        if (!data) return json({ update: false }, corsHeaders);

        const manifest = JSON.parse(data);
        const shouldUpdate = currentVersion !== manifest.version;

        return json({
          update: shouldUpdate,
          version: manifest.version,
          url: manifest.key
        }, corsHeaders);
      }

      // SERVE THE ZIP FILE
      const match = url.pathname.match(/^\/api\/ota\/bundle\/(.+)$/);
      if (match) {
        const key = match[1];
        const file = await env.BUNDLES.get(key);

        if (!file)
          return new Response("Bundle not found", { status: 404, headers: corsHeaders });

        return new Response(file.body, {
          headers: {
            "Content-Type": "application/zip",
            "Cache-Control": "public, max-age=60",
            ...corsHeaders
          }
        });
      }

      /**
       * =====================================================
       * OTA HISTORY (D1)
       * =====================================================
       */

      // List history
      if (url.pathname === "/api/ota/admin/history" && method === "GET") {
        const rows = await env.OTA_HISTORY.prepare(
          "SELECT * FROM history ORDER BY uploaded_at DESC"
        ).all();

        return json({ history: rows.results }, corsHeaders);
      }

      /**
       * =====================================================
       * ORIGINAL ROUTE & POINTS API
       * =====================================================
       */

      if (url.pathname === "/api/fetchAll" && method === "GET") {
        const routes = await env.RouteDB.prepare("SELECT * FROM routes").all();
        const points = await env.RouteDB.prepare("SELECT * FROM points").all();

        return json(
          { routes: routes.results, points: points.results },
          corsHeaders
        );
      }

      if (url.pathname === "/api/sync" && method === "POST") {
        const body = await request.json();
        const { table, changes } = body;
        const idMap = {};

        if (table === "routes") {
          const insertedIds = [];

          for (const row of changes) {
            const tempId = row.id;

            const result = await env.RouteDB.prepare(
              `INSERT INTO routes (timestamp) VALUES (?)`
            )
              .bind(row.timestamp)
              .run();

            if (result.success) {
              const newId = result.meta.last_row_id;
              insertedIds.push(newId);
              idMap[tempId] = newId;
            }
          }

          return json({ success: true, ids: insertedIds, idMap }, corsHeaders);
        }

        if (table === "points") {
          const insertedIds = [];

          for (const row of changes) {
            const realRouteId = idMap[row.routeId] || row.routeId;

            const result = await env.RouteDB.prepare(
              `INSERT INTO points (routeId, lat, lng, timestamp)
               VALUES (?, ?, ?, ?)`
            )
              .bind(realRouteId, row.lat, row.lng, row.timestamp)
              .run();

            if (result.success) insertedIds.push(result.meta.last_row_id);
          }

          return json({ success: true, ids: insertedIds }, corsHeaders);
        }
      }

      if (url.pathname === "/api/sync" && method === "DELETE") {
        const body = await request.json();
        const { table, id } = body;

        if (table === "routes") {
          await env.RouteDB.prepare("DELETE FROM routes WHERE id = ?")
            .bind(id)
            .run();
        }

        if (table === "points") {
          await env.RouteDB.prepare("DELETE FROM points WHERE id = ?")
            .bind(id)
            .run();
        }

        return json({ success: true }, corsHeaders);
      }

      return new Response("Not found", { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(`Error: ${err.message}`, {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

/*** Helpers ***/
function json(obj, headers) {
  return new Response(JSON.stringify(obj), {
    headers: { "Content-Type": "application/json", ...headers }
  });
}

function err(message, headers) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json", ...headers }
  });
}
