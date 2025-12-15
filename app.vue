<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
<script setup>
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Device } from '@capacitor/device';

async function checkAndUpdate() {
  try {
    // This is a no-op on web, but good practice to include
    await CapacitorUpdater.notifyAppReady();

    const apiUrl = import.meta.env.VITE_CF_API_URL;
    if (!apiUrl) {
      console.warn('VITE_CF_API_URL is not defined. Skipping OTA update check.');
      return;
    }

    const info = await Device.getInfo();
    const appVersion = info.appVersion;
    console.log('Installed version:', appVersion);

    const res = await fetch(`${apiUrl}/api/ota/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: 'stable',
        version_build: appVersion,
      }),
    });

    if (!res.ok) {
      // Throw an error with more context if the network response is not OK
      throw new Error(`OTA check failed with status: ${res.status}`);
    }

    const latest = await res.json();
    console.log('OTA response:', latest);

    // Ensure there is an update and the URL is present
    if (latest && latest.url) {
      alert(`New version found → updating to: ${latest.version}`);

      const bundle = await CapacitorUpdater.download({
        url: latest.url, // Use the URL directly from the manifest
        version: latest.version,
        checksum: latest.checksum, // Pass checksum to download
      });

      await CapacitorUpdater.set(bundle);
      // reload is optional, you can ask user to restart app
    } else {
      console.log('App is already up to date ✅');
    }
  } catch (e) {
    console.error('OTA Update failed:', e);
  }
}

onMounted(async () => {
  checkAndUpdate();
});
</script>
