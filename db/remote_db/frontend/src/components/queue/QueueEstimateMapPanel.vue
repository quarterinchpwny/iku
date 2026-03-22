<template>
  <section class="rounded-[28px] border border-slate-700/70 bg-slate-950/80 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur">
    <div class="mb-5 flex items-start justify-between gap-4">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">ORS Map</p>
        <h2 class="text-2xl font-semibold text-white">Commute vs walk path</h2>
      </div>
      <button
        class="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-amber-300 hover:text-white"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        {{ loading ? 'Refreshing...' : 'Refresh map' }}
      </button>
    </div>

    <p v-if="error" class="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </p>

    <div v-if="route" class="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div class="overflow-hidden rounded-[24px] border border-slate-800 bg-slate-900">
        <div ref="mapElement" class="h-[420px] w-full" />
      </div>

      <div class="grid gap-3">
        <div class="rounded-[24px] border border-slate-700 bg-slate-900/70 px-4 py-4">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Best option</p>
          <p class="mt-2 text-lg font-semibold text-white">{{ recommendationTitle }}</p>
          <p class="mt-2 text-sm leading-6 text-slate-300">{{ recommendationMessage }}</p>
        </div>

        <div class="rounded-[24px] border border-amber-400/30 bg-amber-500/10 px-4 py-4">
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs uppercase tracking-[0.18em] text-amber-200">Commute path</p>
            <span class="rounded-full border border-amber-300/40 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">
              {{ commutePointCount }} points
            </span>
          </div>
          <p class="mt-2 text-sm font-medium text-white">{{ commuteStatus }}</p>
          <p class="mt-2 text-sm text-amber-100">Ride total: {{ formatMinutes(estimate?.recommendation?.ride_total_minutes) }}</p>
        </div>

        <div class="rounded-[24px] border border-sky-400/30 bg-sky-500/10 px-4 py-4">
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs uppercase tracking-[0.18em] text-sky-200">Walking path</p>
            <span class="rounded-full border border-sky-300/40 bg-sky-400/10 px-2.5 py-1 text-[11px] font-semibold text-sky-100">
              {{ walkingPointCount }} points
            </span>
          </div>
          <p class="mt-2 text-sm font-medium text-white">{{ walkingStatus }}</p>
          <p class="mt-2 text-sm text-sky-100">Walk total: {{ formatMinutes(estimate?.recommendation?.walk_total_minutes) }}</p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-[24px] border border-slate-700 bg-slate-900/70 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Origin</p>
            <p class="mt-2 text-sm font-medium text-white">{{ formatCoordinate(route.origin) }}</p>
          </div>
          <div class="rounded-[24px] border border-slate-700 bg-slate-900/70 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Destination</p>
            <p class="mt-2 text-sm font-medium text-white">{{ formatCoordinate(route.destination) }}</p>
          </div>
        </div>
      </div>
    </div>

    <p v-else class="text-sm text-slate-400">Select a route and fetch an estimate to inspect the walking and commute geometry.</p>
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
  () => props.estimate?.recommendation?.message ?? 'Fetch an estimate with ORS geometry to compare both travel modes.'
)
const commuteStatus = computed(() => {
  if (commutePath.value.length > 1) return 'Driving geometry loaded from OpenRouteService.'
  return 'Driving geometry unavailable, showing endpoints only.'
})
const walkingStatus = computed(() => {
  if (walkingPath.value.length > 1) return 'Walking geometry loaded from OpenRouteService.'
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
      color: '#f8fafc',
      fillColor: '#38bdf8',
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
      color: '#38bdf8',
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
  if (mapState.value) {
    mapState.value.map.remove()
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
  if (!route.value) {
    clearLayers()
    return
  }

  await nextTick()
  await ensureMap()
  syncMap()
  mapState.value?.map.invalidateSize()
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
