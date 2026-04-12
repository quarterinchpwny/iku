<script setup lang="ts">
import type { ForecastHour } from './types';

defineProps<{
  hours: ForecastHour[];
}>();
</script>

<template>
  <section class="rounded-[28px] border border-white/10 bg-white/5 p-[1.15rem] text-slate-100">
    <div>
      <div>
        <div class="text-[0.72rem] uppercase tracking-[0.18em] text-slate-200/50">Hourly pulse</div>
        <h3 class="mt-1 text-[1.05rem] font-bold">Chance of rain</h3>
      </div>
    </div>

    <div class="mt-4 grid gap-[1.35rem] text-[0.78rem] text-slate-200/55">
      <span>Rainy</span>
      <span>Mixed</span>
      <span>Dry</span>
    </div>

    <div class="mt-3 grid min-h-[180px] grid-cols-6 items-end gap-3">
      <div v-for="hour in hours" :key="hour.label" class="flex flex-col items-center gap-2.5">
        <div class="relative flex h-[132px] w-full items-end justify-center before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] before:content-['']">
          <div
            class="relative z-[1] w-4 rounded-full bg-[linear-gradient(180deg,rgba(223,242,255,1),rgba(157,216,255,0.65))] shadow-[0_0_0_1px_rgba(219,239,255,0.18),0_10px_26px_rgba(145,206,255,0.22)]"
            :style="{ height: `${Math.max(hour.probability, 8)}%` }"
          ></div>
        </div>
        <span class="text-[0.72rem] text-slate-200/65">{{ hour.label }}</span>
      </div>
    </div>
  </section>
</template>
