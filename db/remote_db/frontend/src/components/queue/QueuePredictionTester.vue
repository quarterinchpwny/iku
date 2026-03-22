<template>
  <main
    class="min-h-screen bg-[radial-gradient(circle_at_top,#78350f_0%,#1c1917_28%,#0f172a_70%,#020617_100%)] px-4 py-8 text-stone-100 sm:px-6 lg:px-8"
  >
    <div class="mx-auto flex max-w-7xl flex-col gap-6">
      <!-- <section
        class="overflow-hidden rounded-[32px] border border-stone-200 bg-[linear-gradient(135deg,#292524_0%,#1c1917_50%,#78350f_100%)] p-6 text-stone-50 shadow-[0_28px_90px_rgba(28,25,23,0.28)] sm:p-8"
      >
        <div class="grid grid-cols-12 gap-6">
          <div class="col-span-12 xl:col-span-7">
            <p class="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-200">Queue Route Manager</p>
            <h1 class="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Tune route endpoints and immediately see what the predictor will do.</h1>
            <p class="mt-4 max-w-2xl text-sm leading-7 text-stone-300">
              Change origin, destination, timezone, and cache behavior for a configured route, save it through the admin API, and inspect the resulting estimate and heatmap from <code class="rounded bg-white/10 px-1.5 py-0.5 text-amber-100">/api/puv-queue</code>.
            </p>
          </div>

          <div
            class="col-span-12 rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur xl:col-span-5"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-amber-100">
              Prediction controls
            </p>
            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p class="text-[11px] uppercase tracking-[0.18em] text-stone-400">API origin</p>
                <p class="mt-1 break-all text-sm font-semibold text-white">{{ apiBase }}</p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p class="text-[11px] uppercase tracking-[0.18em] text-stone-400">Selected route</p>
                <p class="mt-1 text-sm font-semibold text-white">
                  {{ selectedRouteSummary?.label || 'No route selected' }}
                </p>
              </div>
            </div>

            <label
              class="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-100"
            >
              <input
                v-model="includePolyline"
                type="checkbox"
                class="h-4 w-4 rounded border-stone-300"
              />
              Include route polyline in estimate
            </label>

            <div class="mt-4 flex flex-wrap gap-3">
              <button
                class="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-300"
                :disabled="busy"
                @click="refreshAll"
              >
                {{ busy ? 'Refreshing...' : 'Refresh all' }}
              </button>
              <button
                class="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
                :disabled="busy || !selectedRouteKey"
                @click="refreshPredictions"
              >
                Refresh predictions
              </button>
            </div>

            <div class="mt-5 grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p class="text-[11px] uppercase tracking-[0.18em] text-stone-400">
                  Last estimate fetch
                </p>
                <p class="mt-1 text-sm font-semibold text-white">
                  {{ formatTimestamp(lastLoadedAt.estimate) }}
                </p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p class="text-[11px] uppercase tracking-[0.18em] text-stone-400">
                  Last route save
                </p>
                <p class="mt-1 text-sm font-semibold text-white">
                  {{ formatTimestamp(lastLoadedAt.route) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section> -->

      <section class="grid grid-cols-12 gap-6">
        <QueueRoutePanel
          class="col-span-12"
          :loading-route="loading.route"
          :loading-routes="loading.routes"
          :route-detail="routeDetail"
          :route-error="errors.route"
          :routes="routes"
          :routes-error="errors.routes"
          :save-error="errors.save"
          :save-message="messages.save"
          :selected-route-key="selectedRouteKey"
          :saving-route="loading.save"
          @refresh-routes="loadRoutes"
          @save-route="saveRoute"
          @select-route="selectRoute"
        />
      </section>
      <QueueEstimatePanel
        class="col-span-12"
        :error="errors.estimate"
        :estimate="estimate"
        :loading="loading.estimate"
        @refresh="refreshPredictions"
      />
      <QueueEstimateMapPanel
        class="col-span-12"
        :error="errors.estimate"
        :estimate="estimate"
        :loading="loading.estimate"
        :route="routeDetail"
        @refresh="refreshPredictions"
      />
      <section class="grid grid-cols-12 gap-6">
        <QueueHeatmapPanel
          class="col-span-12"
          :error="errors.heatmap"
          :heatmap="heatmap"
          :loading="loading.heatmap"
          @refresh="refreshPredictions"
        />
      </section>
    </div>
  </main>
</template>

<script setup>
import { computed } from 'vue';

import QueueEstimateMapPanel from './QueueEstimateMapPanel.vue';
import QueueEstimatePanel from './QueueEstimatePanel.vue';
import QueueHeatmapPanel from './QueueHeatmapPanel.vue';
import QueueRoutePanel from './QueueRoutePanel.vue';
import { useQueuePredictionTester } from '@/composables/useQueuePredictionTester';
import { formatTimestamp } from '@/lib/queuePrediction';

const {
  apiBase,
  errors,
  estimate,
  heatmap,
  includePolyline,
  lastLoadedAt,
  loading,
  loadRoutes,
  messages,
  refreshAll,
  refreshPredictions,
  routeDetail,
  routes,
  saveRoute,
  selectRoute,
  selectedRouteKey,
  selectedRouteSummary
} = useQueuePredictionTester();

const busy = computed(() => loading.routes || loading.route || loading.estimate || loading.heatmap);
</script>
