import type { Pinia } from 'pinia';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { useOTAStore } from '~/stores/ota';

const PINIA_WAIT_ATTEMPTS = 20;
const PINIA_WAIT_MS = 250;

async function waitForPinia(nuxtApp: { $pinia?: Pinia }) {
  let pinia = nuxtApp.$pinia;
  if (pinia) {
    return pinia;
  }

  for (let attempt = 0; attempt < PINIA_WAIT_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, PINIA_WAIT_MS));
    pinia = nuxtApp.$pinia;
    if (pinia) {
      return pinia;
    }
  }

  return undefined;
}

export default defineNuxtPlugin((nuxtApp) => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  void CapacitorUpdater.notifyAppReady().catch((error) => {
    console.error('[OTA] notifyAppReady failed', error);
  });

  nuxtApp.hook('app:mounted', () => {
    void (async () => {
      const pinia = await waitForPinia(nuxtApp);
      if (!pinia) {
        console.error('[OTA] Pinia was not ready during OTA runtime setup.');
        return;
      }

      const otaStore = useOTAStore(pinia);
      await otaStore.initialize();
      await otaStore.checkUpdates();
      await App.addListener('appStateChange', async ({ isActive }) => {
        if (!isActive) {
          return;
        }
        await otaStore.checkUpdates();
      });
    })();
  });
});
