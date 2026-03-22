<template>
  <section class="rounded-[32px] border border-black/5 bg-white px-5 py-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:px-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Forecast grid</p>
        <h2 class="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Best and worst hours</h2>
      </div>
      <button
        class="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-700 transition hover:border-orange-300 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        {{ loading ? 'Refreshing' : 'Refresh' }}
      </button>
    </div>

    <p v-if="error" class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </p>

    <div v-else-if="heatmap" class="mt-5 space-y-4">
      <div class="flex flex-wrap gap-2">
        <span class="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700">
          {{ heatmap.route?.label }}
        </span>
        <span class="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700">
          {{ heatmap.route?.timezone }}
        </span>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="entry in heatmap.heatmap"
          :key="entry.hour"
          class="rounded-2xl border px-4 py-4 transition"
          :class="[levelBadgeClass(entry.level), entry.hour === currentHour ? 'ring-2 ring-orange-300 ring-offset-2 ring-offset-white' : '']"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em]">{{ String(entry.hour).padStart(2, '0') }}:00</p>
              <p class="mt-2 text-lg font-semibold capitalize">{{ entry.level.replace('_', ' ') }}</p>
            </div>
            <div class="text-right">
              <p class="text-xl font-semibold">{{ entry.score }}</p>
              <p class="mt-1 text-[11px] capitalize">{{ entry.period }}</p>
            </div>
          </div>
          <p class="mt-3 text-xs">Baseline {{ formatQueueDuration(entry.baseline_seconds) }}</p>
        </article>
      </div>
    </div>

    <div v-else class="mt-5 rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center text-sm text-zinc-500">
      Load a route to see how queue pressure changes across the day.
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { formatQueueDuration, levelBadgeClass } from '~/lib/queueCommute';

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
});

defineEmits(['refresh']);

const currentHour = computed(() => {
  if (!props.heatmap?.route?.timezone) {
    return new Date().getHours();
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: props.heatmap.route.timezone,
  }).formatToParts(new Date());

  const hour = parts.find((part) => part.type === 'hour')?.value;
  return hour ? Number(hour) : new Date().getHours();
});
</script>
