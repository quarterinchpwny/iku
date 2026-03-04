import { Capacitor } from '@capacitor/core';
import { ActivityRecognition } from '@/src/plugins/activityRecognition';
import { useGeolocationStore } from '~/stores/geolocation';
import type { Pinia } from 'pinia';

const ACTIVITY_ENABLED_KEY = 'qipz_activity_enabled';
const PINIA_WAIT_ATTEMPTS = 20;
const PINIA_WAIT_MS = 250;

export default defineNuxtPlugin((nuxtApp) => {
  if (!Capacitor.isNativePlatform()) return;
  if (!Capacitor.isPluginAvailable('qipz-activity')) return;

  const initActivityRuntime = async () => {
    let pinia = (nuxtApp as any).$pinia as Pinia | undefined;
    if (!pinia) {
      for (let i = 0; i < PINIA_WAIT_ATTEMPTS; i++) {
        await new Promise((resolve) => setTimeout(resolve, PINIA_WAIT_MS));
        pinia = (nuxtApp as any).$pinia as Pinia | undefined;
        if (pinia) break;
      }
    }
    if (!pinia) {
      console.error('[ActivityRuntime] Pinia is not ready after retry; skipping activity runtime init.');
      return;
    }

    const geoStore = useGeolocationStore(pinia);
    let lastResolvedType = 'UNKNOWN';

    const normalizeActivityType = (event: any): string => {
      const rawType = String(event?.type || 'UNKNOWN').toUpperCase();
      if (rawType !== 'UNKNOWN') {
        lastResolvedType = rawType;
        return rawType;
      }

      const debug = String(event?.debugLabel || '').toUpperCase();
      if (debug.includes('RUNNING')) {
        lastResolvedType = 'RUNNING';
        return 'RUNNING';
      }
      if (debug.includes('IN_VEHICLE') || debug.includes('ON_BICYCLE') || debug.includes('DRIVING')) {
        lastResolvedType = 'DRIVING';
        return 'DRIVING';
      }
      if (debug.includes('WALKING') || debug.includes('ON_FOOT')) {
        lastResolvedType = 'WALKING';
        return 'WALKING';
      }
      if (debug.includes('STILL')) {
        lastResolvedType = 'STILL';
        return 'STILL';
      }
      return lastResolvedType || 'UNKNOWN';
    };

    const handleActivityEvent = (event: any) => {
      normalizeActivityType(event);
    };

    try {
      await ActivityRecognition.addListener('activityChange', handleActivityEvent);
    } catch (err) {
      console.error('[ActivityRuntime] addListener failed', err);
    }

    try {
      await ActivityRecognition.addListener('geofenceTransition', async (event: any) => {
        await geoStore.applyNativeGeofenceTransition(event);
      });
    } catch (err) {
      console.error('[ActivityRuntime] geofenceTransition listener failed', err);
    }

    // Drain events captured while JS listener was not attached.
    try {
      const drained = await ActivityRecognition.drainPendingEvents();
      const events = Array.isArray(drained?.events) ? drained.events : [];
      for (const event of events) {
        handleActivityEvent(event);
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
      } else {
        console.warn(
          '[ActivityRuntime] auto-start skipped; missing permissions:',
          perms?.missingPermissions || []
        );
      }
    } catch (err) {
      console.error('[ActivityRuntime] auto-start check failed', err);
    }
  };

  nuxtApp.hook('app:mounted', () => {
    void initActivityRuntime();
  });
});
