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
    await CapacitorUpdater.notifyAppReady();

    const apiUrl = import.meta.env.VITE_CF_API_URL;
    const info = await Device.getInfo();
    const appVersion = info.appVersion;
    console.log('Installed version:', appVersion);

    const res = await fetch(`${apiUrl}/api/ota/check?channel=stable&version=${appVersion}`);
    const latest = await res.json();
    console.log('OTA response:', latest);

    if (latest.update) {
      alert('New version found → updating to:', latest.version);

      const bundle = await CapacitorUpdater.download({
        url: `${apiUrl}/api/ota/bundle/${latest.key}`,
        version: latest.version,
        channel: 'stable'
      });

      await CapacitorUpdater.set(bundle);
      await CapacitorUpdater.reload();
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
