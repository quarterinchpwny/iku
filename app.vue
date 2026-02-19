<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
<script setup>
import { useOTAStore } from '~/stores/ota';
import { useGeolocationStore } from '~/stores/geolocation';

const otaStore = useOTAStore();
const geoStore = useGeolocationStore();

onMounted(async () => {
  await geoStore.syncPassiveTrackingState();
  otaStore.checkUpdates();
});
</script>
