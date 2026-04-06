<template>
  <section class="rounded-[1rem] border border-zinc-800 bg-zinc-950 p-5">
    <div class="mb-5 flex items-start justify-between gap-4">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Route Map</p>
        <h2 class="text-2xl font-semibold text-white">Commute vs walk path</h2>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <slot name="actions" />
        <button
          class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-orange-500/50 hover:text-white"
          :disabled="loading"
          @click="$emit('refresh')"
        >
          {{ loading ? 'Refreshing...' : 'Refresh map' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="mb-4 rounded-lg border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">
      {{ error }}
    </p>

    <div class="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div class="overflow-hidden rounded-[1rem] border border-zinc-800 bg-zinc-900">
        <div ref="mapElement" class="h-[420px] w-full" />
      </div>

      <div class="grid gap-3">
        <div v-if="route" class="rounded-[1rem] border border-zinc-800 bg-[#111418] px-4 py-4">
          <p class="text-xs uppercase tracking-[0.18em] text-zinc-500">Best option</p>
          <p class="mt-2 text-lg font-semibold text-white">{{ recommendationTitle }}</p>
          <p class="mt-2 text-sm leading-6 text-zinc-300">{{ recommendationMessage }}</p>
        </div>

        <div v-if="route" class="rounded-[1rem] border border-orange-500/30 bg-orange-500/10 px-4 py-4">
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs uppercase tracking-[0.18em] text-orange-200">Commute path</p>
            <span class="rounded-lg border border-orange-400/40 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-orange-100">
              {{ commutePointCount }} points
            </span>
          </div>
          <p class="mt-2 text-sm font-medium text-white">{{ commuteStatus }}</p>
          <p class="mt-2 text-sm text-orange-100">Ride total: {{ formatMinutes(estimate?.recommendation?.ride_total_minutes) }}</p>
        </div>

        <div v-if="route" class="rounded-[1rem] border border-zinc-800 bg-[#111418] px-4 py-4">
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs uppercase tracking-[0.18em] text-zinc-300">Walking path</p>
            <span class="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-200">
              {{ walkingPointCount }} points
            </span>
          </div>
          <p class="mt-2 text-sm font-medium text-white">{{ walkingStatus }}</p>
          <p class="mt-2 text-sm text-zinc-300">Walk total: {{ formatMinutes(estimate?.recommendation?.walk_total_minutes) }}</p>
        </div>

        <div v-if="route" class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-[1rem] border border-zinc-800 bg-[#111418] px-4 py-4">
            <p class="text-xs uppercase tracking-[0.18em] text-zinc-500">Origin</p>
            <p class="mt-2 text-sm font-medium text-white">{{ formatCoordinate(route.origin) }}</p>
          </div>
          <div class="rounded-[1rem] border border-zinc-800 bg-[#111418] px-4 py-4">
            <p class="text-xs uppercase tracking-[0.18em] text-zinc-500">Destination</p>
            <p class="mt-2 text-sm font-medium text-white">{{ formatCoordinate(route.destination) }}</p>
          </div>
        </div>

        <div
          v-if="!route"
          class="rounded-[1rem] border border-zinc-800 bg-[#111418] px-4 py-4 text-sm text-zinc-500"
        >
          Select a route and fetch an estimate to inspect the walking and commute geometry.
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import 'leaflet/dist/leaflet.css'

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { formatCoordinate } from '@/lib/queuePrediction'

const props = defineProps({
  error: {
    type: String,
    default: '',
  },
  estimate: {
    type: Object,
    default: null,
  },
  loading: Boolean,
  route: {
    type: Object,
    default: null,
  },
})

defineEmits(['refresh'])

const mapElement = ref(null)
const mapState = ref(null)
let pendingResizeFrame = 0

const route = computed(() => props.route ?? props.estimate?.route ?? null)
const commutePath = computed(() => normalizePolyline(props.estimate?.polyline))
const walkingPath = computed(() => normalizePolyline(props.estimate?.walking_polyline))
const commutePointCount = computed(() => commutePath.value.length)
const walkingPointCount = computed(() => walkingPath.value.length)
const recommendationTitle = computed(() => {
  const option = props.estimate?.recommendation?.best_option
  if (option === 'walk') return 'Walk instead'
  if (option === 'ride') return 'Ride the route'
  if (option === 'either') return 'Either option works'
  return 'Comparison unavailable'
})
const recommendationMessage = computed(
  () => props.estimate?.recommendation?.message ?? 'Fetch an estimate with route geometry to compare both travel modes.'
)
const commuteStatus = computed(() => {
  if (commutePath.value.length > 1) return 'Driving geometry loaded from the routing service.'
  return 'Driving geometry unavailable, showing endpoints only.'
})
const walkingStatus = computed(() => {
  if (walkingPath.value.length > 1) return 'Walking geometry loaded from the routing service.'
  return 'Walking geometry unavailable, showing endpoints only.'
})

async function ensureMap() {
  if (mapState.value || !mapElement.value) return

  const leaflet = await import('leaflet')
  const map = leaflet.map(mapElement.value, {
    zoomControl: true,
    attributionControl: false,
  })
  leaflet.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(map)
  mapState.value = {
    commuteLayer: null,
    endpointLayer: leaflet.layerGroup().addTo(map),
    leaflet,
    map,
    walkingLayer: null,
  }
}

function clearLayers() {
  if (!mapState.value) return

  mapState.value.endpointLayer.clearLayers()
  if (mapState.value.commuteLayer) {
    mapState.value.map.removeLayer(mapState.value.commuteLayer)
    mapState.value.commuteLayer = null
  }
  if (mapState.value.walkingLayer) {
    mapState.value.map.removeLayer(mapState.value.walkingLayer)
    mapState.value.walkingLayer = null
  }
}

function syncMap() {
  if (!mapState.value) return

  clearLayers()

  const bounds = []
  const start = normalizeCoordinate(route.value?.origin)
  const end = normalizeCoordinate(route.value?.destination)

  if (start) {
    mapState.value.leaflet.circleMarker(start, {
      color: '#f59e0b',
      fillColor: '#fbbf24',
      fillOpacity: 0.9,
      radius: 6,
      weight: 2,
    }).addTo(mapState.value.endpointLayer)
    bounds.push(start)
  }

    if (end) {
    mapState.value.leaflet.circleMarker(end, {
      color: '#d4d4d8',
      fillColor: '#a1a1aa',
      fillOpacity: 0.95,
      radius: 6,
      weight: 2,
    }).addTo(mapState.value.endpointLayer)
    bounds.push(end)
  }

  if (commutePath.value.length > 1) {
    mapState.value.commuteLayer = mapState.value.leaflet.polyline(commutePath.value, {
      color: '#f59e0b',
      opacity: 0.95,
      weight: 5,
    }).addTo(mapState.value.map)
    bounds.push(...commutePath.value)
  }

  if (walkingPath.value.length > 1) {
    mapState.value.walkingLayer = mapState.value.leaflet.polyline(walkingPath.value, {
      color: '#a1a1aa',
      dashArray: '10 8',
      opacity: 0.95,
      weight: 4,
    }).addTo(mapState.value.map)
    bounds.push(...walkingPath.value)
  }

  if (bounds.length > 1) {
    mapState.value.map.fitBounds(bounds, { padding: [28, 28] })
    return
  }

  if (bounds.length === 1) {
    mapState.value.map.setView(bounds[0], 14)
    return
  }

  mapState.value.map.setView([14.5764, 121.0851], 12)
}

function destroyMap() {
  if (pendingResizeFrame) {
    cancelAnimationFrame(pendingResizeFrame)
    pendingResizeFrame = 0
  }
  if (mapState.value) {
    const container = mapState.value.map.getContainer?.()
    if (container?.parentNode) {
      mapState.value.map.remove()
    }
  }
  mapState.value = null
}

function normalizeCoordinate(coordinate) {
  if (!Array.isArray(coordinate) || coordinate.length !== 2) return null
  const lat = Number(coordinate[1])
  const lng = Number(coordinate[0])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return [lat, lng]
}

function normalizePolyline(polyline) {
  if (!Array.isArray(polyline)) return []
  return polyline
    .map((coordinate) => normalizeCoordinate(coordinate))
    .filter((coordinate) => Array.isArray(coordinate))
}

async function updateMap() {
  await nextTick()
  await ensureMap()
  if (!mapState.value) return
  if (pendingResizeFrame) {
    cancelAnimationFrame(pendingResizeFrame)
    pendingResizeFrame = 0
  }
  mapState.value?.map.invalidateSize()
  syncMap()
  pendingResizeFrame = requestAnimationFrame(() => {
    pendingResizeFrame = 0
    mapState.value?.map.invalidateSize()
    syncMap()
  })
}

watch([route, commutePath, walkingPath], () => {
  updateMap().catch(() => {})
}, { deep: true })

onMounted(() => {
  updateMap().catch(() => {})
})

onBeforeUnmount(() => {
  destroyMap()
})

function formatMinutes(minutes) {
  if (typeof minutes !== 'number' || Number.isNaN(minutes)) return 'Unavailable'
  return `${minutes} min`
}
</script>
