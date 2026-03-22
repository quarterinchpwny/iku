<template>
  <section class="overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
    <div class="bg-[linear-gradient(135deg,#111827_0%,#1f2937_38%,#f97316_100%)] px-5 py-6 text-white sm:px-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.32em] text-orange-200">Live commute read</p>
          <h2 class="mt-2 text-3xl font-semibold tracking-tight">{{ estimate?.message?.headline || 'Queue signal' }}</h2>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-orange-50/90">{{ estimate?.advice || 'Choose a route to load the latest queue prediction.' }}</p>
        </div>

        <button
          class="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          @click="$emit('refresh')"
        >
          {{ loading ? 'Refreshing' : 'Refresh' }}
        </button>
      </div>

      <div v-if="estimate" class="mt-5 flex flex-wrap gap-2">
        <span class="rounded-full border px-3 py-1.5 text-xs font-semibold capitalize" :class="levelBadgeClass(estimate.level)">
          {{ estimate.level.replace('_', ' ') }}
        </span>
        <span class="rounded-full border px-3 py-1.5 text-xs font-semibold" :class="sourceBadgeClass(estimate.signals?.traffic?.source)">
          {{ sourceLabel(estimate.signals?.traffic?.source) }}
        </span>
        <span class="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
          {{ estimate.signals?.traffic?.label || 'Traffic unavailable' }}
        </span>
      </div>
    </div>

    <div class="space-y-4 px-5 py-5 sm:px-6">
      <p v-if="error" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {{ error }}
      </p>

      <div v-else-if="estimate" class="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div class="rounded-[28px] border border-zinc-200 bg-zinc-950 px-5 py-5 text-white">
          <p class="text-[11px] font-semibold uppercase tracking-[0.26em] text-zinc-400">Why now</p>
          <p class="mt-3 text-base font-semibold text-white">{{ estimate.message?.reason }}</p>
          <p class="mt-3 text-sm leading-6 text-zinc-300">{{ estimate.message?.action }}</p>
          <p class="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
            {{ estimate.message?.confidence_note }}
          </p>
        </div>

        <div class="rounded-[28px] border border-orange-200 bg-[linear-gradient(180deg,#fff7ed_0%,#ffffff_100%)] px-5 py-5 text-zinc-950">
          <p class="text-[11px] font-semibold uppercase tracking-[0.26em] text-orange-600">Best option</p>
          <h3 class="mt-3 text-2xl font-semibold tracking-tight">{{ recommendationTitle(estimate.recommendation?.best_option) }}</h3>
          <p class="mt-3 text-sm leading-6 text-zinc-700">{{ estimate.recommendation?.message || 'Comparison unavailable.' }}</p>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl border border-orange-200 bg-white px-4 py-3">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Ride total</p>
              <p class="mt-1 text-lg font-semibold text-zinc-950">{{ formatQueueMinutes(estimate.recommendation?.ride_total_minutes) }}</p>
            </div>
            <div class="rounded-2xl border border-orange-200 bg-white px-4 py-3">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Walk total</p>
              <p class="mt-1 text-lg font-semibold text-zinc-950">{{ formatQueueMinutes(estimate.recommendation?.walk_total_minutes) }}</p>
            </div>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:col-span-2">
          <div class="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Wait band</p>
            <p class="mt-2 text-xl font-semibold text-zinc-950">{{ formatQueueRange(estimate.wait_minutes_estimate) }}</p>
            <p class="mt-1 text-xs text-zinc-500">Likely {{ formatQueueMinutes(estimate.wait_minutes_estimate?.likely_minutes) }}</p>
          </div>
          <div class="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Travel time</p>
            <p class="mt-2 text-xl font-semibold text-zinc-950">{{ formatQueueDuration(estimate.signals?.traffic?.duration_seconds) }}</p>
            <p class="mt-1 text-xs text-zinc-500">Baseline {{ formatQueueDuration(estimate.signals?.traffic?.baseline_seconds) }}</p>
          </div>
          <div class="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Traffic ratio</p>
            <p class="mt-2 text-xl font-semibold text-zinc-950">{{ estimate.signals?.traffic?.ratio }}x</p>
            <p class="mt-1 text-xs text-zinc-500 capitalize">{{ estimate.signals?.time_of_day?.period }}</p>
          </div>
          <div class="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Updated</p>
            <p class="mt-2 text-base font-semibold text-zinc-950">{{ formatQueueTimestamp(estimate.computed_at) }}</p>
            <p class="mt-1 text-xs text-zinc-500">
              {{ estimate.meta?.degraded ? `Fallback: ${estimate.meta?.degraded_reason}` : 'Healthy signal path' }}
            </p>
          </div>
        </div>
      </div>

      <div v-else class="rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center text-sm text-zinc-500">
        Pick a route to load the live commute signal.
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  formatQueueDuration,
  formatQueueMinutes,
  formatQueueRange,
  formatQueueTimestamp,
  levelBadgeClass,
  recommendationTitle,
  sourceBadgeClass,
  sourceLabel,
} from '~/lib/queueCommute';

defineProps({
  error: {
    type: String,
    default: '',
  },
  estimate: {
    type: Object,
    default: null,
  },
  loading: Boolean,
});

defineEmits(['refresh']);
</script>
