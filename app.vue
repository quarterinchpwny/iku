<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup>
import { useOTAStore } from '~/stores/ota';
import { useGeolocationStore } from '~/stores/geolocation';
import { useAuthStore } from '~/stores/auth';
import { ActivityRecognition } from '@/src/plugins/activityRecognition';
import { requestActivityPermission } from '@/permissions';
import { Capacitor } from '@capacitor/core';

const otaStore = useOTAStore();
const geoStore = useGeolocationStore();
const authStore = useAuthStore();

const FIRST_LAUNCH_KEY = 'qipz_first_launch_done';
const ACTIVITY_ENABLED_KEY = 'qipz_activity_enabled';
const ACTIVITY_LOCATION_NOTIFY_KEY = 'qipz_activity_location_notify_enabled';

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
  } catch {
    // silent — user can enable manually from settings
  } finally {
    localStorage.setItem(FIRST_LAUNCH_KEY, '1');
  }
}

onMounted(async () => {
  await authStore.init();
  await geoStore.syncPassiveTrackingState();
  otaStore.checkUpdates();
  await applyFirstLaunchDefaults();
});
</script>
