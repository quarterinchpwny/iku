import { defineStore } from 'pinia';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater, type CurrentBundleResult, type LatestVersion } from '@capgo/capacitor-updater';

function normalizeVersion(value: unknown): string {
  const normalized = String(value || '').trim();
  return normalized || '0.0.0';
}

function resolveCurrentVersion(state: CurrentBundleResult | null): string {
  const nativeVersion = normalizeVersion(state?.native);
  const bundle = state?.bundle;
  if (!bundle || bundle.id === 'builtin') {
    return nativeVersion;
  }
  return normalizeVersion(bundle.version || nativeVersion);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useOTAStore = defineStore('ota', () => {
  const updateAvailable = ref(false);
  const latestVersion = ref<LatestVersion | null>(null);
  const currentVersion = ref<string | null>(null);
  const autoUpdateEnabled = ref<boolean | null>(null);
  const isUpdating = ref(false);
  const isChecking = ref(false);
  const error = ref<string | null>(null);
  let initialized = false;

  async function refreshCurrentVersion() {
    if (!Capacitor.isNativePlatform()) {
      currentVersion.value = null;
      return null;
    }
    const state = await CapacitorUpdater.current();
    currentVersion.value = resolveCurrentVersion(state);
    return state;
  }

  async function initialize() {
    if (!Capacitor.isNativePlatform() || initialized) {
      return;
    }

    initialized = true;

    try {
      autoUpdateEnabled.value = (await CapacitorUpdater.isAutoUpdateEnabled()).enabled;
      await refreshCurrentVersion();

      await CapacitorUpdater.addListener('updateAvailable', () => {
        void checkUpdates();
      });
      await CapacitorUpdater.addListener('noNeedUpdate', () => {
        updateAvailable.value = false;
        latestVersion.value = null;
        error.value = null;
      });
      await CapacitorUpdater.addListener('downloadComplete', () => {
        updateAvailable.value = false;
        latestVersion.value = null;
        error.value = null;
        void refreshCurrentVersion();
      });
      await CapacitorUpdater.addListener('downloadFailed', (event) => {
        error.value = `Download failed${event.version ? `: ${event.version}` : ''}`;
      });
      await CapacitorUpdater.addListener('updateFailed', (event) => {
        error.value = `Update failed${event.bundle?.version ? `: ${event.bundle.version}` : ''}`;
        void refreshCurrentVersion();
      });
    } catch (caughtError) {
      error.value = getErrorMessage(caughtError);
      console.error('OTA init failed:', caughtError);
    }
  }

  async function checkUpdates() {
    if (!Capacitor.isNativePlatform()) {
      updateAvailable.value = false;
      latestVersion.value = null;
      currentVersion.value = null;
      return null;
    }

    isChecking.value = true;
    error.value = null;

    try {
      await refreshCurrentVersion();
      const latest = await CapacitorUpdater.getLatest({ channel: 'stable' });

      if (latest?.error) {
        throw new Error(latest.error);
      }

      const hasUpdate = Boolean(
        latest?.url && normalizeVersion(latest.version) !== normalizeVersion(currentVersion.value)
      );

      updateAvailable.value = hasUpdate;
      latestVersion.value = hasUpdate ? latest : null;
      return latest;
    } catch (caughtError) {
      error.value = getErrorMessage(caughtError);
      console.error('OTA check failed:', caughtError);
      return null;
    } finally {
      isChecking.value = false;
    }
  }

  async function performUpdate() {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    if (!latestVersion.value?.url) {
      await checkUpdates();
    }

    if (!latestVersion.value?.url) {
      return;
    }

    try {
      isUpdating.value = true;
      error.value = null;

      const bundle = await CapacitorUpdater.download({
        url: latestVersion.value.url,
        version: latestVersion.value.version,
        checksum: latestVersion.value.checksum,
        manifest: latestVersion.value.manifest,
        sessionKey: latestVersion.value.sessionKey,
      });

      await CapacitorUpdater.set(bundle);
    } catch (caughtError) {
      error.value = getErrorMessage(caughtError);
      console.error('OTA update failed:', caughtError);
    } finally {
      isUpdating.value = false;
    }
  }

  async function resetToNative() {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      error.value = null;
      updateAvailable.value = false;
      latestVersion.value = null;
      await CapacitorUpdater.reset();
    } catch (caughtError) {
      error.value = getErrorMessage(caughtError);
      console.error('OTA reset failed:', caughtError);
    }
  }

  return {
    updateAvailable,
    latestVersion,
    currentVersion,
    autoUpdateEnabled,
    isUpdating,
    isChecking,
    error,
    initialize,
    checkUpdates,
    performUpdate,
    resetToNative,
  };
});
