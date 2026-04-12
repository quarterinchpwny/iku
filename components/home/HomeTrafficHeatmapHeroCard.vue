<template>
  <div
    class="w-full rounded-[1rem] border border-white/10 bg-black/60 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(255,255,255,0.05)]"
  >
    <!-- Header -->
    <div class="mb-3 flex items-baseline justify-between">
      <span class="text-sm font-semibold text-white">Today</span>
      <div class="text-sm font-bold text-white">
        <template v-if="hovered">
          <span class="mr-1.5 text-xs font-normal text-[#555]">
            {{ fmtHour(hovered.hour) }} · {{ cap(hovered.period) }}
          </span>
          <span class="text-[#e85d04]">{{ fmtMins(hovered.baseline_seconds) }}</span>
        </template>
        <template v-else>
          <span class="text-xs font-medium text-[#e85d04]">score</span>
        </template>
      </div>
    </div>

    <!-- Chart -->
    <div class="flex h-[68px] items-end gap-0.5">
      <div
        v-for="item in heatmapData"
        :key="item.hour"
        class="relative flex flex-1 cursor-pointer items-end"
        @mouseenter="hovered = item"
        @mouseleave="hovered = null"
      >
        <!-- Tooltip -->
        <div
          v-if="hovered?.hour === item.hour"
          class="tooltip-arrow absolute bottom-[calc(100%+7px)] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#e85d04] px-2 py-1 text-[11px] font-semibold text-white"
        >
          {{ fmtMins(item.baseline_seconds) }}
        </div>

        <!-- Bar -->
        <div
          class="w-full rounded-t-sm transition-all duration-150"
          :style="{
            height: barHeight(item.score) + 'px',
            background: isDimmed(item) ? dimmed[item.level] : colors[item.level],
            boxShadow: hovered?.hour === item.hour ? `0 0 8px ${colors[item.level]}99` : 'none'
          }"
        />
      </div>
    </div>

    <!-- X-axis labels -->
    <div class="relative mt-1 h-[18px]">
      <span
        v-for="h in labelHours"
        :key="h"
        class="absolute top-0 -translate-x-1/2 text-[11px] text-[#555]"
        :style="{ left: (h / 23) * 100 + '%' }"
        >{{ fmtHour(h) }}</span
      >
    </div>

    <!-- Legend -->
    <div class="mt-3 flex justify-end gap-4 border-t border-[#2a2a2a] pt-3">
      <div v-for="l in legend" :key="l.label" class="flex items-center gap-1.5">
        <span class="inline-block h-2.5 w-2.5 rounded-sm" :style="{ background: l.color }" />
        <span class="text-xs text-[#888]">{{ l.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useHomeCommuteHero } from '~/composables/home/useHomeCommuteHero';

const props = defineProps({
  commute: {
    type: Object,
    default: null
  }
});

const commute = props.commute || useHomeCommuteHero();
const { heatmap } = commute;

const heatmapData = computed(() => heatmap.value?.heatmap);

const colors = { low: '#4a9e6e', moderate: '#e85d04', high: '#ff2200' };
const dimmed = { low: '#1e3d2a', moderate: '#3d1f00', high: '#3d0800' };
const labelHours = [0, 6, 12, 18, 23];
const legend = [
  { label: 'Low', color: colors.low },
  { label: 'Moderate', color: colors.moderate },
  { label: 'High', color: colors.high }
];

const hovered = ref(null);

const isDimmed = (item) => hovered.value !== null && hovered.value.hour !== item.hour;

const barHeight = (score) => {
  const minH = 14,
    maxH = 68;
  return minH + ((score - 1) / 4) * (maxH - minH);
};

const fmtHour = (h) => {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
};

const fmtMins = (s) => {
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
</script>

<style scoped>
.tooltip-arrow::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: #e85d04;
}
</style>
