<template>
  <section class="rounded-[28px] border border-slate-700/70 bg-slate-950/80 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur">
    <div class="mb-5 flex items-start justify-between gap-4">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Route Scope</p>
        <h2 class="text-2xl font-semibold text-white">Prediction Target</h2>
      </div>
      <button
        class="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-amber-300 hover:text-white"
        :disabled="loadingRoutes"
        @click="$emit('refresh-routes')"
      >
        {{ loadingRoutes ? 'Refreshing...' : 'Refresh routes' }}
      </button>
    </div>

    <label class="mb-3 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
      Active route
    </label>
    <select
      class="mb-4 block w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none ring-0 transition focus:border-amber-300"
      :value="selectedRouteKey"
      @change="$emit('select-route', $event.target.value)"
    >
      <option value="" disabled>Select a configured route</option>
      <option v-for="route in routes" :key="route.route_key" :value="route.route_key">
        {{ route.label }}
      </option>
    </select>

    <p v-if="routesError" class="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ routesError }}
    </p>

    <div class="grid gap-3">
      <button
        v-for="route in routes"
        :key="route.route_key"
        class="rounded-2xl border px-4 py-3 text-left transition"
        :class="route.route_key === selectedRouteKey ? 'border-amber-300 bg-stone-900 text-white' : 'border-slate-700 bg-slate-900/70 text-stone-100 hover:border-slate-500 hover:bg-slate-900'"
        @click="$emit('select-route', route.route_key)"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm font-semibold">{{ route.label }}</div>
            <div class="mt-1 text-[11px]" :class="route.route_key === selectedRouteKey ? 'text-stone-300' : 'text-slate-400'">
              {{ route.route_key }}
            </div>
          </div>
          <div class="flex gap-2 text-[10px] font-semibold uppercase tracking-[0.2em]">
            <span
              v-if="route.is_default"
              class="rounded-full border px-2 py-1"
              :class="route.route_key === selectedRouteKey ? 'border-stone-500 text-stone-100' : 'border-amber-400/40 bg-amber-500/10 text-amber-200'"
            >
              Default
            </span>
            <span
              class="rounded-full border px-2 py-1"
              :class="route.is_active
                ? route.route_key === selectedRouteKey ? 'border-stone-500 text-stone-100' : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                : route.route_key === selectedRouteKey ? 'border-stone-500 text-stone-100' : 'border-slate-600 bg-slate-800 text-slate-300'"
            >
              {{ route.is_active ? 'Active' : 'Inactive' }}
            </span>
          </div>
        </div>
      </button>
    </div>

    <div class="mt-5 rounded-[24px] border border-slate-700 bg-slate-900/70 p-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-white">Route detail</h3>
        <span v-if="loadingRoute" class="text-xs text-slate-400">Loading...</span>
      </div>
      <p v-if="routeError" class="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {{ routeError }}
      </p>
      <div v-else-if="routeDetail" class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Origin</p>
          <p class="mt-1 text-sm font-medium text-white">{{ formatCoordinate(routeDetail.origin) }}</p>
        </div>
        <div class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Destination</p>
          <p class="mt-1 text-sm font-medium text-white">{{ formatCoordinate(routeDetail.destination) }}</p>
        </div>
        <div class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Timezone</p>
          <p class="mt-1 text-sm font-medium text-white">{{ routeDetail.timezone }}</p>
        </div>
        <div class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Cache TTL</p>
          <p class="mt-1 text-sm font-medium text-white">{{ Math.round(routeDetail.cache_ttl_ms / 60000) }} min</p>
        </div>
        <div class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Holiday rules</p>
          <p class="mt-1 text-sm font-medium text-white">{{ routeDetail.holidays.length }}</p>
        </div>
        <div class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Updated</p>
          <p class="mt-1 text-sm font-medium text-white">{{ formatUpdatedAt(routeDetail.updated_at) }}</p>
        </div>
      </div>
      <p v-else class="text-sm text-slate-400">Choose a route to inspect its stored profile.</p>
    </div>

    <QueueRouteEditorForm
      :route-detail="routeDetail"
      :save-error="saveError"
      :save-message="saveMessage"
      :saving-route="savingRoute"
      @save-route="$emit('save-route', $event)"
    />
  </section>
</template>

<script setup>
import QueueRouteEditorForm from './QueueRouteEditorForm.vue'
import { formatCoordinate, formatUpdatedAt } from '@/lib/queuePrediction'

defineProps({
  loadingRoute: Boolean,
  loadingRoutes: Boolean,
  routeDetail: { type: Object, default: null },
  routeError: { type: String, default: '' },
  routes: { type: Array, default: () => [] },
  routesError: { type: String, default: '' },
  selectedRouteKey: { type: String, default: '' },
  saveError: { type: String, default: '' },
  saveMessage: { type: String, default: '' },
  savingRoute: Boolean,
})

defineEmits(['refresh-routes', 'save-route', 'select-route'])
</script>
