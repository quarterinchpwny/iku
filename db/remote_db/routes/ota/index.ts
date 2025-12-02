import { Hono } from 'hono';
import { authMiddleware } from '../../src/auth/middleware';

export const otaRoute = new Hono();
const adminRoutes = new Hono();

// Secure all admin routes
adminRoutes.use('*', authMiddleware);

/*** OTA ADMIN ENDPOINTS ***/

// Test endpoint
adminRoutes.get('/test', async (c) => {
  return c.json({ test: 'ok' });
});

// List all bundles (KV)
adminRoutes.get('/bundles', async (c) => {
  const list = await c.env.BUNDLES.list();
  return c.json({ bundles: list.keys });
});

// Delete bundle (KV)
adminRoutes.delete('/bundle', async (c) => {
  const body = await c.req.json();
  const key = body.key;
  if (!key) return c.json({ error: 'Missing key' }, 400);

  await c.env.BUNDLES.delete(key);
  return c.json({ ok: true, deleted: key });
});

// List OTA channels / manifests (KV)
adminRoutes.get('/channels', async (c) => {
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
adminRoutes.get('/manifest/:channel', async (c) => {
  const channel = c.req.param('channel');
  const data = await c.env.OTA_MANIFEST.get(`manifest:${channel}`);
  if (!data) return c.json({ error: 'Channel not found' }, 404);
  return c.json(JSON.parse(data));
});

// Update manifest (KV)
adminRoutes.put('/manifest/:channel', async (c) => {
  const channel = c.req.param('channel');
  const manifest = await c.req.json();
  await c.env.OTA_MANIFEST.put(`manifest:${channel}`, JSON.stringify(manifest));
  return c.json({ ok: true, manifest });
});

// List OTA history (RouteDB)
adminRoutes.get('/history', async (c) => {
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

// Delete OTA history and associated bundle
adminRoutes.delete('/history', async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id;
    const filename = body.filename;
    if (!id) return c.json({ error: 'Missing id' }, 400);
    if (!filename) return c.json({ error: 'Missing filename' }, 400);

    // Delete from DB
    const { success } = await c.env.RouteDB.prepare('DELETE FROM history WHERE id = ?')
      .bind(id)
      .run();

    if (!success) {
      return c.json({ error: 'Failed to delete history entry' }, 500);
    }

    // Delete from R2
    await c.env.BUNDLES.delete(filename);

    return c.json({ ok: true, deleted: {id, filename} });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

/*** APK ADMIN ENDPOINTS ***/

// Upload APK
adminRoutes.post('/apk/upload', async (c) => {
  try {
    const form = await c.req.formData();
    const file = form.get('file') as File;
    const version = form.get('version')?.toString() || Date.now().toString();

    if (!file || !file.name.endsWith('.apk')) return c.json({ error: 'Missing apk file' }, 400);

    const key = `apk-${version}-${file.name}`;

    // Save bundle to R2
    await c.env.BUNDLES.put(key, file.stream());

    // Insert into RouteDB history table
    await c.env.RouteDB.prepare(
      'INSERT INTO history (channel, version, filename, uploaded_at) VALUES (?, ?, ?, datetime("now"))'
    ).bind('apk', version, key).run();

    return c.json({ ok: true, uploaded: { version, key } });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

// List APKs
adminRoutes.get('/apks', async (c) => {
  try {
    const rows = await c.env.RouteDB.prepare(
      "SELECT * FROM history WHERE channel = 'apk' ORDER BY uploaded_at DESC"
    ).all();
    return c.json({ apks: rows.results || [] });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

// Delete APK history and associated bundle
adminRoutes.delete('/apk', async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id;
    const filename = body.filename;
    if (!id) return c.json({ error: 'Missing id' }, 400);
    if (!filename) return c.json({ error: 'Missing filename' }, 400);

    // Delete from DB
    const { success } = await c.env.RouteDB.prepare('DELETE FROM history WHERE id = ? AND channel = ?')
      .bind(id, 'apk')
      .run();

    if (!success) {
      return c.json({ error: 'Failed to delete apk history entry' }, 500);
    }

    // Delete from R2
    await c.env.BUNDLES.delete(filename);

    return c.json({ ok: true, deleted: {id, filename} });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

// Mount the admin sub-router
otaRoute.route('/admin', adminRoutes);


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

  let contentType = 'application/octet-stream';
  if (key.endsWith('.zip')) {
    contentType = 'application/zip';
  } else if (key.endsWith('.apk')) {
    contentType = 'application/vnd.android.package-archive';
  }

  return new Response(file, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=60',
    },
  });
});

