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
  if (!props.points?.length) return;
  const map = await ensureMap();
  if (!map) return;
  const coords = props.points
    .map((point) => [Number(point.lat), Number(point.lng)])
    .filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]));
  if (routeLayer) map.removeLayer(routeLayer);
  if (startLayer) map.removeLayer(startLayer);
  if (endLayer) map.removeLayer(endLayer);
  if (coords.length < 2) {
    map.setView(coords[0] || [14.5995, 120.9842], 12);
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
  await nextTick();
  map.invalidateSize();
  map.fitBounds(mapLib.latLngBounds(coords), { padding: props.featured ? [24, 24] : [14, 14] });
}

watch(
  () => props.points,
  async () => {
    await renderMap();
  },
  { deep: true }
);

onMounted(async () => {
  await renderMap();
});

onUnmounted(() => {
  if (mapInstance) mapInstance.remove();
});
</script>

<template>
  <div class="h-full overflow-hidden bg-transparent">
    <div ref="container" class="h-full w-full" style="z-index: 0; position: relative"></div>
  </div>
</template>
