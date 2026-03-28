<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[2300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      @click.self="$emit('close')"
    >
      <div class="grid h-[min(90vh,820px)] w-full max-w-6xl gap-4 overflow-hidden rounded-[20px] border border-zinc-800 bg-[#111418] p-4 text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)] lg:grid-cols-[320px_1fr]">
        <div class="flex flex-col rounded-[16px] border border-zinc-800 bg-zinc-950 p-4">
          <div class="mb-4 flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-white">{{ title }}</p>
              <p class="mt-1 text-sm text-zinc-500">Search a place or click the map.</p>
            </div>
            <button class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white" @click="$emit('close')">
              Close
            </button>
          </div>

          <form class="grid gap-3" @submit.prevent="searchPlaces">
            <label class="grid gap-2 text-sm text-zinc-300">
              <span>Search place</span>
              <input
                v-model.trim="query"
                type="text"
                placeholder="Ortigas Center, Pasig"
                class="rounded-lg border border-zinc-700 bg-[#111418] px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400"
              >
            </label>
            <button
              class="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="searching || !query"
            >
              {{ searching ? 'Searching' : 'Search' }}
            </button>
          </form>

          <p v-if="searchError" class="mt-3 rounded-lg border border-rose-900 bg-rose-950 px-3 py-2 text-sm text-rose-300">
            {{ searchError }}
          </p>

          <div class="mt-4 flex-1 overflow-auto rounded-[16px] border border-zinc-800 bg-[#111418] p-2">
            <button
              v-for="result in results"
              :key="`${result.lat}-${result.lng}-${result.label}`"
              class="mb-2 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-left transition hover:border-orange-400"
              @click="selectResult(result)"
            >
              <div class="text-sm font-semibold text-white">{{ result.label }}</div>
              <div class="mt-1 text-xs text-zinc-500">{{ result.lat.toFixed(5) }}, {{ result.lng.toFixed(5) }}</div>
            </button>
            <div v-if="!results.length" class="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
              No results yet.
            </div>
          </div>

          <div class="mt-4 rounded-[16px] border border-zinc-800 bg-[#111418] px-4 py-3">
            <p class="text-xs text-zinc-500">Selected point</p>
            <p class="mt-1 text-sm font-semibold text-white">{{ selectedLabel }}</p>
          </div>
        </div>

        <div class="flex min-h-0 flex-col rounded-[16px] border border-zinc-800 bg-zinc-950 p-3">
          <div ref="mapElement" class="min-h-0 flex-1 overflow-hidden rounded-[14px]" />
          <div class="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-zinc-800 bg-[#111418] px-4 py-3">
            <p class="text-sm text-zinc-400">Click the map or choose a search result.</p>
            <button
              class="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!pendingSelection"
              @click="confirmSelection"
            >
              Use this location
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

type PickerResult = {
  label: string;
  lat: number;
  lng: number;
};

const props = defineProps({
  coordinate: { type: Array, default: () => [] },
  open: Boolean,
  title: { type: String, default: 'Pick location' }
});

const emit = defineEmits<{
  close: [];
  select: [[number, number]];
}>();

const mapElement = ref<HTMLElement | null>(null);
const mapState = ref<any>(null);
const markerState = ref<any>(null);
const query = ref('');
const results = ref<PickerResult[]>([]);
const searching = ref(false);
const searchError = ref('');
const pendingSelection = ref<PickerResult | null>(null);
const reverseGeocoding = ref(false);
let reverseLookupId = 0;

const selectedLabel = computed(() => {
  if (!pendingSelection.value) return 'No point selected';
  if (reverseGeocoding.value) return 'Resolving place name...';
  if (pendingSelection.value.label) return pendingSelection.value.label;
  return `${pendingSelection.value.lat.toFixed(6)}, ${pendingSelection.value.lng.toFixed(6)}`;
});

async function ensureMap() {
  if (mapState.value || !mapElement.value) return;

  const leaflet = await import('leaflet');
  const map = leaflet.map(mapElement.value, {
    center: [14.5764, 121.0851],
    zoom: 13,
    zoomControl: true
  });

  leaflet
    .tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
      subdomains: 'abcd'
    })
    .addTo(map);

  map.on('click', async (event: any) => {
    const selection = { lat: event.latlng.lat, lng: event.latlng.lng, label: '' };
    setSelection(selection);
    await reverseGeocode(selection);
  });

  mapState.value = { leaflet, map };
}

function setSelection(selection: PickerResult) {
  pendingSelection.value = selection;
  if (!mapState.value) return;

  const { leaflet, map } = mapState.value;
  if (markerState.value) {
    markerState.value.setLatLng([selection.lat, selection.lng]);
    return;
  }

  markerState.value = leaflet
    .circleMarker([selection.lat, selection.lng], {
      color: '#f97316',
      fillColor: '#fb923c',
      fillOpacity: 0.9,
      radius: 8,
      weight: 2
    })
    .addTo(map);
}

function focusSelection(selection: PickerResult) {
  if (!selection || !mapState.value) return;
  mapState.value.map.flyTo([selection.lat, selection.lng], 15, { duration: 0.6 });
}

function destroyMap() {
  if (mapState.value) {
    mapState.value.map.remove();
  }

  mapState.value = null;
  markerState.value = null;
  mapElement.value = null;
}

async function searchPlaces() {
  searchError.value = '';
  if (!query.value) return;
  searching.value = true;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '8');
    url.searchParams.set('q', query.value);
    const response = await fetch(url, {
      headers: { accept: 'application/json' }
    });
    const payload = await response.json();
    results.value = Array.isArray(payload)
      ? payload
          .map((item: any) => ({
            label: item.display_name,
            lat: Number(item.lat),
            lng: Number(item.lon)
          }))
          .filter((item: PickerResult) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
      : [];
  } catch (error) {
    searchError.value = error instanceof Error ? error.message : 'Search failed';
  } finally {
    searching.value = false;
  }
}

async function reverseGeocode(selection: PickerResult) {
  const lookupId = ++reverseLookupId;
  reverseGeocoding.value = true;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(selection.lat));
    url.searchParams.set('lon', String(selection.lng));
    const response = await fetch(url, {
      headers: { accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`Reverse geocoding failed with ${response.status}`);
    const payload = await response.json();
    if (lookupId !== reverseLookupId || !pendingSelection.value) return;
    pendingSelection.value = {
      ...selection,
      label: typeof payload?.display_name === 'string' ? payload.display_name : ''
    };
  } catch {
    if (lookupId !== reverseLookupId || !pendingSelection.value) return;
    pendingSelection.value = {
      ...selection,
      label: ''
    };
  } finally {
    if (lookupId === reverseLookupId) reverseGeocoding.value = false;
  }
}

function selectResult(result: PickerResult) {
  setSelection(result);
  focusSelection(result);
}

function confirmSelection() {
  if (!pendingSelection.value) return;
  emit('select', [pendingSelection.value.lng, pendingSelection.value.lat]);
  emit('close');
}

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      destroyMap();
      return;
    }

    await nextTick();
    await ensureMap();
    const selection =
      Array.isArray(props.coordinate) && props.coordinate.length === 2
        ? { lng: Number(props.coordinate[0]), lat: Number(props.coordinate[1]), label: '' }
        : { lng: 121.0851, lat: 14.5764, label: '' };
    setSelection(selection);
    focusSelection(selection);
    mapState.value?.map.invalidateSize();
  }
);

onBeforeUnmount(() => {
  destroyMap();
});
</script>
