<template>
  <div
    class="pointer-events-none absolute left-0 right-0 top-0 z-20 bg-gradient-to-b from-black/90 via-black/60 to-transparent px-4 pb-5 pt-4"
  >
    <div
      class="flex items-center gap-3 text-[52px] font-bold leading-none tracking-[-0.02em] text-white"
      :class="isPaused ? 'text-white/40' : ''"
    >
      {{ formattedElapsed }}
      <span
        v-if="isPaused"
        class="rounded border border-orange-500/40 bg-orange-500/20 px-2 py-[3px] text-[11px] tracking-[0.15em] text-orange-500"
        >PAUSED</span
      >
    </div>

    <div class="mt-3.5 flex items-center">
      <div class="flex flex-1 flex-col items-center">
        <span class="text-[26px] font-semibold leading-none text-white">{{ formattedDistance }}</span>
        <span class="mt-[3px] text-[9px] tracking-[0.18em] text-white/40">KM</span>
      </div>
      <div class="h-8 w-px bg-white/10" />
      <div class="flex flex-1 flex-col items-center">
        <span class="text-[26px] font-semibold leading-none text-white">{{ formattedPace }}</span>
        <span class="mt-[3px] text-[9px] tracking-[0.18em] text-white/40">MIN/KM</span>
      </div>
      <div class="h-8 w-px bg-white/10" />
      <div class="flex flex-1 flex-col items-center">
        <span class="text-[26px] font-semibold leading-none text-white">{{ kmh }}</span>
        <span class="mt-[3px] text-[9px] tracking-[0.18em] text-white/40">KM/H</span>
      </div>
    </div>

    <div class="mt-3 flex items-center gap-2">
      <div class="h-0.5 flex-1 overflow-hidden rounded-[1px] bg-white/10">
        <div
          class="h-full rounded-[1px] transition-[width] duration-500"
          :class="signalClass"
          :style="{ width: accuracyWidth }"
        />
      </div>
      <span class="min-w-8 text-right text-[9px] tracking-[0.1em] text-white/35"
        >±{{ Math.round(gpsAccuracy || 0) }}m</span
      >
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
  if (props.gpsAccuracy < 10) return 'bg-green-500';
  if (props.gpsAccuracy < 25) return 'bg-yellow-500';
  return 'bg-red-500';
});

const accuracyWidth = computed(() => `${Math.max(5, 100 - Math.min(props.gpsAccuracy, 100))}%`);
</script>
