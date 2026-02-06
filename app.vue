<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
<script setup>
import { useOTAStore } from '~/stores/ota';

const otaStore = useOTAStore();

onMounted(async () => {
  otaStore.checkUpdates();
});
</script>
