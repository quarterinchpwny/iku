<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import 'leaflet/dist/leaflet.css';

const props = defineProps<{
  fill?: boolean;
  frameless?: boolean;
  points: Array<{ lat: number; lng: number }>;
  featured?: boolean;
}>();

const container = ref<HTMLElement | null>(null);
let mapLib: any = null;
let mapInstance: any = null;
let tileLayer: any = null;
let routeLayer: any = null;
let startLayer: any = null;
let endLayer: any = null;
let resizeObserver: ResizeObserver | null = null;
let lastCoords: Array<[number, number]> = [];

function clearLayers() {
  if (routeLayer && mapInstance) mapInstance.removeLayer(routeLayer);
  if (startLayer && mapInstance) mapInstance.removeLayer(startLayer);
  if (endLayer && mapInstance) mapInstance.removeLayer(endLayer);
  routeLayer = null;
  startLayer = null;
  endLayer = null;
}

function normalizedCoords() {
  return (Array.isArray(props.points) ? props.points : [])
    .map((point) => [Number(point.lat), Number(point.lng)] as [number, number])
    .filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]));
}

async function syncViewport() {
  if (!mapInstance || !lastCoords.length) return;
  await nextTick();
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  mapInstance.invalidateSize();
  if (lastCoords.length === 1) {
    mapInstance.setView(lastCoords[0], 14);
    return;
  }
  mapInstance.fitBounds(mapLib.latLngBounds(lastCoords), {
    padding: props.featured ? [24, 24] : [14, 14]
  });
}

async function ensureMap() {
  if (!container.value) return null;
  if (!mapLib) {
    const mod = await import('leaflet');
    mapLib = mod?.default || mod;
  }
  if (!mapInstance) {
    mapInstance = mapLib.map(container.value, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false
    });
    tileLayer = mapLib
      .tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd'
      })
      .addTo(mapInstance);
  }
  return mapInstance;
}

async function renderMap() {
  const map = await ensureMap();
  if (!map) return;
  const coords = normalizedCoords();
  lastCoords = coords;
  clearLayers();
  if (!coords.length) {
    map.setView([14.5995, 120.9842], 12);
    return;
  }
  if (coords.length === 1) {
    startLayer = mapLib
      .circleMarker(coords[0], {
        radius: 8,
        color: '#ffffff',
        fillColor: props.featured ? '#f97316' : '#3b82f6',
        fillOpacity: 1,
        weight: 2
      })
      .addTo(map);
    await syncViewport();
    return;
  }
  routeLayer = mapLib
    .polyline(coords, {
      color: props.featured ? '#e85c0d' : '#f97316',
      weight: props.featured ? 6 : 4,
      opacity: 1
    })
    .addTo(map);
  startLayer = mapLib
    .circleMarker(coords[0], {
      radius: 8,
      color: '#ffffff',
      fillColor: '#3b82f6',
      fillOpacity: 1,
      weight: 2
    })
    .addTo(map);
  endLayer = mapLib
    .circleMarker(coords[coords.length - 1], {
      radius: 8,
      color: '#ffffff',
      fillColor: '#f59e0b',
      fillOpacity: 1,
      weight: 2
    })
    .addTo(map);
  await syncViewport();
}

watch(
  () => props.points,
  async () => {
    await renderMap();
  },
  { deep: true, flush: 'post' }
);

onMounted(async () => {
  await renderMap();
  if (typeof ResizeObserver !== 'undefined' && container.value) {
    resizeObserver = new ResizeObserver(async () => {
      await syncViewport();
    });
    resizeObserver.observe(container.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  if (mapInstance) mapInstance.remove();
});
</script>

<template>
  <div class="h-full overflow-hidden bg-transparent">
    <div ref="container" class="h-full w-full" style="z-index: 0; position: relative"></div>
  </div>
</template>
