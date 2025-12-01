import { Hono } from 'hono';

export const otaRoute = new Hono();

/*** OTA ADMIN ENDPOINTS ***/

// Test endpoint
otaRoute.get('/test', async (c) => {
  return c.json({ test: 'ok' });
});

// List all bundles (KV)
otaRoute.get('/admin/bundles', async (c) => {
  const list = await c.env.BUNDLES.list();
  return c.json({ bundles: list.keys });
});

// Delete bundle (KV)
otaRoute.delete('/admin/bundle', async (c) => {
  const body = await c.req.json();
  const key = body.key;
  if (!key) return c.json({ error: 'Missing key' }, 400);

  await c.env.BUNDLES.delete(key);
  return c.json({ ok: true, deleted: key });
});

// List OTA channels / manifests (KV)
otaRoute.get('/admin/channels', async (c) => {
  const list = await c.env.OTA_MANIFEST.list();
  const manifests: Record<string, any> = {};

  for (const obj of list.keys) {
    const data = await c.env.OTA_MANIFEST.get(obj.name);
    if (data) {
      manifests[obj.name.replace('manifest:', '')] = JSON.parse(data);
    }
  }

  return c.json({ channels: manifests });
});

// Get single manifest (KV)
otaRoute.get('/admin/manifest/:channel', async (c) => {
  const channel = c.req.param('channel');
  const data = await c.env.OTA_MANIFEST.get(`manifest:${channel}`);
  if (!data) return c.json({ error: 'Channel not found' }, 404);
  return c.json(JSON.parse(data));
});

// Update manifest (KV)
otaRoute.put('/admin/manifest/:channel', async (c) => {
  const channel = c.req.param('channel');
  const manifest = await c.req.json();
  await c.env.OTA_MANIFEST.put(`manifest:${channel}`, JSON.stringify(manifest));
  return c.json({ ok: true, manifest });
});

// List OTA history (RouteDB)
otaRoute.get('/admin/history', async (c) => {
  try {
    const rows = await c.env.RouteDB.prepare(
      'SELECT * FROM history ORDER BY uploaded_at DESC'
    ).all();
    return c.json({ history: rows.results || [] });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

// Delete OTA history
otaRoute.delete('/admin/history', async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id;
    if (!id) return c.json({ error: 'Missing id' }, 400);

    const { success } = await c.env.RouteDB.prepare('DELETE FROM history WHERE id = ?')
      .bind(id)
      .run();

    if (!success) {
      return c.json({ error: 'Failed to delete history entry' }, 500);
    }

    return c.json({ ok: true, deleted: id });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

/*** OTA APP ENDPOINTS ***/

// Upload OTA build
otaRoute.post('/upload', async (c) => {
  try {
    const form = await c.req.formData();
    const file = form.get('file') as File;
    const version = form.get('version')?.toString() || Date.now().toString();
    const channel = form.get('channel')?.toString() || 'stable';

    if (!file) return c.json({ error: 'Missing file' }, 400);

    const key = `${channel}-${version}.zip`;

    // Save bundle to KV
    await c.env.BUNDLES.put(key, file.stream());

    // Update manifest in KV
    const manifest = {
      version,
      key,
      url: `${c.req.url.replace(/\/upload$/, '')}/bundle/${key}`,
      updated: new Date().toISOString(),
    };
    await c.env.OTA_MANIFEST.put(`manifest:${channel}`, JSON.stringify(manifest));

    // Insert into RouteDB history table
    await c.env.RouteDB.prepare(
      'INSERT INTO history (channel, version, filename, uploaded_at) VALUES (?, ?, ?, datetime("now"))'
    ).bind(channel, version, key).run();

    return c.json({ ok: true, manifest });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

// Check for update
otaRoute.get('/check', async (c) => {
  const channel = c.req.query('channel') || 'stable';
  const currentVersion = c.req.query('version');

  const data = await c.env.OTA_MANIFEST.get(`manifest:${channel}`);
  if (!data) return c.json({ update: false });

  const manifest = JSON.parse(data);
  const shouldUpdate = currentVersion !== manifest.version;
  
  return c.json({
    update: shouldUpdate,
    version: manifest.version,
    url: manifest.url,
  });
});

// Serve bundle file
otaRoute.get('/bundle/:key', async (c) => {
  const key = c.req.param('key');
  const file = await c.env.BUNDLES.get(key, { type: 'stream' });
  if (!file) return c.text('Bundle not found', 404);

  return new Response(file, {
    headers: {
      'Content-Type': 'application/zip',
      'Cache-Control': 'public, max-age=60',
    },
  });
});
