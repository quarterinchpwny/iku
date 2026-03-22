<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="translate-y-[60px] opacity-0"
    leave-active-class="transition duration-200 ease-in"
    leave-to-class="translate-y-[60px] opacity-0"
  >
    <div
      v-if="show"
      class="fixed inset-0 z-[100] flex items-end justify-center bg-black/85"
      @click.self="$emit('close')"
    >
      <div
        class="flex max-h-[90dvh] w-full max-w-[520px] flex-col gap-4 overflow-y-auto rounded-t-[20px] border-t border-white/10 bg-[#111] px-5 pb-10 pt-5"
      >
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-[13px] font-bold tracking-[0.18em] text-orange-500"
            >ACTIVITY COMPLETE</span
          >
          <span class="text-[11px] text-white/40">{{ summaryDate }}</span>
        </div>

        <div
          ref="summaryMapContainer"
          class="h-[180px] w-full overflow-hidden rounded-[10px] bg-[#1a1a1a]"
        />

        <div class="grid grid-cols-3 gap-px overflow-hidden rounded-[10px] bg-white/10">
          <div class="flex flex-col items-center gap-1 bg-[#111] px-2.5 py-3.5">
            <span class="text-[22px] font-semibold text-white">{{ formattedDistance }}</span>
            <span class="text-center text-[9px] tracking-[0.15em] text-white/35">Distance (km)</span>
          </div>
          <div class="flex flex-col items-center gap-1 bg-[#111] px-2.5 py-3.5">
            <span class="text-[22px] font-semibold text-white">{{ formattedElapsed }}</span>
            <span class="text-center text-[9px] tracking-[0.15em] text-white/35">Duration</span>
          </div>
          <div class="flex flex-col items-center gap-1 bg-[#111] px-2.5 py-3.5">
            <span class="text-[22px] font-semibold text-white">{{ formattedPace }}</span>
            <span class="text-center text-[9px] tracking-[0.15em] text-white/35">Avg Pace</span>
          </div>
          <div class="flex flex-col items-center gap-1 bg-[#111] px-2.5 py-3.5">
            <span class="text-[22px] font-semibold text-white">{{ avgSpeedKmh }}</span>
            <span class="text-center text-[9px] tracking-[0.15em] text-white/35"
              >Avg Speed (km/h)</span
            >
          </div>
          <div class="flex flex-col items-center gap-1 bg-[#111] px-2.5 py-3.5">
            <span class="text-[22px] font-semibold text-white">{{ totalPoints }}</span>
            <span class="text-center text-[9px] tracking-[0.15em] text-white/35">GPS Points</span>
          </div>
          <div class="flex flex-col items-center gap-1 bg-[#111] px-2.5 py-3.5">
            <span class="text-[22px] font-semibold text-white">{{ splits.length }}</span>
            <span class="text-center text-[9px] tracking-[0.15em] text-white/35">Splits (1km)</span>
          </div>
        </div>

        <div v-if="splits.length" class="flex flex-col gap-2">
          <div class="text-[9px] tracking-[0.2em] text-white/35">KM SPLITS</div>
          <div class="flex flex-col gap-1.5">
            <div v-for="(split, index) in splits" :key="index" class="flex items-center gap-2.5">
              <span class="min-w-9 text-[11px] text-white/50">{{ index + 1 }} km</span>
              <div class="h-1 flex-1 overflow-hidden rounded-[2px] bg-white/10">
                <div
                  class="h-full rounded-[2px]"
                  :class="split.paceSeconds < avgPaceSeconds ? 'bg-green-500' : 'bg-orange-500'"
                  :style="{ width: `${splitBarWidth(split.paceSeconds)}%` }"
                />
              </div>
              <span class="min-w-10 text-right text-[11px] text-white/70">{{
                formatPaceSeconds(split.paceSeconds)
              }}</span>
            </div>
          </div>
        </div>

        <div class="mt-1 flex gap-2.5">
          <button
            class="rounded-[10px] border border-white/10 bg-white/5 px-5 py-3.5 text-[13px] text-white/50 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isSaving"
            @click="$emit('discard')"
          >
            Discard
          </button>
          <button
            class="flex-1 rounded-[10px] bg-orange-500 px-3.5 py-3.5 text-[14px] font-semibold tracking-[0.05em] text-white disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isSaving"
            @click="$emit('save')"
          >
            {{ isSaving ? 'Saving...' : 'Save Activity' }}
          </button>
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
