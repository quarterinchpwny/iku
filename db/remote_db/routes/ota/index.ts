import { Hono } from 'hono';
import { authMiddleware, adminOnlyMiddleware } from '../../src/auth/middleware';

type Env = {
  Bindings: {
    RouteDB: D1Database;
    JWT_SECRET: string;
    BUNDLES: KVNamespace;
    OTA_MANIFEST: KVNamespace;
  }
}

export const otaRoute = new Hono<Env>();

otaRoute.use('/admin/*', authMiddleware, adminOnlyMiddleware);

async function deleteHistoryAndBundle(c: any, id: number, filename: string, channel: string) {
  const { success } = await c.env.RouteDB.prepare('DELETE FROM history WHERE id = ? AND channel = ?')
    .bind(id, channel)
    .run();

  if (!success) {
    throw new Error('Failed to delete history entry from D1');
  }

  await c.env.BUNDLES.delete(filename);

  const manifestKey = `manifest:${channel}`;
  const manifestData = await c.env.OTA_MANIFEST.get(manifestKey);

  if (manifestData) {
    const manifest = JSON.parse(manifestData);
    
    if (manifest.key === filename) {
      const { results } = await c.env.RouteDB.prepare(
        'SELECT version, filename FROM history WHERE channel = ? ORDER BY uploaded_at DESC LIMIT 1'
      ).bind(channel).all<{ version: string; filename: string }>();

      if (results.length > 0) {
        const latestEntry = results[0];
        const url = new URL(c.req.url);
        const newManifest = {
          version: latestEntry.version,
          key: latestEntry.filename,
          url: `${url.origin}/api/ota/bundle/${latestEntry.filename}`,
          updated: new Date().toISOString(),
        };
        await c.env.OTA_MANIFEST.put(manifestKey, JSON.stringify(newManifest));
      } else {
        await c.env.OTA_MANIFEST.delete(manifestKey);
      }
    }
  }
}

otaRoute.get('/admin/history', async (c) => {
  try {
    const { results } = await c.env.RouteDB.prepare(
      'SELECT * FROM history ORDER BY uploaded_at DESC'
    ).all();
    return c.json({ history: results || [] });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

otaRoute.get('/admin/bundles', async (c) => {
  const list = await c.env.BUNDLES.list();
  return c.json({ bundles: list.keys });
});

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

otaRoute.get('/admin/manifest/:channel', async (c) => {
  const channel = c.req.param('channel');
  const data = await c.env.OTA_MANIFEST.get(`manifest:${channel}`);
  if (!data) return c.json({ error: 'Channel not found' }, 404);
  return c.json(JSON.parse(data));
});

otaRoute.put('/admin/manifest/:channel', async (c) => {
  const channel = c.req.param('channel');
  const manifest = await c.req.json();
  await c.env.OTA_MANIFEST.put(`manifest:${channel}`, JSON.stringify(manifest));
  return c.json({ ok: true, manifest });
});

otaRoute.post('/admin/ota/upload', async (c) => {
  try {
    const form = await c.req.formData();
    const file = form.get('file') as File;
    const version = form.get('version')?.toString() || Date.now().toString();
    const channel = form.get('channel')?.toString() || 'stable';
    const checksum = form.get('checksum')?.toString();

    if (!file) return c.json({ error: 'Missing file' }, 400);
    if (!checksum) return c.json({ error: 'Missing checksum' }, 400);
    if (file.size > 25 * 1024 * 1024) {
      return c.json({ error: 'File too large', message: 'KV has a 25MB limit.' }, 400);
    }

    const key = `${channel}-${version}.zip`;
    await c.env.BUNDLES.put(key, await file.arrayBuffer());

    const manifestKey = `manifest:${channel}`;
    const url = new URL(c.req.url);
    const manifest = {
      version,
      key,
      url: `${url.origin}/api/ota/bundle/${key}`,
      updated: new Date().toISOString(),
      checksum,
    };
    await c.env.OTA_MANIFEST.put(manifestKey, JSON.stringify(manifest));

    await c.env.RouteDB.prepare(
      'INSERT INTO history (channel, version, filename, uploaded_at, checksum) VALUES (?, ?, ?, datetime("now"), ?)'
    ).bind(channel, version, key, checksum).run();
    
    return c.json({ ok: true, manifest });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

otaRoute.delete('/admin/ota/updates/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    const { results } = await c.env.RouteDB.prepare('SELECT filename, channel FROM history WHERE id = ?')
      .bind(id)
      .all<{ filename: string; channel: string }>();

    const entry = results[0];
    if (!entry) return c.json({ error: 'History entry not found' }, 404);

    await deleteHistoryAndBundle(c, id, entry.filename, entry.channel);
    return c.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

otaRoute.delete('/admin/bundle', async (c) => {
  try {
    const { key } = await c.req.json();
    if (!key) return c.json({ error: 'Missing key' }, 400);
    await c.env.BUNDLES.delete(key);
    return c.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

otaRoute.post('/admin/ota/bulk-delete', async (c) => {
  try {
    const { ids } = await c.req.json();
    if (!Array.isArray(ids)) return c.json({ error: 'Invalid IDs' }, 400);

    for (const id of ids) {
      const { results } = await c.env.RouteDB.prepare('SELECT filename, channel FROM history WHERE id = ?')
        .bind(id)
        .all<{ filename: string; channel: string }>();

      const entry = results[0];
      if (entry) {
        await deleteHistoryAndBundle(c, id, entry.filename, entry.channel);
      }
    }
    return c.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

otaRoute.post('/admin/apk/bulk-delete', async (c) => {
  try {
    const { ids } = await c.req.json();
    if (!Array.isArray(ids)) return c.json({ error: 'Invalid IDs' }, 400);

    for (const id of ids) {
      const { results } = await c.env.RouteDB.prepare('SELECT filename, channel FROM history WHERE id = ?')
        .bind(id)
        .all<{ filename: string; channel: string }>();
      
      const entry = results[0];
      if (entry && entry.channel === 'apk') {
        await deleteHistoryAndBundle(c, id, entry.filename, entry.channel);
      }
    }
    return c.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

otaRoute.post('/admin/bundles/bulk-delete', async (c) => {
  try {
    const { keys } = await c.req.json();
    if (!Array.isArray(keys)) return c.json({ error: 'Invalid keys' }, 400);

    for (const key of keys) {
      await c.env.BUNDLES.delete(key);
    }
    return c.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

otaRoute.post('/admin/apk/upload', async (c) => {
  try {
    const form = await c.req.formData();
    const file = form.get('file') as File;
    const version = form.get('version')?.toString() || Date.now().toString();
    const channel = 'apk';

    if (!file || !file.name.endsWith('.apk')) return c.json({ error: 'Missing apk file' }, 400);
    if (file.size > 25 * 1024 * 1024) {
      return c.json({ error: 'File too large', message: 'KV has a 25MB limit.' }, 400);
    }

    const key = `apk-${version}.apk`;
    await c.env.BUNDLES.put(key, await file.arrayBuffer());

    const url = new URL(c.req.url);
    const manifest = {
      version,
      key,
      url: `${url.origin}/api/ota/bundle/${key}`,
      updated: new Date().toISOString(),
    };
    await c.env.OTA_MANIFEST.put(`manifest:${channel}`, JSON.stringify(manifest));

    await c.env.RouteDB.prepare(
      'INSERT INTO history (channel, version, filename, uploaded_at) VALUES (?, ?, ?, datetime("now"))'
    ).bind(channel, version, key).run();

    return c.json({ ok: true, uploaded: { version, key } });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

otaRoute.get('/admin/apks', async (c) => {
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

otaRoute.delete('/admin/apk/apks/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    const { results } = await c.env.RouteDB.prepare('SELECT filename, channel FROM history WHERE id = ?')
      .bind(id)
      .all<{ filename: string; channel: string }>();
    
    const entry = results[0];
    if (!entry) return c.json({ error: 'History entry not found' }, 404);
    if (entry.channel !== 'apk') return c.json({ error: 'Not an APK entry' }, 400);

    await deleteHistoryAndBundle(c, id, entry.filename, entry.channel);
    return c.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

otaRoute.post('/check', async (c) => {
  const { version_build, channel = 'stable' } = await c.req.json();

  if (!version_build) {
    return c.json({ error: 'version_build is required in the request body' }, 400);
  }

  const manifestKey = `manifest:${channel}`;
  const manifestData = await c.env.OTA_MANIFEST.get(manifestKey);

  if (!manifestData) {
    return c.json({});
  }

  const manifest = JSON.parse(manifestData);
  const shouldUpdate = manifest.version !== version_build;

  if (shouldUpdate) {
    return c.json({
      version: manifest.version,
      url: manifest.url,
      checksum: manifest.checksum,
    });
  }

  return c.json({});
});

otaRoute.get('/bundle/:key', async (c) => {
  const key = c.req.param('key');
  const file = await c.env.BUNDLES.get(key, { type: 'arrayBuffer' });
  if (!file) return c.text('Bundle not found', 404);

  let contentType = 'application/octet-stream';
  if (key.endsWith('.zip')) contentType = 'application/zip';
  else if (key.endsWith('.apk')) contentType = 'application/vnd.android.package-archive';

  return new Response(file, {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=60' },
  });
});
