<template>
  <div class="top-bar">
    <div class="top-bar-inner">
      <div class="signal-dot" :class="signalClass" />
      <span class="signal-label">
        {{ signalLabel }}
        <span v-if="gpsAccuracy"> · ±{{ Math.round(gpsAccuracy) }}m</span>
      </span>
      <div class="spacer" />
      <span class="time-label">{{ currentTime }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ gpsAccuracy: number; currentTime: string }>();

const signalClass = computed(() => {
  if (props.gpsAccuracy < 10) return 'excellent';
  if (props.gpsAccuracy < 25) return 'good';
  return 'poor';
});

const signalLabel = computed(() => {
  if (props.gpsAccuracy < 10) return 'GPS LOCKED';
  if (props.gpsAccuracy < 25) return 'GPS GOOD';
  return 'GPS WEAK';
});
</script>

<style scoped>
.top-bar {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 20;
  pointer-events: none;
}
.top-bar-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 8px 14px;
}
.signal-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.signal-dot.excellent {
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e;
}
.signal-dot.good {
  background: #eab308;
  box-shadow: 0 0 6px #eab308;
}
.signal-dot.poor {
  background: #ef4444;
  box-shadow: 0 0 6px #ef4444;
}
.signal-label {
  font-size: 10px;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.7);
}
.spacer {
  flex: 1;
}
.time-label {
  font-size: 11px;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}
</style>
