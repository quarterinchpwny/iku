export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    if (url.pathname === "/api/fetchAll" && method === "GET") {
      // Return all data from D1
      const routes = await env.ROUTE_DB.prepare("SELECT * FROM routes").all();
      const points = await env.ROUTE_DB.prepare("SELECT * FROM points").all();

      return Response.json({
        routes: routes.results,
        points: points.results,
      });
    }

    if (url.pathname === "/api/sync" && method === "POST") {
      const body = await request.json();
      const { table, data } = body;

      if (table === "routes") {
        await env.ROUTE_DB.prepare(
          `INSERT INTO routes (id, timestamp) VALUES (?, ?)
           ON CONFLICT(id) DO UPDATE SET timestamp=excluded.timestamp`
        )
          .bind(data.id, data.timestamp)
          .run();
      }

      if (table === "points") {
        await env.ROUTE_DB.prepare(
          `INSERT INTO points (id, routeId, timestamp) VALUES (?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET routeId=excluded.routeId, timestamp=excluded.timestamp`
        )
          .bind(data.id, data.routeId, data.timestamp)
          .run();
      }

      return Response.json({ success: true });
    }

    if (url.pathname === "/api/sync" && method === "DELETE") {
      const body = await request.json();
      const { table, id } = body;

      if (table === "routes") {
        await env.ROUTE_DB.prepare("DELETE FROM routes WHERE id = ?")
          .bind(id)
          .run();
      }

      if (table === "points") {
        await env.ROUTE_DB.prepare("DELETE FROM points WHERE id = ?")
          .bind(id)
          .run();
      }

      return Response.json({ success: true });
    }

    return new Response("Not found", { status: 404 });
  },
};
