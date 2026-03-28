<template>
  <div class="relative h-full w-full overflow-hidden bg-[#0b0d10]">
    <div
      ref="container"
      class="h-full w-full [&_.leaflet-container]:!bg-[#090a0c] [&_.leaflet-control-zoom_a]:border-zinc-700 [&_.leaflet-control-zoom_a]:bg-zinc-950 [&_.leaflet-control-zoom_a]:text-zinc-200"
    ></div>

    <div class="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#090a0c]/80 to-transparent"></div>
    <div class="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#090a0c] to-transparent"></div>

    <div class="absolute left-4 top-4 z-[500] flex max-w-[calc(100%-6rem)] flex-col gap-2">
      <div class="rounded-xl border border-zinc-800/90 bg-[#090a0c]/85 px-3 py-2 text-sm text-zinc-200 backdrop-blur-sm">
        {{ route?.label || 'Select a route' }}
      </div>
      <div class="flex flex-wrap gap-2 text-xs">
        <span class="rounded-md border border-orange-700/70 bg-orange-950/80 px-2.5 py-1 text-orange-200">
          Ride route
        </span>
        <span class="rounded-md border border-emerald-700/70 bg-emerald-950/80 px-2.5 py-1 text-emerald-200">
          Walk route
        </span>
      </div>
    </div>

    <div
      v-if="loading"
      class="absolute right-4 top-4 z-[500] rounded-xl border border-zinc-800/90 bg-[#090a0c]/85 px-3 py-2 text-xs text-zinc-300 backdrop-blur-sm"
    >
      Refreshing map
    </div>

    <div
      v-if="!route"
      class="absolute inset-x-4 bottom-6 z-[500] rounded-xl border border-zinc-800 bg-[#090a0c]/90 px-4 py-3 text-sm text-zinc-400 backdrop-blur-sm"
    >
      Pick a public route to load the ride and walking geometry.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import 'leaflet/dist/leaflet.css';
import { addLeafletBaseLayer, isOfflineClient } from '~/composables/maps/leafletBaseLayer';
import { coordinateToQueuePoint, polylineToQueuePoints } from '~/lib/queueCommute';

const props = defineProps({
  estimate: { type: Object, default: null },
  loading: Boolean,
  route: { type: Object, default: null }
});

const container = ref<HTMLElement | null>(null);

let leaflet: any = null;
let map: any = null;
let layerGroup: any = null;
let resizeObserver: ResizeObserver | null = null;

const ridePoints = computed(() => polylineToQueuePoints(props.estimate?.polyline));
const walkPoints = computed(() => polylineToQueuePoints(props.estimate?.walking_polyline));
const originPoint = computed(() => coordinateToQueuePoint(props.route?.origin));
const destinationPoint = computed(() => coordinateToQueuePoint(props.route?.destination));
const fallbackPoints = computed(() =>
  [originPoint.value, destinationPoint.value].filter(
    (point): point is { lat: number; lng: number } => point !== null
  )
);
const allPoints = computed(() => {
  const points = [...ridePoints.value, ...walkPoints.value, ...fallbackPoints.value];
  return points.filter(
    (point, index, source) =>
      source.findIndex(
        (candidate) => candidate.lat === point.lat && candidate.lng === point.lng
      ) === index
  );
});

function normalizePoints(points: Array<{ lat: number; lng: number }>) {
  return points
    .map((point) => [Number(point.lat), Number(point.lng)])
    .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
}

async function ensureLeaflet() {
  if (!container.value) return null;
  if (!leaflet) {
    const mod = await import('leaflet');
    leaflet = mod?.default || mod;
  }
  if (!map) {
    map = leaflet.map(container.value, {
      attributionControl: false,
      zoomControl: false
    });
    addLeafletBaseLayer(
      leaflet,
      map,
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { offline: isOfflineClient() }
    );
    leaflet.control.zoom({ position: 'bottomright' }).addTo(map);
    layerGroup = leaflet.layerGroup().addTo(map);
  }
  return map;
}

async function renderMap() {
  const instance = await ensureLeaflet();
  if (!instance || !leaflet || !layerGroup) return;

  layerGroup.clearLayers();

  const ride = normalizePoints(ridePoints.value);
  const walk = normalizePoints(walkPoints.value);
  const fallback = normalizePoints(fallbackPoints.value);
  const all = normalizePoints(allPoints.value);

  if (ride.length > 1) {
    leaflet
      .polyline(ride, {
        color: '#f97316',
        lineCap: 'round',
        lineJoin: 'round',
        opacity: 0.95,
        weight: 5
      })
      .addTo(layerGroup);
  }

  if (walk.length > 1) {
    leaflet
      .polyline(walk, {
        color: '#22c55e',
        dashArray: '8 8',
        lineCap: 'round',
        lineJoin: 'round',
        opacity: 0.9,
        weight: 4
      })
      .addTo(layerGroup);
  }

  if (!ride.length && !walk.length && fallback.length > 1) {
    leaflet
      .polyline(fallback, {
        color: '#e4e4e7',
        lineCap: 'round',
        lineJoin: 'round',
        opacity: 0.75,
        weight: 3
      })
      .addTo(layerGroup);
  }

  if (originPoint.value) {
    leaflet
      .circleMarker([originPoint.value.lat, originPoint.value.lng], {
        color: '#ffffff',
        fillColor: '#f97316',
        fillOpacity: 1,
        radius: 7,
        weight: 2
      })
      .addTo(layerGroup);
  }

  if (destinationPoint.value) {
    leaflet
      .circleMarker([destinationPoint.value.lat, destinationPoint.value.lng], {
        color: '#ffffff',
        fillColor: '#22c55e',
        fillOpacity: 1,
        radius: 7,
        weight: 2
      })
      .addTo(layerGroup);
  }

  await nextTick();
  instance.invalidateSize();

  if (all.length > 1) {
    instance.fitBounds(leaflet.latLngBounds(all), { padding: [36, 36] });
    return;
  }

  if (all.length === 1) {
    instance.setView(all[0], 13);
    return;
  }

  instance.setView([14.5995, 120.9842], 11);
}

function invalidateMap() {
  map?.invalidateSize();
}

onMounted(async () => {
  await renderMap();
  if (container.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => invalidateMap());
    resizeObserver.observe(container.value);
  }
});

watch(
  () => [props.route, props.estimate?.polyline, props.estimate?.walking_polyline],
  async () => {
    await renderMap();
  },
  { deep: true }
);

defineExpose({
  invalidateMap
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  if (map) {
    map.remove();
    map = null;
  }
});
</script>
