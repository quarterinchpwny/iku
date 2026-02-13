addEventListener('checkLocation', async (resolve, reject, args) => {
  try {
    const pos = await CapacitorGeolocation.getCurrentPosition();

    // Notify immediately so user knows it's running
    CapacitorNotifications.schedule([
      {
        id: Math.floor(Date.now() / 1000),
        title: 'IKU_SHIELD.EXE',
        body: `Location logged: ${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}`,
        smallIcon: 'mipmap/ic_launcher',
        ongoing: false,
        autoCancel: true
      }
    ]);

    // Matching the syncToCloudflare logic from db/index.js
    const apiUrl = 'https://iku.quarterinchpwny.online';
    const table = 'passive_locations';
    const changes = [{
      lat: pos.latitude,
      lng: pos.longitude,
      timestamp: Date.now()
    }];

    await fetch(`${apiUrl}/api/location/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, changes })
    });

    resolve();
  } catch (err) {
    CapacitorNotifications.schedule([
      {
        id: 999,
        title: 'IKU_SHIELD.ERR',
        body: `Critical error: ${err.message || err}`,
      }
    ]);
    reject(err);
  }
});
