<template>
  <section class="rounded-[1rem] border border-zinc-800 bg-zinc-950 p-5">
    <div class="mb-5 flex items-start justify-between gap-4">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Route Scope</p>
        <h2 class="text-2xl font-semibold text-white">Prediction Target</h2>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <button
          class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-orange-500/50 hover:text-white"
          :disabled="loadingRoutes"
          @click="$emit('refresh-routes')"
        >
          {{ loadingRoutes ? 'Refreshing...' : 'Refresh routes' }}
        </button>
        <button
          class="rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-xs font-medium text-orange-200 transition hover:border-orange-400 hover:text-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="createMode || savingRoute || !routeDetail"
          @click="$emit('start-create')"
        >
          New route
        </button>
        <button
          class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-orange-500/50 hover:text-white"
          :disabled="!routes.length"
          @click="routePickerOpen = true"
        >
          Choose route
        </button>
      </div>
    </div>

    <div class="mb-4 rounded-[1rem] border border-zinc-800 bg-[#111418] p-4">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
        Active route
      </p>
      <button
        class="mt-3 flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-left transition hover:border-orange-500/50"
        :disabled="!routes.length"
        @click="routePickerOpen = true"
      >
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-white">
            {{ selectedRouteSummary?.label || 'Select a configured route' }}
          </p>
          <p class="mt-1 truncate text-xs text-zinc-500">
            {{ selectedRouteSummary?.route_key || 'No route selected yet' }}
          </p>
        </div>
        <span class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-200">
          Change
        </span>
      </button>
    </div>

    <p v-if="routesError" class="mb-4 rounded-lg border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">
      {{ routesError }}
    </p>

    <div class="mt-5 rounded-[1rem] border border-zinc-800 bg-[#111418] p-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-white">Route detail</h3>
        <span v-if="loadingRoute" class="text-xs text-zinc-500">Loading...</span>
      </div>
      <p v-if="routeError" class="rounded-lg border border-rose-900 bg-rose-950/50 px-3 py-2 text-sm text-rose-300">
        {{ routeError }}
      </p>
      <div v-else-if="routeDetail" class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-zinc-500">Origin</p>
          <p class="mt-1 text-sm font-medium text-white">{{ formatCoordinate(routeDetail.origin) }}</p>
        </div>
        <div class="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-zinc-500">Destination</p>
          <p class="mt-1 text-sm font-medium text-white">{{ formatCoordinate(routeDetail.destination) }}</p>
        </div>
        <div class="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-zinc-500">Timezone</p>
          <p class="mt-1 text-sm font-medium text-white">{{ routeDetail.timezone }}</p>
        </div>
        <div class="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-zinc-500">Cache TTL</p>
          <p class="mt-1 text-sm font-medium text-white">{{ Math.round(routeDetail.cache_ttl_ms / 60000) }} min</p>
        </div>
        <div class="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-zinc-500">Holiday rules</p>
          <p class="mt-1 text-sm font-medium text-white">{{ routeDetail.holidays.length }}</p>
        </div>
        <div class="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-zinc-500">Updated</p>
          <p class="mt-1 text-sm font-medium text-white">{{ formatUpdatedAt(routeDetail.updated_at) }}</p>
        </div>
      </div>
      <p v-else class="text-sm text-zinc-500">Choose a route to inspect its stored profile.</p>
    </div>

    <QueueRouteEditorForm
      editor-mode="edit"
      :route-detail="routeDetail"
      :save-error="saveError"
      :save-message="saveMessage"
      :saving-route="savingRoute"
      @save-route="$emit('save-route', $event)"
    />

    <Teleport to="body">
      <div
        v-if="routePickerOpen"
        class="fixed inset-0 z-[2200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        @click="routePickerOpen = false"
      >
        <div
          class="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[20px] border border-zinc-800 bg-[#111418] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          @click.stop
        >
          <div class="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4 sm:px-6">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Route Picker</p>
              <h3 class="mt-2 text-2xl font-semibold text-white">Choose prediction target</h3>
              <p class="mt-2 text-sm text-zinc-400">
                Pick which stored route the dashboard should inspect and edit.
              </p>
            </div>
            <button
              class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
              @click="routePickerOpen = false"
            >
              Close
            </button>
          </div>

          <div class="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-6">
            <div class="grid gap-3">
              <button
                v-for="route in routes"
                :key="route.route_key"
                class="rounded-2xl border px-4 py-3 text-left transition"
                :class="route.route_key === selectedRouteKey ? 'border-orange-500/50 bg-orange-500/10 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-100 hover:border-zinc-700 hover:bg-[#090a0c]'"
                @click="selectRouteFromModal(route.route_key)"
              >
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <div class="text-sm font-semibold">{{ route.label }}</div>
                    <div class="mt-1 text-[11px]" :class="route.route_key === selectedRouteKey ? 'text-orange-100' : 'text-zinc-500'">
                      {{ route.route_key }}
                    </div>
                  </div>
                  <div class="flex gap-2 text-[10px] font-semibold uppercase tracking-[0.2em]">
                    <span
                      v-if="route.is_default"
                      class="rounded-lg border px-2 py-1"
                      :class="route.route_key === selectedRouteKey ? 'border-orange-400/40 text-orange-100' : 'border-orange-500/40 bg-orange-500/10 text-orange-200'"
                    >
                      Default
                    </span>
                    <span
                      class="rounded-lg border px-2 py-1"
                      :class="route.is_active
                        ? route.route_key === selectedRouteKey ? 'border-orange-400/40 text-orange-100' : 'border-zinc-700 bg-zinc-900 text-zinc-200'
                        : route.route_key === selectedRouteKey ? 'border-orange-400/40 text-orange-100' : 'border-zinc-800 bg-[#090a0c] text-zinc-500'"
                    >
                      {{ route.is_active ? 'Active' : 'Inactive' }}
                    </span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="createMode && createTemplate"
        class="fixed inset-0 z-[2200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        @click="$emit('cancel-create')"
      >
        <div
          class="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[20px] border border-zinc-800 bg-[#111418] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          @click.stop
        >
          <div class="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4 sm:px-6">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">New Route</p>
              <h3 class="mt-2 text-2xl font-semibold text-white">Create route from template</h3>
              <p class="mt-2 text-sm text-zinc-400">
                Baselines, score bands, and holiday rules will be copied from {{ createTemplate.label }}.
              </p>
            </div>
            <button
              class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
              :disabled="savingRoute"
              @click="$emit('cancel-create')"
            >
              Close
            </button>
          </div>

          <div class="px-5 py-5 sm:px-6">
            <QueueRouteEditorForm
              :create-template="createTemplate"
              editor-mode="create"
              :save-error="saveError"
              :save-message="saveMessage"
              :saving-route="savingRoute"
              @create-route="$emit('create-route', $event)"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'

import QueueRouteEditorForm from './QueueRouteEditorForm.vue'
import { formatCoordinate, formatUpdatedAt } from '@/lib/queuePrediction'

const props = defineProps({
  createMode: Boolean,
  createTemplate: { type: Object, default: null },
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

const emit = defineEmits(['cancel-create', 'create-route', 'refresh-routes', 'save-route', 'select-route', 'start-create'])
const routePickerOpen = ref(false)

const selectedRouteSummary = computed(() => (
  props.routes.find((route) => route.route_key === props.selectedRouteKey) ?? null
))

function selectRouteFromModal(routeKey) {
  emit('select-route', routeKey)
  routePickerOpen.value = false
}
</script>
