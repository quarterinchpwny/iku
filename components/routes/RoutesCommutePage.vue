<template>
  <main class="min-h-screen bg-[#090a0c] px-3 pb-20 pt-3 text-white sm:px-5">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
      <section
        class="border-white/8 overflow-hidden rounded-[30px] border bg-[linear-gradient(135deg,#0e0e10_0%,#1a1208_42%,#E8922A_100%)] px-4 py-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:px-5 sm:py-6"
      >
        <div class="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.34em] text-orange-300">
              Commute
            </p>
            <h1 class="mt-2.5 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Pick a route and see whether it is worth queueing, riding, or walking.
            </h1>
            <p class="mt-3 max-w-2xl text-[13px] leading-6 text-orange-100/80 sm:text-sm">
              The prediction refreshes automatically every minute and compares queue wait, ride
              time, and walking time from the live route profile.
            </p>
          </div>

          <div class="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
            <button
              class="bg-white/8 hover:bg-white/12 rounded-[24px] border border-white/10 px-4 py-3.5 text-left backdrop-blur transition hover:border-orange-500/40"
              @click="routePickerOpen = true"
            >
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300">
                Selected route
              </p>
              <p class="mt-2 text-lg font-semibold text-white sm:text-xl">
                {{ selectedRoute?.label || 'No route selected' }}
              </p>
              <p class="mt-1 text-[13px] text-orange-100/70 sm:text-sm">
                {{ selectedRoute?.timezone || 'Tap to choose a route' }}
              </p>
              <p
                class="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-400/70"
              >
                Tap to change →
              </p>
            </button>

            <div class="border-white/8 rounded-[24px] border bg-black/30 px-4 py-3.5">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300">
                Last refresh
              </p>
              <p class="mt-2 text-lg font-semibold text-white sm:text-xl">
                {{ formatQueueTimestamp(lastLoadedAt.estimate) }}
              </p>
              <p class="mt-1 text-[13px] text-orange-100/60 sm:text-sm">
                Public route signals only. No admin controls on this page.
              </p>
            </div>
          </div>
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

  <div
    v-if="routePickerOpen"
    class="fixed inset-0 z-[2000] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
    @click="routePickerOpen = false"
  >
    <div
      class="w-full max-w-lg overflow-hidden rounded-[28px] border border-zinc-800 bg-[#111418] shadow-[0_40px_120px_rgba(0,0,0,0.7)]"
      @click.stop
    >
      <div class="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.26em] text-zinc-500">
            Route picker
          </p>
          <h2 class="mt-1 text-lg font-semibold text-white">Choose your corridor</h2>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 transition hover:border-orange-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="busy"
            @click="refreshAll"
          >
            {{ busy ? 'Refreshing…' : 'Refresh all' }}
          </button>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-400 transition hover:border-zinc-600 hover:text-white"
            @click="routePickerOpen = false"
          >
            ✕
          </button>
        </div>
      </div>

      <p
        v-if="errors.routes"
        class="mx-5 mt-4 rounded-2xl border border-rose-800 bg-rose-950 px-4 py-3 text-sm text-rose-400"
      >
        {{ errors.routes }}
      </p>

      <div
        v-else-if="routes.length"
        class="max-h-[60vh] divide-y divide-zinc-800/60 overflow-y-auto"
        style="scrollbar-width: thin; scrollbar-color: #334155 transparent"
      >
        <button
          v-for="route in routes"
          :key="route.route_key"
          class="flex w-full items-center justify-between px-5 py-4 text-left transition"
          :class="
            route.route_key === selectedRouteKey
              ? 'bg-[#1c1608] hover:bg-[#221a0a]'
              : 'hover:bg-zinc-900/60'
          "
          @click="handleSelectRoute(route.route_key)"
        >
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="text-base font-semibold"
                :class="route.route_key === selectedRouteKey ? 'text-orange-300' : 'text-white'"
              >
                {{ route.label }}
              </span>
              <span
                v-if="route.is_default"
                class="rounded-full border border-orange-500/40 bg-orange-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-400"
              >
                Default
              </span>
              <span
                v-if="route.route_key === selectedRouteKey"
                class="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400"
              >
                Active
              </span>
            </div>
            <p class="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
              {{ route.timezone }}
            </p>
            <p class="mt-1 text-xs text-zinc-600">Updated {{ updatedLabel(route.updated_at) }}</p>
          </div>

          <div
            class="ml-4 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition"
            :class="
              route.route_key === selectedRouteKey
                ? 'border-orange-500 bg-orange-500'
                : 'border-zinc-700 bg-transparent'
            "
          >
            <span
              v-if="route.route_key === selectedRouteKey"
              class="text-[10px] font-bold leading-none text-white"
              >✓</span
            >
          </div>
        </button>
      </div>

      <div v-else class="px-5 py-10 text-center text-sm text-zinc-600">
        No public commute routes are available yet.
      </div>

      <div class="border-t border-zinc-800 px-5 py-4">
        <button
          class="w-full rounded-[18px] border border-zinc-700 bg-zinc-900 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white"
          @click="routePickerOpen = false"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import RoutesQueueHeatmapCard from '~/components/routes/RoutesQueueHeatmapCard.vue';
import RoutesQueueMapCard from '~/components/routes/RoutesQueueMapCard.vue';
import RoutesQueueSignalCard from '~/components/routes/RoutesQueueSignalCard.vue';
import { useQueueCommute } from '~/composables/routes/useQueueCommute';
import { formatQueueTimestamp } from '~/lib/queueCommute';

const routePickerOpen = ref(false);

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
  selectRoute
} = useQueueCommute();

function updatedLabel(value: number): string {
  if (!value) return 'recently';
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function handleSelectRoute(key: string) {
  selectRoute(key);
  routePickerOpen.value = false;
}
</script>
