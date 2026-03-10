<template>
  <div class="tracking-hud">
    <div class="hud-time" :class="{ paused: isPaused }">
      {{ formattedElapsed }}
      <span v-if="isPaused" class="pause-badge">PAUSED</span>
    </div>

    <div class="hud-stats">
      <div class="hud-stat">
        <span class="hud-stat-value">{{ formattedDistance }}</span>
        <span class="hud-stat-label">KM</span>
      </div>
      <div class="hud-stat-divider" />
      <div class="hud-stat">
        <span class="hud-stat-value">{{ formattedPace }}</span>
        <span class="hud-stat-label">MIN/KM</span>
      </div>
      <div class="hud-stat-divider" />
      <div class="hud-stat">
        <span class="hud-stat-value">{{ kmh }}</span>
        <span class="hud-stat-label">KM/H</span>
      </div>
    </div>

    <div class="hud-accuracy">
      <div class="accuracy-bar">
        <div class="accuracy-fill" :class="signalClass" :style="{ width: accuracyWidth }" />
      </div>
      <span class="accuracy-text">±{{ Math.round(gpsAccuracy || 0) }}m</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  isPaused: boolean;
  formattedElapsed: string;
  formattedDistance: string;
  formattedPace: string;
  currentSpeed: number;
  gpsAccuracy: number;
}>();

const kmh = computed(() => Math.round(props.currentSpeed * 3.6 * 10) / 10);

const signalClass = computed(() => {
  if (props.gpsAccuracy < 10) return 'excellent';
  if (props.gpsAccuracy < 25) return 'good';
  return 'poor';
});

const accuracyWidth = computed(() => `${Math.max(5, 100 - Math.min(props.gpsAccuracy, 100))}%`);
</script>

<style scoped>
.tracking-hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  padding: 16px 16px 20px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.88) 0%, rgba(0, 0, 0, 0.6) 70%, transparent 100%);
  pointer-events: none;
}
.hud-time {
  font-size: 52px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #fff;
  line-height: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}
.hud-time.paused {
  color: rgba(255, 255, 255, 0.4);
}
.pause-badge {
  font-size: 11px;
  letter-spacing: 0.15em;
  background: rgba(249, 115, 22, 0.2);
  border: 1px solid rgba(249, 115, 22, 0.4);
  color: #f97316;
  padding: 3px 8px;
  border-radius: 4px;
}
.hud-stats {
  display: flex;
  align-items: center;
  margin-top: 14px;
}
.hud-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}
.hud-stat-value {
  font-size: 26px;
  font-weight: 600;
  color: #fff;
  line-height: 1;
}
.hud-stat-label {
  font-size: 9px;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 3px;
}
.hud-stat-divider {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.12);
}
.hud-accuracy {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}
.accuracy-bar {
  flex: 1;
  height: 2px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 1px;
  overflow: hidden;
}
.accuracy-fill {
  height: 100%;
  border-radius: 1px;
  transition: width 0.5s ease;
}
.accuracy-fill.excellent {
  background: #22c55e;
}
.accuracy-fill.good {
  background: #eab308;
}
.accuracy-fill.poor {
  background: #ef4444;
}
.accuracy-text {
  font-size: 9px;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.35);
  min-width: 32px;
  text-align: right;
}
</style>
