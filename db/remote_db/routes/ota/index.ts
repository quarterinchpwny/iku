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

// --- Middleware for Admin routes ---
otaRoute.use('/admin/*', authMiddleware, adminOnlyMiddleware);

// --- Helper Functions ---
async function deleteHistoryAndBundle(c: any, id: number, filename: string, channel: string) {
  // First, delete the database entry
  const { success } = await c.env.RouteDB.prepare('DELETE FROM history WHERE id = ? AND channel = ?')
    .bind(id, channel)
    .run();

  if (!success) {
    throw new Error('Failed to delete history entry from D1');
  }

  // Second, delete the file from KV
  await c.env.BUNDLES.delete(filename);

  // Third, check and update the manifest if the deleted file was the active one
  const manifestKey = `manifest:${channel}`;
  const manifestData = await c.env.OTA_MANIFEST.get(manifestKey);

  if (manifestData) {
    const manifest = JSON.parse(manifestData);
    
    // If the deleted key was the one in the manifest, we need to update the manifest
    if (manifest.key === filename) {
      // Find the next latest entry for this channel from the history
      const { results } = await c.env.RouteDB.prepare(
        'SELECT version, filename FROM history WHERE channel = ? ORDER BY uploaded_at DESC LIMIT 1'
      ).bind(channel).all<{ version: string; filename: string }>();

      if (results.length > 0) {
        const latestEntry = results[0];
        const newManifest = {
          version: latestEntry.version,
          key: latestEntry.filename,
          url: `${c.req.url.replace(/\/bundle\/.*/, '/bundle')}/${latestEntry.filename}`, // Adjust URL if necessary
          updated: new Date().toISOString(),
        };
        await c.env.OTA_MANIFEST.put(manifestKey, JSON.stringify(newManifest));
      } else {
        // No other entries for this channel, so delete the manifest
        await c.env.OTA_MANIFEST.delete(manifestKey);
      }
    }
  }
}

// --- Admin Routes ---

// Endpoint to get all history data for the admin dashboard
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

// Endpoint to list all bundles (KV) - Re-added
otaRoute.get('/admin/bundles', async (c) => {
  const list = await c.env.BUNDLES.list();
  return c.json({ bundles: list.keys });
});

// --- OTA Admin ---

// GET /admin/channels -> Lists all available OTA channels
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

// GET /admin/manifest/:channel -> Gets the manifest for a specific OTA channel
otaRoute.get('/admin/manifest/:channel', async (c) => {
  const channel = c.req.param('channel');
  const data = await c.env.OTA_MANIFEST.get(`manifest:${channel}`);
  if (!data) return c.json({ error: 'Channel not found' }, 404);
  return c.json(JSON.parse(data));
});

// PUT /admin/manifest/:channel -> Updates the manifest for a specific OTA channel
otaRoute.put('/admin/manifest/:channel', async (c) => {
  const channel = c.req.param('channel');
  const manifest = await c.req.json();
  await c.env.OTA_MANIFEST.put(`manifest:${channel}`, JSON.stringify(manifest));
  return c.json({ ok: true, manifest });
});

// POST /admin/ota/upload -> Uploads a new OTA update file (.zip)
otaRoute.post('/admin/ota/upload', async (c) => {
  try {
    const form = await c.req.formData();
    const file = form.get('file') as File;
    const version = form.get('version')?.toString() || Date.now().toString();
    const channel = form.get('channel')?.toString() || 'stable';
    const checksum = form.get('checksum')?.toString(); // Get checksum from form data

    if (!file) return c.json({ error: 'Missing file' }, 400);
    if (!checksum) return c.json({ error: 'Missing checksum' }, 400); // Check for checksum
    if (file.size > 25 * 1024 * 1024) {
      return c.json({ error: 'File too large', message: 'KV has a 25MB limit.' }, 400);
    }

    const key = `${channel}-${version}.zip`;
    await c.env.BUNDLES.put(key, await file.arrayBuffer());

    const manifest = {
      version,
      key,
      url: `${c.req.url.replace(/\/upload$/, '')}/bundle/${key}`,
      updated: new Date().toISOString(),
      checksum, // Store checksum in manifest
    };
    await c.env.OTA_MANIFEST.put(`manifest:${channel}`, JSON.stringify(manifest));

    await c.env.RouteDB.prepare(
      'INSERT INTO history (channel, version, filename, uploaded_at, checksum) VALUES (?, ?, ?, datetime("now"), ?)'
    ).bind(channel, version, key, checksum).run(); // Store checksum in history
    
    return c.json({ ok: true, manifest });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

// DELETE /admin/ota/updates/:id -> Deletes a specific OTA update by ID
otaRoute.delete('/admin/ota/updates/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    // Fetch filename and channel from DB to use in helper
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


// --- APK Admin ---

// POST /admin/apk/upload -> Uploads a new APK file
otaRoute.post('/admin/apk/upload', async (c) => {
  try {
    const form = await c.req.formData();
    const file = form.get('file') as File;
    const version = form.get('version')?.toString() || Date.now().toString();
    const channel = 'apk'; // Hardcode channel to 'apk'

    if (!file || !file.name.endsWith('.apk')) return c.json({ error: 'Missing apk file' }, 400);
    if (file.size > 25 * 1024 * 1024) {
      return c.json({ error: 'File too large', message: 'KV has a 25MB limit.' }, 400);
    }

    const key = `apk-${version}.apk`;
    await c.env.BUNDLES.put(key, await file.arrayBuffer());

    // Create and save the manifest for the APK channel
    const manifest = {
      version,
      key,
      url: `${c.req.url.replace(/\/upload$/, '')}/bundle/${key}`,
      updated: new Date().toISOString(),
    };
    await c.env.OTA_MANIFEST.put(`manifest:${channel}`, JSON.stringify(manifest));

    // Save to history
    await c.env.RouteDB.prepare(
      'INSERT INTO history (channel, version, filename, uploaded_at) VALUES (?, ?, ?, datetime("now"))'
    ).bind(channel, version, key).run();

    return c.json({ ok: true, uploaded: { version, key } });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

// Endpoint to list all APKs - Re-added
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

// DELETE /admin/apk/apks/:id -> Deletes a specific APK by ID
otaRoute.delete('/admin/apk/apks/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    // Fetch filename and channel (which should be 'apk') from DB to use in helper
    const { results } = await c.env.RouteDB.prepare('SELECT filename, channel FROM history WHERE id = ?')
      .bind(id)
      .all<{ filename: string; channel: string }>();
    
    const entry = results[0];
    if (!entry) return c.json({ error: 'History entry not found' }, 404);
    if (entry.channel !== 'apk') return c.json({ error: 'Not an APK entry' }, 400); // Sanity check

    await deleteHistoryAndBundle(c, id, entry.filename, entry.channel);
    return c.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});


// --- Public-Facing Routes ---

// POST /check -> The primary endpoint for the Capgo updater plugin
otaRoute.post('/check', async (c) => {
  const { appVersion, channel = 'stable' } = await c.req.json();

  if (!appVersion) {
    return c.json({ error: 'appVersion is required in the request body' }, 400);
  }

  const manifestKey = `manifest:${channel}`;
  const manifestData = await c.env.OTA_MANIFEST.get(manifestKey);

  if (!manifestData) {
    return c.json({ updateAvailable: false });
  }

  const manifest = JSON.parse(manifestData);
  const shouldUpdate = manifest.version !== appVersion;

  if (shouldUpdate) {
    // Return only the fields expected by Capgo
    return c.json({
      version: manifest.version,
      url: manifest.url,
      checksum: manifest.checksum, // Ensure checksum is included
    });
  }

  return c.json({ updateAvailable: false });
});

// GET /bundle/:key -> Serves the bundle file
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