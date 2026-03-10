<template>
  <Transition name="modal-rise">
    <div v-if="show" class="summary-backdrop" @click.self="$emit('close')">
      <div class="summary-modal">
        <div class="summary-header">
          <span class="summary-title">ACTIVITY COMPLETE</span>
          <span class="summary-date">{{ summaryDate }}</span>
        </div>

        <div ref="summaryMapContainer" class="summary-map-preview" />

        <div class="summary-grid">
          <div class="summary-cell">
            <span class="summary-cell-value">{{ formattedDistance }}</span>
            <span class="summary-cell-label">Distance (km)</span>
          </div>
          <div class="summary-cell">
            <span class="summary-cell-value">{{ formattedElapsed }}</span>
            <span class="summary-cell-label">Duration</span>
          </div>
          <div class="summary-cell">
            <span class="summary-cell-value">{{ formattedPace }}</span>
            <span class="summary-cell-label">Avg Pace</span>
          </div>
          <div class="summary-cell">
            <span class="summary-cell-value">{{ avgSpeedKmh }}</span>
            <span class="summary-cell-label">Avg Speed (km/h)</span>
          </div>
          <div class="summary-cell">
            <span class="summary-cell-value">{{ totalPoints }}</span>
            <span class="summary-cell-label">GPS Points</span>
          </div>
          <div class="summary-cell">
            <span class="summary-cell-value">{{ splits.length }}</span>
            <span class="summary-cell-label">Splits (1km)</span>
          </div>
        </div>

        <div v-if="splits.length" class="splits-section">
          <div class="splits-title">KM SPLITS</div>
          <div class="splits-list">
            <div v-for="(split, index) in splits" :key="index" class="split-row">
              <span class="split-km">{{ index + 1 }} km</span>
              <div class="split-bar-wrap">
                <div class="split-bar" :class="split.paceSeconds < avgPaceSeconds ? 'fast' : 'slow'" :style="{ width: `${splitBarWidth(split.paceSeconds)}%` }" />
              </div>
              <span class="split-pace">{{ formatPaceSeconds(split.paceSeconds) }}</span>
            </div>
          </div>
        </div>

        <div class="summary-actions">
          <button class="btn-discard" :disabled="isSaving" @click="$emit('discard')">Discard</button>
          <button class="btn-save" :disabled="isSaving" @click="$emit('save')">{{ isSaving ? 'Saving...' : 'Save Activity' }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { formatPaceSeconds } from '@/composables/tracker/geo';
import type { Split } from '@/composables/tracker/types';

const props = defineProps<{
  show: boolean;
  summaryDate: string;
  formattedDistance: string;
  formattedElapsed: string;
  formattedPace: string;
  avgSpeedMps: number;
  totalPoints: number;
  avgPaceSeconds: number;
  splits: Split[];
  isSaving: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'discard'): void;
  (e: 'save'): void;
  (e: 'open-map', element: HTMLElement): void;
}>();

const summaryMapContainer = ref<HTMLElement | null>(null);
const avgSpeedKmh = computed(() => Math.round(props.avgSpeedMps * 3.6 * 10) / 10);

function splitBarWidth(paceSeconds: number): number {
  const best = Math.min(...props.splits.map((split) => split.paceSeconds));
  const worst = Math.max(...props.splits.map((split) => split.paceSeconds));
  if (best === worst) return 60;
  return 20 + 80 * (1 - (paceSeconds - best) / (worst - best));
}

watch(
  () => props.show,
  async (open) => {
    if (!open) return;
    await nextTick();
    if (summaryMapContainer.value) emit('open-map', summaryMapContainer.value);
  },
);

onMounted(() => {
  if (props.show && summaryMapContainer.value) emit('open-map', summaryMapContainer.value);
});
</script>

<style scoped>
.summary-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.summary-modal {
  width: 100%;
  max-width: 520px;
  max-height: 90dvh;
  overflow-y: auto;
  background: #111;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px 20px 0 0;
  padding: 20px 20px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.summary-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.summary-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: #f97316;
}
.summary-date {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}
.summary-map-preview {
  width: 100%;
  height: 180px;
  border-radius: 10px;
  overflow: hidden;
  background: #1a1a1a;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  overflow: hidden;
}
.summary-cell {
  background: #111;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.summary-cell-value {
  font-size: 22px;
  font-weight: 600;
  color: #fff;
}
.summary-cell-label {
  font-size: 9px;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.35);
  text-align: center;
}
.splits-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.splits-title {
  font-size: 9px;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.35);
}
.splits-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.split-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.split-km {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  min-width: 36px;
}
.split-bar-wrap {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}
.split-bar {
  height: 100%;
  border-radius: 2px;
}
.split-bar.fast {
  background: #22c55e;
}
.split-bar.slow {
  background: #f97316;
}
.split-pace {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  min-width: 40px;
  text-align: right;
}
.summary-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}
.btn-discard {
  flex: 0 0 auto;
  padding: 14px 20px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}
.btn-save {
  flex: 1;
  padding: 14px;
  border-radius: 10px;
  background: #f97316;
  border: none;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.05em;
  cursor: pointer;
  font-family: inherit;
}
</style>
