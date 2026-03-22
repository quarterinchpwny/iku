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
      color: props.featured ? '#38bdf8' : '#60a5fa',
      weight: props.featured ? 4 : 3,
      opacity: 0.95
    })
    .addTo(map);
  startLayer = mapLib
    .circleMarker(coords[0], {
      radius: 4,
      color: '#ffffff',
      fillColor: '#10b981',
      fillOpacity: 1,
      weight: 1.5
    })
    .addTo(map);
  endLayer = mapLib
    .circleMarker(coords[coords.length - 1], {
      radius: 4,
      color: '#ffffff',
      fillColor: '#f59e0b',
      fillOpacity: 1,
      weight: 1.5
    })
    .addTo(map);
  await nextTick();
  map.invalidateSize();
  map.fitBounds(mapLib.latLngBounds(coords), { padding: props.featured ? [18, 18] : [14, 14] });
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
  <div
    class="overflow-hidden"
    :class="
      frameless
        ? 'h-full bg-transparent'
        : 'rounded-[17px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,11,16,0.96),rgba(7,8,12,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
    "
  >
    <div
      ref="container"
      class="w-full h-full"
    ></div>
  </div>
</template>
