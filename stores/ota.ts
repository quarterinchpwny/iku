import { defineStore } from 'pinia';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Device } from '@capacitor/device';

export const useOTAStore = defineStore('ota', () => {
  const updateAvailable = ref(false);
  const latestVersion = ref(null);
  const isUpdating = ref(false);
  const error = ref(null);

  function normalizeVersion(value: unknown): string {
    const normalized = String(value || '').trim();
    return normalized || '0.0.0';
  }

  async function checkUpdates() {
    try {
      // Notify the native side that the app is ready and the update was successful.
      // This must be called after every update or the plugin might rollback.
      await CapacitorUpdater.notifyAppReady();

      const info = await Device.getInfo();
      if (info.platform === 'web') return;

      const config = useRuntimeConfig();
      const apiUrl = config.public.cfURL;
      if (!apiUrl) return;

      const currentState = await CapacitorUpdater.current();
      const bundle = currentState?.bundle;
      const nativeVersion = normalizeVersion(currentState?.native || info.appVersion);
      const bundleVersion = normalizeVersion(bundle?.version || nativeVersion);
      const currentVersion = bundle?.id === 'builtin' ? nativeVersion : bundleVersion;
      alert(`DEBUG: ONALAPS CURRENT VERSION is [${currentVersion || 'NOTHING'}]`);

      const res = await fetch(`${apiUrl}/api/ota/check?t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          channel: 'stable',
          version_build: currentVersion,
        }),
      });

      if (!res.ok) throw new Error(`OTA check failed: ${res.status}`);

      const latest = await res.json();


      if (latest && latest.url) {
        updateAvailable.value = true;
        latestVersion.value = latest;
      } else {
        updateAvailable.value = false;
        latestVersion.value = null;
      }
    } catch (e) {
      error.value = e.message;
      console.error('OTA Check error:', e);
    }
  }

  async function performUpdate() {
    if (!latestVersion.value || !latestVersion.value.url) return;

    try {
      isUpdating.value = true;

      const bundle = await CapacitorUpdater.download({
        url: latestVersion.value.url,
        version: latestVersion.value.version,
        checksum: latestVersion.value.checksum,
      });

      // Apply the update
      await CapacitorUpdater.set(bundle);

      // Note: The app usually reloads automatically after set()
      updateAvailable.value = false;
    } catch (e) {
      error.value = e.message;
      console.error('OTA Update failed:', e);
      alert(`Update failed: ${e.message}`);
    } finally {
      isUpdating.value = false;
    }
  }

  async function resetToNative() {
    try {
      await CapacitorUpdater.reset();
      alert('App reset to native version. Restarting...');
      // The app will usually reload automatically
    } catch (e) {
      console.error('Reset failed:', e);
    }
  }

  return {
    updateAvailable,
    latestVersion,
    isUpdating,
    error,
    checkUpdates,
    performUpdate,
    resetToNative
  };
});
