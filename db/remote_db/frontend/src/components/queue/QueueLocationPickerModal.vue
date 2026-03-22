<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[2100] flex items-center justify-center bg-stone-950/75 p-4" @click.self="$emit('close')">
      <div class="grid h-[min(90vh,820px)] w-full max-w-6xl gap-4 overflow-hidden rounded-[28px] border border-stone-700 bg-stone-950 p-4 text-stone-100 shadow-[0_40px_120px_rgba(0,0,0,0.55)] lg:grid-cols-[320px_1fr]">
        <div class="flex flex-col rounded-[24px] border border-white/10 bg-white/5 p-4">
          <div class="mb-4 flex items-start justify-between gap-3">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">Map Picker</p>
              <h3 class="text-lg font-semibold text-white">{{ title }}</h3>
            </div>
            <button class="rounded-full border border-white/10 px-3 py-1.5 text-xs text-stone-200 transition hover:border-white hover:text-white" @click="$emit('close')">
              Close
            </button>
          </div>

          <form class="grid gap-3" @submit.prevent="searchPlaces">
            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Search place</span>
              <input v-model.trim="query" type="text" placeholder="Ortigas Center, Pasig" class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300">
            </label>
            <button class="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:opacity-60" :disabled="searching || !query">
              {{ searching ? 'Searching...' : 'Search' }}
            </button>
          </form>

          <p v-if="searchError" class="mt-3 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {{ searchError }}
          </p>

          <div class="mt-4 flex-1 overflow-auto rounded-[22px] border border-white/10 bg-black/20 p-2">
            <button
              v-for="result in results"
              :key="`${result.lat}-${result.lng}-${result.label}`"
              class="mb-2 block w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left transition hover:border-amber-300 hover:bg-white/10"
              @click="selectResult(result)"
            >
              <div class="text-sm font-semibold text-white">{{ result.label }}</div>
              <div class="mt-1 text-xs text-stone-400">{{ result.lat.toFixed(5) }}, {{ result.lng.toFixed(5) }}</div>
            </button>
            <div v-if="!results.length" class="flex h-full items-center justify-center px-4 text-center text-sm text-stone-400">
              Search for a place or click on the map to pick a coordinate.
            </div>
          </div>

          <div class="mt-4 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Selected point</p>
            <p class="mt-1 text-sm font-semibold text-white">{{ selectedLabel }}</p>
          </div>
        </div>

        <div class="flex min-h-0 flex-col rounded-[24px] border border-white/10 bg-black/20 p-3">
          <div ref="mapElement" class="min-h-0 flex-1 overflow-hidden rounded-[20px]" />
          <div class="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
            <p class="text-sm text-stone-300">Click anywhere on the map or choose a search result.</p>
            <button class="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:opacity-60" :disabled="!pendingSelection" @click="confirmSelection">
              Use this location
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import 'leaflet/dist/leaflet.css'

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  coordinate: { type: Array, default: () => [] },
  open: Boolean,
  title: { type: String, default: 'Pick location' },
})

const emit = defineEmits(['close', 'select'])

const mapElement = ref(null)
const mapState = ref(null)
const markerState = ref(null)
const query = ref('')
const results = ref([])
const searching = ref(false)
const searchError = ref('')
const pendingSelection = ref(null)
const reverseGeocoding = ref(false)
let reverseLookupId = 0

const selectedLabel = computed(() => {
  if (!pendingSelection.value) return 'No point selected'
  if (reverseGeocoding.value) return 'Resolving place name...'
  if (pendingSelection.value.label) return pendingSelection.value.label
  return `${pendingSelection.value.lat.toFixed(6)}, ${pendingSelection.value.lng.toFixed(6)}`
})

async function ensureMap() {
  if (mapState.value || !mapElement.value) return

  const leaflet = await import('leaflet')
  const map = leaflet.map(mapElement.value, {
    center: [14.5764, 121.0851],
    zoom: 13,
    zoomControl: true,
  })
  leaflet.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(map)
  map.on('click', async (event) => {
    const selection = { lat: event.latlng.lat, lng: event.latlng.lng, label: '' }
    setSelection(selection)
    await reverseGeocode(selection)
  })
  mapState.value = { leaflet, map }
}

function setSelection(selection) {
  pendingSelection.value = selection
  if (!mapState.value) return

  const { leaflet, map } = mapState.value
  if (markerState.value) {
    markerState.value.setLatLng([selection.lat, selection.lng])
  } else {
    markerState.value = leaflet.circleMarker([selection.lat, selection.lng], {
      radius: 8,
      color: '#f59e0b',
      weight: 2,
      fillColor: '#fbbf24',
      fillOpacity: 0.85,
    }).addTo(map)
  }
}

function focusSelection(selection) {
  if (!selection || !mapState.value) return
  mapState.value.map.flyTo([selection.lat, selection.lng], 15, { duration: 0.6 })
}

function destroyMap() {
  if (mapState.value) {
    mapState.value.map.remove()
  }

  mapState.value = null
  markerState.value = null
  mapElement.value = null
}

async function searchPlaces() {
  searchError.value = ''
  if (!query.value) return
  searching.value = true

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '8')
    url.searchParams.set('q', query.value)
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
    })
    const payload = await response.json()
    results.value = Array.isArray(payload)
      ? payload.map((item) => ({
          label: item.display_name,
          lat: Number(item.lat),
          lng: Number(item.lon),
        })).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
      : []
  } catch (error) {
    searchError.value = error instanceof Error ? error.message : 'Search failed'
  } finally {
    searching.value = false
  }
}

async function reverseGeocode(selection) {
  const lookupId = ++reverseLookupId
  reverseGeocoding.value = true

  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('lat', String(selection.lat))
    url.searchParams.set('lon', String(selection.lng))
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`Reverse geocoding failed with ${response.status}`)
    const payload = await response.json()
    if (lookupId !== reverseLookupId || !pendingSelection.value) return
    pendingSelection.value = {
      ...selection,
      label: typeof payload?.display_name === 'string' ? payload.display_name : '',
    }
  } catch {
    if (lookupId !== reverseLookupId || !pendingSelection.value) return
    pendingSelection.value = {
      ...selection,
      label: '',
    }
  } finally {
    if (lookupId === reverseLookupId) reverseGeocoding.value = false
  }
}

function selectResult(result) {
  setSelection(result)
  focusSelection(result)
}

function confirmSelection() {
  if (!pendingSelection.value) return
  emit('select', [pendingSelection.value.lng, pendingSelection.value.lat])
  emit('close')
}

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      destroyMap()
      return
    }

    await nextTick()
    await ensureMap()
    const selection = Array.isArray(props.coordinate) && props.coordinate.length === 2
      ? { lng: Number(props.coordinate[0]), lat: Number(props.coordinate[1]) }
      : { lng: 121.0851, lat: 14.5764 }
    setSelection(selection)
    focusSelection(selection)
    mapState.value?.map.invalidateSize()
  },
)

onBeforeUnmount(() => {
  destroyMap()
})
</script>
