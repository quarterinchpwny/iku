<template>
  <main class="min-h-screen bg-[#f3f3f3] px-4 pb-24 pt-4 text-zinc-950 sm:px-6">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section class="overflow-hidden rounded-[36px] border border-black/5 bg-[linear-gradient(135deg,#111827_0%,#1f2937_42%,#f97316_100%)] px-5 py-6 text-white shadow-[0_28px_90px_rgba(15,23,42,0.18)] sm:px-6 sm:py-7">
        <div class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.34em] text-orange-200">Commute</p>
            <h1 class="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Pick a route and see whether it is worth queueing, riding, or walking.</h1>
            <p class="mt-4 max-w-2xl text-sm leading-7 text-orange-50/90">
              The prediction refreshes automatically every minute and compares queue wait, ride time, and walking time from the live route profile.
            </p>
          </div>

          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div class="rounded-[28px] border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100">Selected route</p>
              <p class="mt-2 text-xl font-semibold text-white">{{ selectedRoute?.label || 'No route selected' }}</p>
              <p class="mt-1 text-sm text-orange-50/80">{{ selectedRoute?.timezone || 'Timezone unavailable' }}</p>
            </div>
            <div class="rounded-[28px] border border-white/10 bg-black/20 px-4 py-4">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100">Last refresh</p>
              <p class="mt-2 text-xl font-semibold text-white">{{ formatQueueTimestamp(lastLoadedAt.estimate) }}</p>
              <p class="mt-1 text-sm text-orange-50/80">Public route signals only. No admin controls on this page.</p>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-[32px] border border-black/5 bg-white px-5 py-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:px-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.26em] text-zinc-500">Route picker</p>
            <h2 class="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Choose your corridor</h2>
          </div>
          <button
            class="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-700 transition hover:border-orange-300 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="busy"
            @click="refreshAll"
          >
            {{ busy ? 'Refreshing' : 'Refresh all' }}
          </button>
        </div>

        <p v-if="errors.routes" class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {{ errors.routes }}
        </p>

        <div v-else-if="routes.length" class="mt-5 flex gap-3 overflow-x-auto pb-1">
          <button
            v-for="route in routes"
            :key="route.route_key"
            class="min-w-[240px] flex-shrink-0 rounded-[28px] border px-4 py-4 text-left transition"
            :class="route.route_key === selectedRouteKey ? 'border-orange-300 bg-orange-50 text-zinc-950 shadow-[0_12px_32px_rgba(249,115,22,0.12)]' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-orange-200 hover:bg-white'"
            @click="selectRoute(route.route_key)"
          >
            <div class="flex items-center gap-2">
              <span class="text-base font-semibold">{{ route.label }}</span>
              <span v-if="route.is_default" class="rounded-full border border-orange-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-700">
                Default
              </span>
            </div>
            <p class="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-500">{{ route.timezone }}</p>
            <p class="mt-3 text-sm text-zinc-600">Updated {{ updatedLabel(route.updated_at) }}</p>
          </button>
        </div>

        <div v-else class="mt-5 rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center text-sm text-zinc-500">
          No public commute routes are available yet.
        </div>
      </section>

      <RoutesQueueSignalCard
        :error="errors.estimate"
        :estimate="estimate"
        :loading="loading.estimate"
        @refresh="refreshPredictions"
      />

      <RoutesQueueMapCard
        :estimate="estimate"
        :loading="loading.estimate"
        :route="selectedRoute"
        @refresh="() => refreshPredictions(selectedRouteKey, true)"
      />

      <RoutesQueueHeatmapCard
        :error="errors.heatmap"
        :heatmap="heatmap"
        :loading="loading.heatmap"
        @refresh="refreshPredictions"
      />
    </div>
  </main>
</template>

<script setup lang="ts">
import RoutesQueueHeatmapCard from '~/components/routes/RoutesQueueHeatmapCard.vue';
import RoutesQueueMapCard from '~/components/routes/RoutesQueueMapCard.vue';
import RoutesQueueSignalCard from '~/components/routes/RoutesQueueSignalCard.vue';
import { useQueueCommute } from '~/composables/routes/useQueueCommute';
import { formatQueueTimestamp } from '~/lib/queueCommute';

const {
  busy,
  errors,
  estimate,
  heatmap,
  lastLoadedAt,
  loading,
  refreshAll,
  refreshPredictions,
  routes,
  selectedRoute,
  selectedRouteKey,
  selectRoute,
} = useQueueCommute();

function updatedLabel(value: number): string {
  if (!value) {
    return 'recently';
  }

  return new Date(value).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}
</script>
