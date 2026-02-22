import { Capacitor } from '@capacitor/core';
import { ActivityRecognition } from '@/src/plugins/activityRecognition';
import { useGeolocationStore } from '~/stores/geolocation';
import type { Pinia } from 'pinia';

const ACTIVITY_ENABLED_KEY = 'qipz_activity_enabled';

export default defineNuxtPlugin((nuxtApp) => {
  if (!Capacitor.isNativePlatform()) return;
  if (!Capacitor.isPluginAvailable('qipz-activity')) return;

  const initActivityRuntime = async () => {
    const pinia = (nuxtApp as any).$pinia as Pinia | undefined;
    if (!pinia) {
      console.error('[ActivityRuntime] Pinia is not ready; skipping activity runtime init.');
      return;
    }

    const geoStore = useGeolocationStore(pinia);

    const handleActivityEvent = async (event: any) => {
      const type = String(event?.type || 'UNKNOWN');
      const confidence = Number(event?.confidence || 0);
      try {
        await geoStore.logActivityDetectionLocation(type, confidence);
      } catch (err) {
        console.error('[ActivityRuntime] failed handling activity event', err);
      }
    };

    try {
      await ActivityRecognition.addListener('activityChange', handleActivityEvent);
    } catch (err) {
      console.error('[ActivityRuntime] addListener failed', err);
    }

    // Drain events captured while JS listener was not attached.
    try {
      const drained = await ActivityRecognition.drainPendingEvents();
      const events = Array.isArray(drained?.events) ? drained.events : [];
      for (const event of events) {
        await handleActivityEvent(event);
      }
    } catch (err) {
      console.error('[ActivityRuntime] drainPendingEvents failed', err);
    }

    // Respect explicit user setting: auto-start activity engine when enabled.
    try {
      const shouldAutoStart = localStorage.getItem(ACTIVITY_ENABLED_KEY) === '1';
      if (!shouldAutoStart) return;

      const status = await ActivityRecognition.status();
      if (status?.enabled) return;

      const perms = await ActivityRecognition.checkStartPermissions();
      if (perms?.canStart) {
        await ActivityRecognition.start();
      }
    } catch (err) {
      console.error('[ActivityRuntime] auto-start check failed', err);
    }
  };

  nuxtApp.hook('app:mounted', () => {
    void initActivityRuntime();
  });
});
