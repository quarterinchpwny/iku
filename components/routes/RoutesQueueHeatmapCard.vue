<template>
  <section class="border-white/8 rounded-[28px] border bg-[#111418] px-4 py-4 shadow-[0_24px_70px_rgba(0,0,0,0.4)] sm:px-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
          Forecast grid
        </p>
        <h2 class="mt-1.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">Best and worst hours</h2>
      </div>
      <button
        class="rounded-full border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300 transition hover:border-orange-500/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        {{ loading ? 'Refreshing' : 'Refresh' }}
      </button>
    </div>

    <p
      v-if="error"
      class="mt-4 rounded-2xl border border-rose-800 bg-rose-950 px-4 py-3 text-sm text-rose-400"
    >
      {{ error }}
    </p>

    <div v-else-if="heatmap" class="mt-4 space-y-3.5">
      <div class="flex flex-wrap gap-2">
        <span class="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300">
          {{ heatmap.route?.label }}
        </span>
        <span class="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-500">
          {{ heatmap.route?.timezone }}
        </span>
      </div>

      <div class="grid grid-cols-4 gap-2">
        <article
          v-for="entry in heatmap.heatmap"
          :key="entry.hour"
          :style="[cellStyle(entry.level), entry.hour === currentHour ? 'outline: 2px solid rgba(234,146,42,0.6); outline-offset: 2px;' : '']"
          style="border-radius: 14px; padding: 10px; border-width: 0.5px; border-style: solid; transition: opacity 0.15s;"
        >
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
            <p :style="timeStyle(entry.level)" style="font-size: 11px; font-weight: 700;">
              {{ String(entry.hour).padStart(2, '0') }}:00
            </p>
            <p :style="scoreStyle(entry.level)" style="font-size: 16px; font-weight: 800; line-height: 1;">
              {{ entry.score }}
            </p>
          </div>
          <p :style="periodStyle(entry.level)" style="font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 5px;">
            {{ entry.period }}
          </p>
          <p style="font-size: 10px; color: #555;">
            Baseline {{ formatQueueDuration(entry.baseline_seconds) }}
          </p>
        </article>
      </div>
    </div>

    <div
      v-else
      class="mt-4 rounded-[24px] border border-dashed border-zinc-800 bg-zinc-900 px-4 py-6 text-center text-sm text-zinc-600"
    >
      Load a route to see how queue pressure changes across the day.
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatQueueDuration } from '~/lib/queueCommute';

const props = defineProps({
  error: { type: String, default: '' },
  heatmap: { type: Object, default: null },
  loading: Boolean,
});

defineEmits(['refresh']);

const currentHour = computed(() => {
  if (!props.heatmap?.route?.timezone) return new Date().getHours();
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: props.heatmap.route.timezone,
  }).formatToParts(new Date());
  const hour = parts.find((p) => p.type === 'hour')?.value;
  return hour ? Number(hour) : new Date().getHours();
});

function cellStyle(level: string): string {
  const map: Record<string, string> = {
    low:      'background: #0c1a0e; border-color: #1a3020;',
    moderate: 'background: #1f1608; border-color: #3a2a10;',
    high:     'background: #261208; border-color: #4a2210;',
    very_high:'background: #280a04; border-color: #5a1a08;',
  };
  return map[level] ?? 'background: #18181b; border-color: #3f3f46;';
}

function scoreStyle(level: string): string {
  const map: Record<string, string> = {
    low:      'color: #22c55e;',
    moderate: 'color: #E8922A;',
    high:     'color: #f97316;',
    very_high:'color: #f43f5e;',
  };
  return map[level] ?? 'color: #a1a1aa;';
}

function timeStyle(level: string): string {
  const map: Record<string, string> = {
    low:      'color: #166534;',
    moderate: 'color: #9a7a3a;',
    high:     'color: #c2410c;',
    very_high:'color: #9f1239;',
  };
  return map[level] ?? 'color: #71717a;';
}

function periodStyle(level: string): string {
  const map: Record<string, string> = {
    low:      'color: #14532d;',
    moderate: 'color: #92400e;',
    high:     'color: #7c2d12;',
    very_high:'color: #881337;',
  };
  return map[level] ?? 'color: #52525b;';
}
</script>
