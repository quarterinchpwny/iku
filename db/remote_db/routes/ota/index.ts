import { Hono } from 'hono';

export const otaRoute = new Hono();

/*** OTA ADMIN ENDPOINTS ***/
otaRoute.get('/test', async (c) => {
  return c.json({ 'thisistest':'test' });
});
// List all bundles
otaRoute.get('/admin/bundles', async (c) => {
  const list = await c.env.BUNDLES.list();
  return c.json({ bundles: list.objects });
});

// Delete bundle
otaRoute.delete('/admin/bundle', async (c) => {
  const body = await c.req.json();
  const key = body.key;
  if (!key) return c.json({ error: 'Missing key' }, 400);

  await c.env.BUNDLES.delete(key);
  return c.json({ ok: true, deleted: key });
});

// List OTA channels / manifests
otaRoute.get('/admin/channels', async (c) => {
  const list = await c.env.OTA_MANIFEST.list();
  const manifests: Record<string, any> = {};

  for (const obj of list.keys) {
    const data = await c.env.OTA_MANIFEST.get(obj.name);
    manifests[obj.name.replace('manifest:', '')] = JSON.parse(data!);
  }

  return c.json({ channels: manifests });
});

// Get single manifest
otaRoute.get('/admin/manifest/:channel', async (c) => {
  const channel = c.req.param('channel');
  const data = await c.env.OTA_MANIFEST.get(`manifest:${channel}`);
  if (!data) return c.json({ error: 'Channel not found' }, 404);
  return c.json(JSON.parse(data));
});

// Update manifest
otaRoute.put('/admin/manifest/:channel', async (c) => {
  const channel = c.req.param('channel');
  const manifest = await c.req.json();
  await c.env.OTA_MANIFEST.put(`manifest:${channel}`, JSON.stringify(manifest));
  return c.json({ ok: true, manifest });
});

// List history
otaRoute.get('/admin/history', async (c) => {
  const rows = await c.env.OTA_HISTORY.prepare(
    'SELECT * FROM history ORDER BY uploaded_at DESC'
  ).all();
  return c.json({ history: rows.results });
});

/*** OTA APP ENDPOINTS ***/

// Upload OTA build
otaRoute.post('/upload', async (c) => {
  const form = await c.req.formData();
  const file = form.get('file') as File;
  const version = form.get('version')?.toString() || Date.now().toString();
  const channel = form.get('channel')?.toString() || 'stable';

  if (!file) return c.json({ error: 'Missing file' }, 400);

  const key = `${channel}-${version}.zip`;

  await c.env.BUNDLES.put(key, file.stream());

  const manifest = {
    version,
    key,
    url: `${c.req.url}/bundle/${key}`,
    updated: new Date().toISOString(),
  };

  await c.env.OTA_MANIFEST.put(`manifest:${channel}`, JSON.stringify(manifest));

  await c.env.OTA_HISTORY.prepare(
    `INSERT INTO history (channel, version, filename, uploaded_at)
     VALUES (?, ?, ?, datetime('now'))`
  )
    .bind(channel, version, key)
    .run();

  return c.json({ ok: true, manifest });
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
    url: manifest.key,
  });
});

// Serve bundle file
otaRoute.get('/bundle/:key', async (c) => {
  const key = c.req.param('key');
  const file = await c.env.BUNDLES.get(key);
  if (!file) return c.text('Bundle not found', 404);

  return new Response(file.body, {
    headers: {
      'Content-Type': 'application/zip',
      'Cache-Control': 'public, max-age=60',
    },
  });
});

