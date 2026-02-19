addEventListener('checkLocation', async (resolve, reject, args) => {
  try {
    const makeNotifId = () => Math.floor(Date.now() % 2147483000);
    const notify = async (title, body, idOffset = 0) => {
      try {
        await CapacitorNotifications.schedule([
          {
            id: makeNotifId() + idOffset,
            title,
            body,
            smallIcon: 'mipmap/ic_launcher',
            ongoing: false,
            autoCancel: true
          }
        ]);
      } catch (_err) {
        // Best-effort in background runner; avoid failing the sync flow on notification errors.
      }
    };

    const normalizeCoord = (value) => Number(value).toFixed(6);
    const rightRotate = (value, amount) => (value >>> amount) | (value << (32 - amount));
    const sha256Hex = async (ascii) => {
      const maxWord = 0x100000000;
      const words = [];
      const asciiBitLength = ascii.length * 8;
      let hash = [];
      let k = [];
      let primeCounter = 0;
      const isComposite = {};
      for (let candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
          for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
          hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
          k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
        }
      }

      ascii += '\x80';
      while ((ascii.length % 64) - 56) ascii += '\x00';
      for (let i = 0; i < ascii.length; i++) {
        const j = ascii.charCodeAt(i);
        words[i >> 2] |= j << (((3 - i) % 4) * 8);
      }
      words[words.length] = ((asciiBitLength / maxWord) | 0);
      words[words.length] = (asciiBitLength);

      for (let j = 0; j < words.length;) {
        const w = words.slice(j, (j += 16));
        const oldHash = hash.slice(0);
        hash = hash.slice(0, 8);
        for (let i = 0; i < 64; i++) {
          const i2 = i + j;
          let w15 = w[i - 15];
          let w2 = w[i - 2];
          const a = hash[0];
          const e = hash[4];
          const temp1 = hash[7]
            + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
            + ((e & hash[5]) ^ ((~e) & hash[6]))
            + k[i]
            + (w[i] = (i < 16) ? w[i] : (
              w[i - 16]
              + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
              + w[i - 7]
              + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
            ) | 0);
          const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
            + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
          hash = [(temp1 + temp2) | 0].concat(hash);
          hash[4] = (hash[4] + temp1) | 0;
          hash.pop();
        }
        for (let i = 0; i < 8; i++) {
          hash[i] = (hash[i] + oldHash[i]) | 0;
        }
      }

      let result = '';
      for (let i = 0; i < 8; i++) {
        for (let j = 3; j + 1; j--) {
          const b = (hash[i] >> (j * 8)) & 255;
          result += ((b < 16) ? 0 : '') + b.toString(16);
        }
      }
      return result;
    };

    const pos = await CapacitorGeolocation.getCurrentPosition();
    const lat = pos?.coords?.latitude ?? pos?.latitude ?? null;
    const lng = pos?.coords?.longitude ?? pos?.longitude ?? null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      await notify('IKU_SHIELD.WARN', 'Location unavailable while backgrounded. Will retry.');
      resolve();
      return;
    }

    await notify('IKU_SHIELD.LOG', `Location logged: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 1);

    const apiUrl = 'https://iku.quarterinchpwny.online';
    const table = 'passive_locations';
    const timestamp = Date.now();
    const deviceId = 'runner-bg';
    const sampleHash = await sha256Hex(
      `${deviceId}|${timestamp}|${normalizeCoord(lat)}|${normalizeCoord(lng)}`
    );
    const changes = [{
      lat,
      lng,
      timestamp,
      deviceId,
      sampleHash
    }];

    const response = await fetch(`${apiUrl}/api/location/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, changes })
    });

    let body = null;
    try {
      body = await response.json();
    } catch (_err) {}

    const insertedCount = Number(body?.insertedCount || 0);
    const rejected = Number(body?.rejectedCount || 0);
    const deduped = Number(body?.dedupedCount || 0);
    const code = Number(response?.status || 0);
    const meta = `code:${code} ins:${insertedCount} rej:${rejected} ded:${deduped}`;

    if (response.ok && insertedCount > 0) {
      await notify('IKU_SHIELD.SYNC', `Location synced: ${lat.toFixed(4)}, ${lng.toFixed(4)} | ${meta}`, 2);
    } else {
      await notify('IKU_SHIELD.WARN', `Sync not inserted | ${meta}`, 3);
    }

    resolve();
  } catch (err) {
    try {
      await CapacitorNotifications.schedule([
        {
          id: Math.floor(Date.now() % 2147483000),
          title: 'IKU_SHIELD.ERR',
          body: `Critical error: ${err.message || err}`,
          smallIcon: 'mipmap/ic_launcher',
          ongoing: false,
          autoCancel: true
        }
      ]);
    } catch (_notifyErr) {}
    reject(err);
  }
});
