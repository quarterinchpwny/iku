<template>
  <div class="pointer-events-none absolute left-3 right-3 top-3 z-20">
    <div class="flex items-center gap-2 rounded-[10px] border border-white/10 bg-black/65 px-3.5 py-2 backdrop-blur-xl">
      <div
        class="h-[7px] w-[7px] shrink-0 rounded-full"
        :class="signalClass"
      />
      <span class="text-[10px] tracking-[0.12em] text-white/70">
        {{ signalLabel }}
        <span v-if="gpsAccuracy"> · ±{{ Math.round(gpsAccuracy) }}m</span>
      </span>
      <div class="flex-1" />
      <span class="text-[11px] tracking-[0.1em] text-white/50">{{ currentTime }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ gpsAccuracy: number; currentTime: string }>();

const signalClass = computed(() => {
  if (props.gpsAccuracy < 10) return 'bg-emerald-500 shadow-[0_0_6px_#22c55e]';
  if (props.gpsAccuracy < 25) return 'bg-amber-500 shadow-[0_0_6px_#eab308]';
  return 'bg-rose-500 shadow-[0_0_6px_#ef4444]';
});

const signalLabel = computed(() => {
  if (props.gpsAccuracy < 10) return 'GPS LOCKED';
  if (props.gpsAccuracy < 25) return 'GPS GOOD';
  return 'GPS WEAK';
});
</script>
