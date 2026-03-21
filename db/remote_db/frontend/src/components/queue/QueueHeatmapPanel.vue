<template>
  <section class="rounded-[28px] border border-slate-700/70 bg-slate-950/80 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur">
    <div class="mb-5 flex items-start justify-between gap-4">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Forecast Grid</p>
        <h2 class="text-2xl font-semibold text-white">Day Heatmap</h2>
      </div>
      <button
        class="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-amber-300 hover:text-white"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        {{ loading ? 'Refreshing...' : 'Refresh heatmap' }}
      </button>
    </div>

    <p v-if="error" class="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </p>

    <div v-else-if="heatmap" class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <span class="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200">
          {{ heatmap.route.label }}
        </span>
        <span class="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200">
          {{ heatmap.route.timezone }}
        </span>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="entry in heatmap.heatmap"
          :key="entry.hour"
          class="rounded-2xl border p-4 transition"
          :class="[levelClasses(entry.level), entry.hour === currentHour ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950' : '']"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-[0.18em]">{{ String(entry.hour).padStart(2, '0') }}:00</p>
              <p class="mt-1 text-sm font-semibold capitalize">{{ entry.level.replace('_', ' ') }}</p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold">{{ entry.score }}</p>
              <p class="text-xs">{{ entry.period }}</p>
            </div>
          </div>
          <p class="mt-3 text-xs">Baseline {{ formatDuration(entry.baseline_seconds) }}</p>
        </div>
      </div>
    </div>

    <p v-else class="text-sm text-slate-400">Fetch the route heatmap to inspect all 24 hourly score bands.</p>
  </section>
</template>

<script setup>
import { computed } from 'vue'

import { formatDuration, levelClasses } from '@/lib/queuePrediction'

const props = defineProps({
  error: {
    type: String,
    default: '',
  },
  heatmap: {
    type: Object,
    default: null,
  },
  loading: Boolean,
})

defineEmits(['refresh'])

const currentHour = computed(() => {
  if (!props.heatmap?.route?.timezone) {
    return new Date().getHours()
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: props.heatmap.route.timezone,
  }).formatToParts(new Date())

  const hour = parts.find((part) => part.type === 'hour')?.value
  return hour ? Number(hour) : new Date().getHours()
})
</script>
