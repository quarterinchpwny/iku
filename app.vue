<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <OtaUpdatePrompt />
</template>

<script setup>
import { useGeolocationStore } from '~/stores/geolocation';
import { useAuthStore } from '~/stores/auth';
import { ActivityRecognition } from '@/src/plugins/activityRecognition';
import { requestActivityPermission } from '@/permissions';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import OtaUpdatePrompt from '~/components/ota/OtaUpdatePrompt.vue';
const geoStore = useGeolocationStore();
const authStore = useAuthStore();

const FIRST_LAUNCH_KEY = 'qipz_first_launch_done';
const ACTIVITY_ENABLED_KEY = 'qipz_activity_enabled';
const ACTIVITY_LOCATION_NOTIFY_KEY = 'qipz_activity_location_notify_enabled';
const JS_ACTIVITY_STALE_MS = 8 * 60 * 1000;
const JS_ACTIVITY_NO_EVENT_MS = 5 * 60 * 1000;
const JS_ACTIVITY_RECOVER_MIN_MS = 3 * 60 * 1000;
let lastJsRecoverAt = 0;
let appStateListener;

async function applyFirstLaunchDefaults() {
  if (!authStore.isAuthenticated) return;
  if (localStorage.getItem(FIRST_LAUNCH_KEY) === '1') return;
  if (!Capacitor.isNativePlatform()) return;
  if (!Capacitor.isPluginAvailable('qipz-activity')) return;

  try {
    localStorage.setItem(ACTIVITY_LOCATION_NOTIFY_KEY, '1');
    await ActivityRecognition.setActivityNotificationsEnabled({ enabled: true });

    const hasExplicitlyDisabled = localStorage.getItem('qipz_activity_explicitly_disabled') === '1';
    if (!hasExplicitlyDisabled) {
      await requestActivityPermission();
      await ActivityRecognition.start();
      localStorage.setItem(ACTIVITY_ENABLED_KEY, '1');
    }
  } catch (error) {
    console.warn('[ActivityDefaults] first-launch setup failed', error);
  } finally {
    localStorage.setItem(FIRST_LAUNCH_KEY, '1');
  }
}

async function ensureActivityHealth() {
  if (!Capacitor.isNativePlatform()) return;
  if (!Capacitor.isPluginAvailable('qipz-activity')) return;
  const status = await ActivityRecognition.status();
  if (!status?.enabled) return;
  const now = Date.now();
  if (now - lastJsRecoverAt < JS_ACTIVITY_RECOVER_MIN_MS) return;
  const lastEventAt = Number(status.lastEventAt || 0);
  const lastStartAt = Number(status.lastStartAt || 0);
  const staleEvents = lastEventAt > 0 && now - lastEventAt > JS_ACTIVITY_STALE_MS;
  const staleNoEvents =
    lastEventAt <= 0 && lastStartAt > 0 && now - lastStartAt > JS_ACTIVITY_NO_EVENT_MS;
  if (!staleEvents && !staleNoEvents) return;
  lastJsRecoverAt = now;
  await ActivityRecognition.stop();
  await ActivityRecognition.start();
}

onMounted(async () => {
  await authStore.init();
  await geoStore.syncPassiveTrackingState();
  await applyFirstLaunchDefaults();
  await ensureActivityHealth('startup');

  appStateListener = App.addListener('appStateChange', async ({ isActive }) => {
    if (!isActive) return;
    await ensureActivityHealth('resume');
  });
});

onBeforeUnmount(() => {
  if (appStateListener) {
    appStateListener.remove();
    appStateListener = null;
  }
});
</script>
