<script setup lang="ts">
import type { ForecastDay } from './types';

defineProps<{
  days: ForecastDay[];
}>();
</script>

<template>
  <div class="grid grid-cols-2 gap-3 xl:grid-cols-6">
    <article
      v-for="day in days"
      :key="day.fullLabel"
      class="rounded-[24px] border px-4 py-4 text-slate-100 transition duration-200 hover:-translate-y-0.5 hover:border-sky-200/30"
      :class="
        day.active
          ? 'border-sky-200/60 bg-[linear-gradient(180deg,rgba(215,236,255,0.96),rgba(179,213,255,0.84))] text-slate-950 shadow-[0_14px_30px_rgba(164,208,255,0.18)]'
          : 'border-white/10 bg-white/5'
      "
    >
      <div class="text-sm font-bold">{{ day.dayLabel }}</div>
      <div class="mt-4">
        <Icon :name="day.icon" size="30" />
      </div>
      <div class="mt-4 flex items-baseline gap-2">
        <strong class="text-[1.8rem] leading-none">{{ day.high }}</strong>
        <span class="text-[0.95rem] opacity-65">{{ day.low }}</span>
      </div>
      <div class="mt-2 text-xs opacity-70">{{ day.condition }}</div>
    </article>
  </div>
</template>
