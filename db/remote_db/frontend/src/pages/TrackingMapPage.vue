<template>
  <main class="relative" style="height: calc(100vh - 64px); overflow: hidden">
    <div :ref="setMapContainer" class="absolute inset-0 h-full w-full bg-slate-900" />

    <div class="absolute right-4 top-4 z-[400] flex flex-wrap items-center gap-2">
      <div
        class="hidden rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-400 backdrop-blur-md md:block"
      >
        Last Sync:
        <span class="ml-1 font-mono text-slate-200">
          {{
            lastSyncedPoint
              ? new Date(Number(lastSyncedPoint.timestamp)).toLocaleString()
              : 'No sync yet'
          }}
        </span>
      </div>
      <button
        @click="showLiveDevices = !showLiveDevices"
        class="rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-md transition-colors hover:bg-slate-800"
      >
        {{ showLiveDevices ? 'Hide Devices' : 'Show Devices' }}
      </button>
      <button
        @click="showPassiveDots = !showPassiveDots"
        class="rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-md transition-colors hover:bg-slate-800"
      >
        {{ showPassiveDots ? 'Hide Passive' : 'Show Passive' }}
      </button>
      <button
        @click="selectedRouteId = null"
        class="rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-md transition-colors hover:bg-slate-800"
      >
        Clear Route
      </button>
      <button
        @click="fitMapToData"
        class="rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-md transition-colors hover:bg-slate-800"
      >
        Fit View
      </button>
      <button
        @click="refreshTrackingNow"
        class="rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-md transition-colors hover:bg-slate-800"
      >
        Refresh
      </button>
    </div>

    <div
      class="absolute bottom-20 left-4 top-4 z-[400] flex w-80 flex-col gap-3 overflow-y-auto"
      style="scrollbar-width: thin; scrollbar-color: #334155 transparent"
    >
      <div class="grid grid-cols-2 gap-2">
        <div class="rounded-xl border border-slate-700/70 bg-slate-900/85 px-3 py-2 backdrop-blur-md">
          <div class="text-[10px] uppercase tracking-wider text-slate-500">Routes</div>
          <div class="text-sm font-semibold text-slate-100">{{ routeSummaries.length }}</div>
        </div>
        <div class="rounded-xl border border-slate-700/70 bg-slate-900/85 px-3 py-2 backdrop-blur-md">
          <div class="text-[10px] uppercase tracking-wider text-slate-500">Samples</div>
          <div class="text-sm font-semibold text-slate-100">{{ trackingPoints.length }}</div>
        </div>
        <div class="rounded-xl border border-slate-700/70 bg-slate-900/85 px-3 py-2 backdrop-blur-md">
          <div class="text-[10px] uppercase tracking-wider text-slate-500">Active</div>
          <div class="text-sm font-semibold text-emerald-400">{{ activeRouteCount }}</div>
        </div>
        <div class="rounded-xl border border-slate-700/70 bg-slate-900/85 px-3 py-2 backdrop-blur-md">
          <div class="text-[10px] uppercase tracking-wider text-slate-500">Passive</div>
          <div class="text-sm font-semibold text-sky-400">{{ passiveRouteCount }}</div>
        </div>
      </div>

      <div
        class="overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900/85 backdrop-blur-md"
      >
        <div class="flex items-center justify-between border-b border-slate-700/50 px-3 py-2.5">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Live Devices · {{ liveDevices.length }}
          </span>
          <div class="flex items-center gap-1.5">
            <select
              v-model.number="liveWindowMinutes"
              class="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300"
            >
              <option :value="60">1h</option>
              <option :value="180">3h</option>
              <option :value="360">6h</option>
              <option :value="720">12h</option>
              <option :value="1440">24h</option>
            </select>
            <button
              @click="mapAutoRefreshEnabled = !mapAutoRefreshEnabled"
              :class="[
                'rounded border px-1.5 py-0.5 text-[10px] transition-colors',
                mapAutoRefreshEnabled
                  ? 'border-emerald-700/60 bg-emerald-900/40 text-emerald-400'
                  : 'border-slate-700 bg-slate-800 text-slate-400'
              ]"
            >
              {{ mapAutoRefreshEnabled ? 'AUTO ON' : 'AUTO OFF' }}
            </button>
          </div>
        </div>
        <div class="max-h-36 overflow-auto">
          <button
            v-for="d in liveDevices"
            :key="d.deviceId"
            @click="focusDevice(d.deviceId)"
            :class="[
              'flex w-full items-center justify-between border-b border-slate-700/30 px-3 py-2 text-left text-xs transition-colors last:border-b-0',
              selectedDeviceId === d.deviceId
                ? 'bg-orange-900/30 text-orange-300'
                : 'text-slate-300 hover:bg-slate-800/70'
            ]"
          >
            <span class="min-w-0">
              <span class="block truncate font-mono text-[11px]">{{ d.deviceLabel }}</span>
              <span class="block truncate text-[10px] text-slate-500">
                {{ Number(d.lat).toFixed(5) }}, {{ Number(d.lng).toFixed(5) }}
              </span>
            </span>
            <span class="ml-2 shrink-0 text-[10px]" :class="d.freshnessClass">{{ d.ageLabel }}</span>
          </button>
          <div
            v-if="liveDevices.length === 0"
            class="px-3 py-3 text-center text-[11px] text-slate-500"
          >
            No live devices in window.
          </div>
        </div>
      </div>

      <div
        class="overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900/85 backdrop-blur-md"
      >
        <div class="border-b border-slate-700/50 px-3 py-2.5">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Day Timeline
          </span>
        </div>
        <div class="max-h-40 overflow-auto">
          <button
            v-for="day in passiveDayTimeline"
            :key="day.dayKey"
            @click="openDayTimelineMap(day)"
            class="w-full border-b border-slate-700/30 px-3 py-2 text-left text-xs transition-colors last:border-b-0 hover:bg-slate-800/70"
          >
            <div class="flex items-center justify-between">
              <span class="font-medium text-slate-200">{{ day.label }}</span>
              <span class="font-mono text-[10px] text-slate-500">{{ day.routeCount }} routes</span>
            </div>
            <div class="mt-0.5 truncate text-[10px] text-slate-500">{{ day.summary }}</div>
          </button>
          <div
            v-if="passiveDayTimeline.length === 0"
            class="px-3 py-3 text-center text-[11px] text-slate-500"
          >
            No passive timeline yet.
          </div>
        </div>
      </div>

      <div
        class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900/85 backdrop-blur-md"
      >
        <div class="flex shrink-0 items-center justify-between border-b border-slate-700/50 px-3 py-2.5">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Routes
          </span>
          <div class="flex items-center gap-1">
            <select
              v-model="routeListMode"
              class="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[10px] text-slate-300"
            >
              <option value="routes">Routes</option>
              <option value="days">Days</option>
            </select>
            <select
              v-model="routeFilter"
              :disabled="routeListMode === 'days'"
              class="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[10px] text-slate-300"
            >
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="PASSIVE">Passive</option>
            </select>
          </div>
        </div>
        <div class="flex-1 overflow-auto">
          <button
            v-for="route in displayedRouteSummaries"
            :key="route.id"
            @click="selectedRouteId = route.id"
            :class="[
              'flex w-full items-center justify-between border-b border-slate-700/30 px-4 py-3 text-left transition-colors last:border-b-0',
              selectedRouteId === route.id
                ? 'bg-orange-900/25 text-orange-300'
                : 'text-slate-300 hover:bg-slate-800/70'
            ]"
          >
            <span class="min-w-0 flex-1 pr-3">
              <span class="block truncate text-sm font-semibold">{{ routeDisplayLabel(route) }}</span>
              <span class="mt-0.5 block truncate font-mono text-[11px] text-slate-500">
                {{ formatRouteWindowLabel(route) }}
              </span>
              <span
                :class="route.classification === 'ACTIVE' ? 'text-emerald-400' : 'text-sky-400'"
                class="mt-0.5 block text-[11px] font-semibold"
              >
                {{ route.classification }}
              </span>
              <span class="mt-0.5 block truncate text-xs text-slate-400">
                {{ route.story || 'No route story' }}
              </span>
              <span class="mt-0.5 block font-mono text-[11px] text-slate-500">
                {{ Math.round(route.routeDistanceMeters || 0) }}m · {{ route.durationLabel || '-' }}
              </span>
            </span>
            <span class="shrink-0 text-right">
              <span class="block text-sm font-semibold text-slate-300">{{ route.pointCount }}</span>
              <span class="block text-[11px] text-slate-500">pts</span>
              <Loader2
                v-if="selectedRoutePointsLoading && selectedRouteId === route.id"
                class="ml-auto mt-1 h-3.5 w-3.5 animate-spin text-slate-400"
              />
            </span>
          </button>
          <div
            v-if="displayedRouteSummaries.length === 0"
            class="px-3 py-4 text-center text-[11px] text-slate-500"
          >
            No routes available
          </div>
        </div>
      </div>
    </div>

    <div class="absolute bottom-4 left-[336px] right-4 z-[400] flex gap-3">
      <div
        v-if="selectedRouteId"
        class="flex-1 rounded-xl border border-slate-700/70 bg-slate-900/90 px-4 py-3 backdrop-blur-md"
      >
        <div class="mb-2 flex items-center gap-3">
          <span class="text-sm font-semibold text-slate-100">
            {{
              routeDisplayLabel(
                displayedRouteSummaries.find((r) => Number(r.id) === Number(selectedRouteId)) ||
                  routeSummaries.find((r) => Number(r.id) === Number(selectedRouteId)) || {
                    id: selectedRouteId
                  }
              )
            }}
          </span>
          <span
            :class="
              routeSummaries.find((r) => Number(r.id) === Number(selectedRouteId))?.classification ===
              'ACTIVE'
                ? 'border-emerald-700/60 bg-emerald-900/40 text-emerald-400'
                : 'border-sky-700/60 bg-sky-900/40 text-sky-400'
            "
            class="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
          >
            {{
              routeSummaries.find((r) => Number(r.id) === Number(selectedRouteId))?.classification ||
              'ROUTE'
            }}
          </span>
          <Loader2
            v-if="selectedRoutePointsLoading"
            class="h-3.5 w-3.5 animate-spin text-slate-400"
          />
        </div>
        <div class="flex flex-wrap gap-5 text-[11px]">
          <div>
            <div class="text-slate-500">Points</div>
            <div class="font-semibold text-slate-200">{{ selectedRoutePoints.length }}</div>
          </div>
          <div>
            <div class="text-slate-500">Duration</div>
            <div class="font-semibold text-slate-200">
              {{
                routeSummaries.find((r) => Number(r.id) === Number(selectedRouteId))?.durationLabel ||
                '-'
              }}
            </div>
          </div>
          <div>
            <div class="text-slate-500">Distance</div>
            <div class="font-semibold text-slate-200">
              {{
                Math.round(
                  routeSummaries.find((r) => Number(r.id) === Number(selectedRouteId))
                    ?.routeDistanceMeters || 0
                )
              }}m
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-slate-500">Story</div>
            <div class="truncate font-medium text-slate-300">
              {{ routeSummaries.find((r) => Number(r.id) === Number(selectedRouteId))?.story || '-' }}
            </div>
          </div>
          <div class="hidden md:block">
            <div class="text-slate-500">Window</div>
            <div class="font-mono text-[10px] text-slate-300">
              {{
                formatRouteWindowLabel(
                  routeSummaries.find((r) => Number(r.id) === Number(selectedRouteId)) || {}
                )
              }}
            </div>
          </div>
        </div>
      </div>
      <div
        class="rounded-xl border border-slate-700/70 bg-slate-900/90 px-4 py-3 backdrop-blur-md"
        :class="selectedRouteId ? 'w-60 shrink-0' : 'flex-1'"
      >
        <div class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Stay Insight
        </div>
        <div v-if="currentStaySummary" class="text-xs text-slate-300">
          <span class="font-mono text-[10px]">
            {{ Number(currentStaySummary.lat).toFixed(5) }},
            {{ Number(currentStaySummary.lng).toFixed(5) }}
          </span>
          ·
          <span class="font-semibold text-slate-100">{{ currentStaySummary.durationLabel }}</span>
          <span class="mt-0.5 block text-[10px] text-slate-500">
            {{ currentStaySummary.startedAtLabel }} – {{ currentStaySummary.endedAtLabel }}
          </span>
        </div>
        <div v-else class="text-[11px] text-slate-500">No long stay session yet.</div>
      </div>
      <div
        class="hidden shrink-0 items-center rounded-xl border border-slate-700/70 bg-slate-900/90 px-4 py-3 backdrop-blur-md lg:flex"
      >
        <div>
          <div class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Last Location
          </div>
          <div class="font-mono text-[11px] text-slate-300">{{ latestLocationLabel }}</div>
          <div class="mt-0.5 text-[10px] text-slate-500">
            Auto {{ mapAutoRefreshEnabled ? `${mapAutoRefreshMs / 1000}s` : 'OFF' }}
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
import { Loader2 } from 'lucide-vue-next'
import { useAdminAppContext } from '../composables/useAdminAppContext'

const app = useAdminAppContext()
const {
  activeRouteCount,
  currentStaySummary,
  displayedRouteSummaries,
  fitMapToData,
  focusDevice,
  formatRouteWindowLabel,
  lastSyncedPoint,
  latestLocationLabel,
  liveDevices,
  liveWindowMinutes,
  mapAutoRefreshEnabled,
  mapAutoRefreshMs,
  openDayTimelineMap,
  passiveDayTimeline,
  passiveRouteCount,
  refreshTrackingNow,
  routeDisplayLabel,
  routeFilter,
  routeListMode,
  routeSummaries,
  selectedDeviceId,
  selectedRouteId,
  selectedRoutePoints,
  selectedRoutePointsLoading,
  setMapContainer,
  showLiveDevices,
  showPassiveDots,
  trackingPoints
} = app.map
</script>
