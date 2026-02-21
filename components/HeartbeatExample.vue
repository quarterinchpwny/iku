<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { Heartbeat } from '@/src/plugins/heartbeat';
import { requestHeartbeatPermission } from '@/permissions';

const heartbeatEnabled = ref(false);
let refreshTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  await requestHeartbeatPermission();
  const startStatus = await Heartbeat.start({ intervalMinutes: 60 });
  heartbeatEnabled.value = !!startStatus.enabled;

  refreshTimer = setInterval(async () => {
    const status = await Heartbeat.status();
    heartbeatEnabled.value = !!status.enabled;
  }, 10000);
});

onUnmounted(async () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  const stopStatus = await Heartbeat.stop();
  heartbeatEnabled.value = !!stopStatus.enabled;
});
</script>

<template>
  <div>Heartbeat: {{ heartbeatEnabled ? 'ON' : 'OFF' }}</div>
</template>
