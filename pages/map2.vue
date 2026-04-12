<template>
  <div class="relative flex h-[calc(100vh-4rem)] w-full flex-col md:h-screen overflow-hidden">
    <!-- MAP CONTAINER -->
    <div ref="mapContainer" class="absolute inset-0 h-full w-full z-0" />

    <!-- MAP LOADING OVERLAY -->
    <transition
      enter-active-class="transition-opacity duration-500"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-500"
      leave-to-class="opacity-0"
    >
      <div
        v-if="mapLoading"
        class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0a]"
      >
        <div
          class="mb-4 h-12 w-12 animate-spin rounded-full border-[3px] border-[rgba(255,100,0,0.15)] border-t-orange-500"
        ></div>
        <span class="font-mono text-xs uppercase tracking-widest text-orange-500 animate-pulse">
          Initializing Map...
        </span>
      </div>
    </transition>

    <!-- TACTICAL SITREP - Floating Overlay -->
    <div class="absolute left-4 right-4 top-4 z-20 p-4 backdrop-blur-md" style="
        background-color: rgba(0, 0, 0, 0.72);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      ">
      <div class="mb-2 flex items-start justify-between">
        <span class="text-xs font-bold uppercase tracking-widest text-orange-500">&gt; TACTICAL_SITREP.LOG</span>
        <div class="flex items-center gap-2">
          <button
            @click="recenterToCurrentLocation"
            class="rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-mono uppercase tracking-wide text-white/80 transition-colors hover:bg-white/10"
          >
            Locate
          </button>
          <button
            @click="autoFollow = !autoFollow"
            :class="autoFollow ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-300' : 'border-white/15 bg-white/5 text-white/70'"
            class="rounded border px-2 py-1 text-[10px] font-mono uppercase tracking-wide transition-colors"
          >
            {{ autoFollow ? 'Follow ON' : 'Follow OFF' }}
          </button>
          <span v-if="isRecording || geoStore.isPassiveTracking" class="flex h-2 w-2 animate-pulse rounded-full"
            :class="isRecording ? 'bg-red-500' : 'bg-green-500'"></span>
          <span class="text-[10px] font-mono opacity-50 uppercase">
            {{ isRecording ? 'Recording' : (geoStore.isPassiveTracking ? 'Shield Active' : 'Standby') }}
          </span>
        </div>
      </div>

      <div class="font-mono text-[10px] leading-relaxed text-white/80 space-y-1">
        <div class="flex justify-between border-b border-white/5 pb-1">
          <span>STATUS:</span>
          <span
            :class="isRecording ? 'text-red-400' : (geoStore.isPassiveTracking ? 'text-green-400' : 'text-zinc-500')">
            {{ isRecording ? 'ACTIVE_RECORD' : (geoStore.isPassiveTracking ? 'SHIELD_PROTECT' : 'IDLE') }}
          </span>
        </div>

        <div v-if="isRecording" class="flex justify-between">
          <span>ROUTE_ID:</span>
          <span class="text-cyan-400">{{ geoStore.activeRouteId }}</span>
        </div>

        <div v-if="currentPosition" class="flex justify-between">
          <span>COORDS:</span>
          <span>{{ currentPosition.lat.toFixed(5) }}, {{ currentPosition.lng.toFixed(5) }}</span>
        </div>

        <div class="flex justify-between">
          <span>HEADING:</span>
          <span :class="activeHeading !== null ? 'text-sky-400' : 'text-zinc-600'">
            {{ activeHeading !== null ? `${Math.round(activeHeading)}° (${usedHeadingSource})` : 'NO_SIGNAL' }}
          </span>
        </div>

        <div class="flex justify-between">
          <span>LAST_FIX:</span>
          <span :class="lastFixAt ? 'text-emerald-400' : 'text-zinc-600'">
            {{ lastFixAt ? fmtRelative(lastFixAt) : 'NO_FIX' }}
          </span>
        </div>

        <div v-if="isRecording" class="flex justify-between">
          <span>HOME_ZONE:</span>
          <span :class="geoStore.isAtHome ? 'text-emerald-400' : 'text-zinc-500'">
            {{ geoStore.isAtHome ? 'ENTERED' : 'OUTSIDE' }}
          </span>
        </div>

        <div class="pt-1 opacity-30">
          <span class="cursor-blink">_</span>
        </div>
      </div>
    </div>

    <!-- MOTION NAV -->
    <motion.div :initial="{ opacity: 0 }" :animate="{ opacity: 1 }"
      class="pointer-events-none absolute inset-0 z-[9999]">

      <!-- Panel -->
      <motion.div
        :transition="{ duration: 0.6 }"
        :variants="expandVariants"
        :animate="willExpand ? 'expand' : 'notexpand'"
        class="absolute bottom-[110px] right-0 max-w-full overflow-hidden"
      >
        <motion.nav ref="containerRef" :initial="false" :animate="isOpen ? 'open' : 'closed'"
          :custom="dimensions.height" class="pointer-events-auto relative w-[280px]">

          <motion.div
            class="absolute inset-0 w-full rounded-l-2xl border border-r-0 border-white/10 bg-[rgba(10,10,12,0.85)] backdrop-blur-2xl"
            :variants="sidebarVariants"
          />
          <div
            class="pointer-events-none absolute inset-0 z-[1] rounded-l-2xl bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)] opacity-40"
          />

          <button
            v-if="willExpand"
            class="absolute left-3.5 top-3.5 h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] text-white"
            @click="willExpand = !willExpand"
          >
            <svg width="20" height="20" viewBox="0 0 23 23">
              <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round"
                :variants="{ closed: { d: 'M 2 2.5 L 20 2.5' }, open: { d: 'M 3 16.5 L 17 2.5' } }" />
              <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round"
                d="M 2 9.423 L 20 9.423" :variants="{ closed: { opacity: 1 }, open: { opacity: 0 } }"
                :transition="{ duration: 0.1 }" />
              <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round"
                :variants="{ closed: { d: 'M 2 16.346 L 20 16.346' }, open: { d: 'M 3 2.5 L 17 16.346' } }" />
            </svg>
          </button>

          <motion.div class="absolute w-full px-4 pt-5 pb-16" :variants="navVariants">
            <motion.div :variants="itemVariants">
              <div class="relative z-[2] mb-4 flex items-center justify-between border-b border-white/10 p-3">
                <span class="font-mono text-[10px] font-extrabold tracking-[0.18em] text-orange-500"
                  >&gt; CTRL_PANEL</span
                >
                <span
                  class="h-1.5 w-1.5 rounded-full bg-white/10"
                  :class="isRecording ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : ''"
                ></span>
              </div>

              <div class="flex flex-col gap-2">
                <button
                  v-if="!isRecording"
                  class="flex w-full items-center gap-2.5 border border-cyan-400/15 bg-white/[0.03] p-3 font-mono text-[10px] text-cyan-300"
                  @click="startTracking"
                >
                  <span>▶</span>
                  <span>START_RECORDING</span>
                </button>
                <button
                  v-if="isRecording"
                  class="flex w-full items-center gap-2.5 border border-red-400/15 bg-white/[0.03] p-3 font-mono text-[10px] text-red-400"
                  @click="stopTracking"
                >
                  <span>■</span>
                  <span>STOP_RECORDING</span>
                </button>

                <div class="flex items-center border-t border-white/10 pt-2">
                  <span class="text-[9px] tracking-[0.15em] text-white/55">HISTORY_LOGS</span>
                </div>

                <div
                  class="max-h-[200px] overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#f97316_rgba(255,255,255,0.05)] [&::-webkit-scrollbar-thumb]:bg-orange-500 [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar]:w-0.5"
                >
                  <div v-for="r in historyRoutes" :key="r.id" 
                    class="group flex items-center justify-between gap-2 p-2 bg-white/5 border border-white/10 hover:border-orange-500/50 transition-colors cursor-pointer"
                    :class="selectedRouteId == r.id ? 'border-orange-500 bg-orange-500/10' : ''"
                    @click="selectedRouteId = r.id; loadRoute()">
                    <div class="flex flex-col overflow-hidden">
                      <span class="text-[10px] font-mono text-white/90 truncate">
                        LOG_{{ r.id }}
                      </span>
                      <span class="text-[8px] font-mono text-white/40">
                        {{ new Date(r.timestamp).toLocaleString() }}
                      </span>
                    </div>
                    <button @click.stop="deleteRoute(r.id)" 
                      class="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-red-400 transition-all">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                  <div v-if="historyRoutes.length === 0" class="text-center py-4 opacity-30 font-mono text-[10px]">
                    NO_DATA_FOUND
                  </div>
                </div>

                <button
                  class="flex w-full items-center gap-2.5 border border-white/10 bg-white/[0.03] p-3 font-mono text-[10px] text-white/60"
                  @click="requestOrientationPermission"
                >
                  <span>🧭</span>
                  <span>CALIBRATE_COMPASS</span>
                </button>
                <button
                  class="flex w-full items-center gap-2.5 border border-white/10 bg-white/[0.03] p-3 font-mono text-[10px] text-white/60"
                  @click="fitToSelectedRoute"
                >
                  <span>⌖</span>
                  <span>FIT_VIEW</span>
                </button>

                <div class="flex items-center border-t border-white/10 pt-2">
                  <span class="text-[9px] tracking-[0.15em] text-white/55">GEOFENCES</span>
                </div>

                <select
                  v-model.number="selectedGeofenceId"
                  class="w-full border border-[#333] bg-black p-2 font-mono text-white"
                  @change="applySelectedGeofenceToEditor"
                >
                  <option :value="0">SELECT_GEOFENCE</option>
                  <option v-for="f in geofenceList" :key="f.id" :value="f.id">
                    {{ f.name }} ({{ Math.round(f.radius) }}m)
                  </option>
                </select>

                <input
                  v-model.trim="geofenceEditor.name"
                  class="w-full border border-[#333] bg-black p-2 font-mono text-white"
                  placeholder="GEOFENCE_NAME"
                />
                <input
                  v-model.number="geofenceEditor.radius"
                  type="range"
                  min="25"
                  max="5000"
                  step="5"
                  class="w-full"
                />
                <input
                  v-model.number="geofenceEditor.radius"
                  type="number"
                  min="25"
                  max="5000"
                  step="5"
                  class="w-full border border-[#333] bg-black p-2 font-mono text-white"
                />
                <label class="flex items-center gap-2 text-[10px] font-mono text-white/70">
                  <input v-model="geofenceEditor.enabled" type="checkbox" />
                  ENABLED
                </label>
                <button
                  class="flex w-full items-center gap-2.5 border border-white/10 bg-white/[0.03] p-3 font-mono text-[10px] text-white/60"
                  @click="createGeofenceAtCenter"
                >
                  <span>＋</span>
                  <span>ADD_AT_CENTER</span>
                </button>
                <button
                  class="flex w-full items-center gap-2.5 border border-white/10 bg-white/[0.03] p-3 font-mono text-[10px] text-white/60 disabled:cursor-not-allowed disabled:opacity-40"
                  @click="saveGeofenceEdits"
                  :disabled="selectedGeofenceId <= 0"
                >
                  <span>✎</span>
                  <span>SAVE_GEOFENCE</span>
                </button>
                <button
                  class="flex w-full items-center gap-2.5 border border-red-400/15 bg-white/[0.03] p-3 font-mono text-[10px] text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                  @click="removeSelectedGeofence"
                  :disabled="selectedGeofenceId <= 0"
                >
                  <span>🗑</span>
                  <span>REMOVE_GEOFENCE</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        </motion.nav>
      </motion.div>

      <!-- Toggle orb -->
      <button
        v-if="!willExpand"
        class="pointer-events-auto absolute bottom-[120px] right-4 h-16 w-16 bg-transparent"
        @click="toggle"
      >
        <div
          class="relative flex h-[54px] w-[54px] items-center justify-center rounded-full border border-white/10 bg-[#0a0a0c]"
        >
          <svg width="20" height="20" viewBox="0 0 23 23">
            <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round"
              :animate="isOpen ? 'open' : 'closed'"
              :variants="{ closed: { d: 'M 2 2.5 L 20 2.5' }, open: { d: 'M 3 16.5 L 17 2.5' } }" />
            <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round"
              d="M 2 9.423 L 20 9.423" :animate="isOpen ? 'open' : 'closed'"
              :variants="{ closed: { opacity: 1 }, open: { opacity: 0 } }" :transition="{ duration: 0.1 }" />
            <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round"
              :animate="isOpen ? 'open' : 'closed'"
              :variants="{ closed: { d: 'M 2 16.346 L 20 16.346' }, open: { d: 'M 3 2.5 L 17 16.346' } }" />
          </svg>
          <div class="absolute inset-[-8px] animate-pulse rounded-full border border-orange-500/15"></div>
        </div>
      </button>

    </motion.div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, reactive } from 'vue';
import { db } from '@/db/index.js';
import 'leaflet/dist/leaflet.css';
import { motion, useDomRef, type MotionProps } from 'motion-v';
import { useGeolocationStore } from '~/stores/geolocation';
import { Geolocation } from '@capacitor/geolocation';

const geoStore = useGeolocationStore();
let L: any = null;

const mapContainer = ref<HTMLElement | null>(null);
const map = ref<any>(null);
const polyline = ref<any>(null);
const userMarker = ref<any>(null);
const geofenceLayerGroup = ref<any>(null);
const markerIconElement = ref<HTMLElement | null>(null);
const mapLoading = ref(true);

const isRecording = computed(() => geoStore.isRecording);
const currentPosition = computed(() => geoStore.currentPosition);
const pathCoords = computed(() => geoStore.pathCoords);
const geofenceList = computed(() => geoStore.geofences || []);
const selectedGeofenceId = ref(0);
const geofenceEditor = reactive({
  name: '',
  radius: 100,
  enabled: true
});

const headingAlpha = ref<number | null>(null);
const gpsHeading = ref<number | null>(null);
const usedHeadingSource = ref('None');
const lastFixAt = ref(0);
const autoFollow = ref(true);
let lastPanLatLng: { lat: number; lng: number } | null = null;

const activeHeading = computed<number | null>(() => {
  if (headingAlpha.value !== null) {
    usedHeadingSource.value = 'Compass';
    return (360 - headingAlpha.value) % 360;
  }
  if (gpsHeading.value !== null && gpsHeading.value >= 0) {
    usedHeadingSource.value = 'GPS';
    return gpsHeading.value;
  }
  return null;
});

const historyRoutes = ref<any[]>([]);
const selectedRouteId = ref('');
let removeOrientationListener: (() => void) | null = null;
let removeResizeListener: (() => void) | null = null;
let activeWatchId: string | null = null;
let browserActiveWatchId: number | null = null;

const isOpen = ref(false);
const containerRef = useDomRef();
const dimensions = ref({ width: 0, height: 0 });
const willExpand = ref(false);

const toggle = () => { isOpen.value = !isOpen.value; };

const navVariants: MotionProps['variants'] = {
  open: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } },
  closed: { transition: { staggerChildren: 0.05, staggerDirection: -1 } }
};
const itemVariants = {
  open: { y: 0, opacity: 1, transition: { y: { stiffness: 1000, velocity: -100 } } },
  closed: { y: 50, opacity: 0, transition: { y: { stiffness: 1000 } } }
};
const sidebarVariants: MotionProps['variants'] = {
  open: (height: any = 1000) => ({
    clipPath: `circle(${height * 2 + 200}px at 100% 100%)`,
    transition: { type: 'spring', stiffness: 20, restDelta: 2 }
  }),
  closed: {
    clipPath: 'circle(0px at 100% 100%)',
    transition: { type: 'spring', stiffness: 400, damping: 40 }
  }
};
const expandVariants: MotionProps['variants'] = {
  expand: {
    height: '100vh', width: '100vw', top: 0, left: 0,
    bottom: '0', right: '0', borderRadius: '0px',
    transition: { duration: 0.2 }
  },
  notexpand: {
    height: '420px', width: '280px', bottom: '110px', right: '0',
    top: 'auto', left: 'auto', borderRadius: '16px 0 0 16px',
    transition: { duration: 0.3, ease: 'easeIn' }
  }
};

async function requestOrientationPermission() {
  if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
    try {
      const state = await (DeviceOrientationEvent as any).requestPermission();
      if (state === 'granted') setupDeviceOrientationListener();
    } catch (err) { console.error(err); }
  } else {
    setupDeviceOrientationListener();
  }
}

function setupDeviceOrientationListener() {
  const handler = (event: DeviceOrientationEvent) => {
    if (event.alpha !== null) {
      headingAlpha.value = event.alpha;
      updateHeadingCone();
    }
  };
  window.addEventListener('deviceorientation', handler, true);
  return () => window.removeEventListener('deviceorientation', handler, true);
}

function buildUserMarkerHTML(): string {
  return `
    <div style="position:relative;width:120px;height:120px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;border-radius:9999px;background:radial-gradient(circle, rgba(33,150,243,0.18) 0%, rgba(33,150,243,0) 100%);"></div>
      <svg class="loc-fan-svg" viewBox="0 0 120 120" style="position:absolute;inset:0;width:120px;height:120px;transform-origin:50% 50%;opacity:0.3;">
        <defs>
          <radialGradient id="fanGrad" cx="50%" cy="100%" r="100%">
            <stop offset="0%" stop-color="#2196F3" stop-opacity="0.75"/>
            <stop offset="100%" stop-color="#2196F3" stop-opacity="0.00"/>
          </radialGradient>
        </defs>
        <path d="M 60 60 L 30 15 A 52 52 0 0 1 90 15 Z" fill="url(#fanGrad)"/>
      </svg>
      <div style="display:flex;height:22px;width:22px;align-items:center;justify-content:center;border-radius:9999px;background:#fff;">
        <div style="height:14px;width:14px;border-radius:9999px;background:#2196F3;"></div>
      </div>
    </div>`;
}

function updateHeadingCone() {
  if (!markerIconElement.value && userMarker.value?._icon) markerIconElement.value = userMarker.value._icon;
  const fan = markerIconElement.value?.querySelector('.loc-fan-svg') as SVGElement | null;
  if (!fan) return;
  const angle = headingAlpha.value ?? gpsHeading.value ?? 0;
  fan.style.transform = `rotate(${angle}deg)`;
  fan.style.opacity = (headingAlpha.value !== null || gpsHeading.value !== null) ? '1' : '0.3';
}

async function initMap(latlng: any) {
  if (!mapContainer.value) return;
  map.value = L.map(mapContainer.value, { zoomControl: false, attributionControl: false });
  const tileLayer = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png', { maxZoom: 19 });
  tileLayer.addTo(map.value);
  map.value.setView(latlng, 17);

  geofenceLayerGroup.value = L.layerGroup().addTo(map.value);
  renderGeofences();

  tileLayer.on('tileload', () => { mapLoading.value = false; });
  tileLayer.on('tileerror', () => { mapLoading.value = false; });
  setTimeout(() => { mapLoading.value = false; }, 2000);
}

function clampRadius(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.max(25, Math.min(5000, Math.round(value)));
}

function applySelectedGeofenceToEditor() {
  const target = geofenceList.value.find((item: any) => Number(item.id) === Number(selectedGeofenceId.value));
  if (!target) {
    geofenceEditor.name = '';
    geofenceEditor.radius = 100;
    geofenceEditor.enabled = true;
    return;
  }
  geofenceEditor.name = String(target.name || '');
  geofenceEditor.radius = clampRadius(Number(target.radius));
  geofenceEditor.enabled = !!target.enabled;
}

async function createGeofenceAtCenter() {
  if (!map.value) return;
  const center = map.value.getCenter();
  const created = await geoStore.createGeofence({
    name: geofenceEditor.name.trim() || 'New Geofence',
    lat: Number(center.lat),
    lng: Number(center.lng),
    radius: clampRadius(Number(geofenceEditor.radius)),
    enabled: !!geofenceEditor.enabled
  });
  if (created?.id) {
    selectedGeofenceId.value = Number(created.id);
    applySelectedGeofenceToEditor();
  }
}

async function saveGeofenceEdits() {
  const targetId = Number(selectedGeofenceId.value);
  if (!Number.isFinite(targetId) || targetId <= 0) return;
  await geoStore.updateGeofence(targetId, {
    name: geofenceEditor.name.trim() || 'Geofence',
    radius: clampRadius(Number(geofenceEditor.radius)),
    enabled: !!geofenceEditor.enabled
  });
}

async function removeSelectedGeofence() {
  const targetId = Number(selectedGeofenceId.value);
  if (!Number.isFinite(targetId) || targetId <= 0) return;
  await geoStore.removeGeofence(targetId);
  selectedGeofenceId.value = 0;
  applySelectedGeofenceToEditor();
}

function renderGeofences() {
  if (!map.value || !L || !geofenceLayerGroup.value) return;
  geofenceLayerGroup.value.clearLayers();

  for (const geofence of geofenceList.value as any[]) {
    const id = Number(geofence.id);
    if (!Number.isFinite(id)) continue;
    const lat = Number(geofence.lat);
    const lng = Number(geofence.lng);
    const radius = clampRadius(Number(geofence.radius));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const selected = Number(selectedGeofenceId.value) === id;
    const color = geofence.enabled ? (selected ? '#f97316' : '#10b981') : '#64748b';
    const fillOpacity = geofence.enabled ? 0.14 : 0.08;

    const circle = L.circle([lat, lng], {
      color,
      fillColor: color,
      fillOpacity,
      weight: selected ? 2 : 1,
      dashArray: selected ? '2, 6' : '5, 5',
      radius
    });
    circle.on('click', () => {
      selectedGeofenceId.value = id;
      applySelectedGeofenceToEditor();
      renderGeofences();
    });

    const marker = L.marker([lat, lng], {
      draggable: true,
      icon: L.divIcon({
        className: '',
        html: `<div style="width:${selected ? 14 : 12}px;height:${selected ? 14 : 12}px;border-radius:9999px;background:${color};border:1px solid #0f172a;box-shadow:0 0 0 1px rgba(255,255,255,0.35);"></div>`,
        iconSize: [selected ? 14 : 12, selected ? 14 : 12],
        iconAnchor: [selected ? 7 : 6, selected ? 7 : 6]
      })
    });
    marker.on('click', () => {
      selectedGeofenceId.value = id;
      applySelectedGeofenceToEditor();
      renderGeofences();
    });
    marker.on('mousedown', () => {
      selectedGeofenceId.value = id;
      applySelectedGeofenceToEditor();
    });
    marker.on('dragend', async (event: any) => {
      const position = event?.target?.getLatLng?.();
      if (!position) return;
      await geoStore.updateGeofence(id, {
        lat: Number(position.lat),
        lng: Number(position.lng)
      });
    });
    geofenceLayerGroup.value.addLayer(circle);
    geofenceLayerGroup.value.addLayer(marker);
  }
}

function handleUIUpdate(lat: number, lng: number, head: number | null) {
  if (!L || !map.value) return;
  gpsHeading.value = head;
  lastFixAt.value = Date.now();
  const latlng = L.latLng(lat, lng);
  if (userMarker.value) userMarker.value.setLatLng(latlng);
  if (autoFollow.value) {
    const shouldPan =
      !lastPanLatLng ||
      distanceMeters(lastPanLatLng.lat, lastPanLatLng.lng, lat, lng) > 8;
    if (shouldPan) {
      map.value.panTo(latlng, { animate: true });
      lastPanLatLng = { lat, lng };
    }
  }
  updateHeadingCone();
}

async function resolveCurrentLatLng() {
  if (geoStore.currentPosition?.lat && geoStore.currentPosition?.lng) {
    return { lat: geoStore.currentPosition.lat, lng: geoStore.currentPosition.lng };
  }
  try {
    await Geolocation.requestPermissions();
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0
    });
    return {
      lat: Number(pos.coords.latitude),
      lng: Number(pos.coords.longitude)
    };
  } catch (_err) {
    if (import.meta.client && 'geolocation' in navigator) {
      const browserPos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0
        });
      });
      return {
        lat: Number(browserPos.coords.latitude),
        lng: Number(browserPos.coords.longitude)
      };
    }
  }
  return { lat: 14.5995, lng: 120.9842 };
}

async function recenterToCurrentLocation() {
  try {
    const pos = await resolveCurrentLatLng();
    if (!L || !map.value) return;
    const latlng = L.latLng(pos.lat, pos.lng);
    if (userMarker.value) {
      userMarker.value.setLatLng(latlng);
    } else {
      const icon = L.divIcon({ className: '', html: buildUserMarkerHTML(), iconSize: [120, 120], iconAnchor: [60, 60] });
      userMarker.value = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(map.value);
    }
    map.value.setView(latlng, 17, { animate: true });
    autoFollow.value = true;
    lastPanLatLng = { lat: pos.lat, lng: pos.lng };
    lastFixAt.value = Date.now();
    updateHeadingCone();
  } catch (err) {
    console.error('Failed to recenter map2 location:', err);
  }
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtRelative(ts: number): string {
  const delta = Math.max(0, Date.now() - ts);
  if (delta < 1000) return 'NOW';
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s AGO`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m AGO`;
  return `${Math.floor(delta / 3_600_000)}h AGO`;
}

function fitToSelectedRoute() {
  if (!map.value || !L) return;
  if (polyline.value) {
    map.value.fitBounds(polyline.value.getBounds(), { padding: [40, 40] });
    return;
  }
  if (userMarker.value) {
    const ll = userMarker.value.getLatLng();
    map.value.setView(ll, 17, { animate: true });
  }
}

async function startTracking() {
  await geoStore.startActiveRecording();
  await startActiveForegroundWatch();
}

async function stopTracking() {
  await stopActiveForegroundWatch();
  await geoStore.stopActiveRecording();
  historyRoutes.value = await db.routes.orderBy('timestamp').reverse().toArray();
}

async function startActiveForegroundWatch() {
  if (activeWatchId || browserActiveWatchId !== null) return;

  const onPoint = async (lat: number, lng: number, heading: number | null, speedMS: number) => {
    handleUIUpdate(lat, lng, heading);
    await geoStore.ingestActiveLocation(lat, lng, speedMS);
  };

  try {
    await Geolocation.requestPermissions();
    activeWatchId = await Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
        minimumUpdateInterval: 1000
      },
      async (position) => {
        const lat = Number(position?.coords?.latitude);
        const lng = Number(position?.coords?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const heading = Number(position?.coords?.heading);
        const speedMS = Number(position?.coords?.speed || 0);
        await onPoint(lat, lng, Number.isFinite(heading) ? heading : null, speedMS);
      }
    );
    return;
  } catch (err) {
    console.warn('map2 active watch (Capacitor) failed, fallback to browser geolocation.', err);
  }

  if (!import.meta.client || !('geolocation' in navigator)) return;
  browserActiveWatchId = navigator.geolocation.watchPosition(
    async (pos) => {
      const lat = Number(pos?.coords?.latitude);
      const lng = Number(pos?.coords?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const heading = Number(pos?.coords?.heading);
      const speedMS = Number(pos?.coords?.speed || 0);
      await onPoint(lat, lng, Number.isFinite(heading) ? heading : null, speedMS);
    },
    (error) => {
      console.warn('map2 active watch (browser) failed.', error);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

async function stopActiveForegroundWatch() {
  if (activeWatchId) {
    try {
      await Geolocation.clearWatch({ id: activeWatchId });
    } catch (err) {
      console.warn('Failed clearing Capacitor active watch in map2.', err);
    } finally {
      activeWatchId = null;
    }
  }

  if (browserActiveWatchId !== null && import.meta.client && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(browserActiveWatchId);
    browserActiveWatchId = null;
  }
}

async function deleteRoute(id: number) {
  if (!confirm('CONFIRM_DELETION?')) return;
  await db.routes.delete(id);
  // Points are deleted via CASCADE or manually if needed, 
  // but Dexie doesn't automatically CASCADE unless we set it up.
  // Actually, we should delete points manually in Dexie to trigger the deleting hook for sync.
  await db.points.where('routeId').equals(id).delete();
  
  historyRoutes.value = await db.routes.orderBy('timestamp').reverse().toArray();
  if (selectedRouteId.value == id.toString()) {
    selectedRouteId.value = '';
    if (polyline.value) polyline.value.remove();
  }
}

async function loadRoute() {
  if (!selectedRouteId.value || !L || !map.value) return;
  const points = await db.points.where('routeId').equals(Number(selectedRouteId.value)).sortBy('timestamp');
  if (!points.length) {
    if (polyline.value) {
      polyline.value.remove();
      polyline.value = null;
    }
    return;
  }
  const coords = points.map((p: any) => L.latLng(p.lat, p.lng));
  if (polyline.value) polyline.value.remove();
  polyline.value = L.polyline(coords, { color: '#a855f7', weight: 3 }).addTo(map.value);
  map.value.fitBounds(polyline.value.getBounds(), { padding: [40, 40] });
}

watch(
  () => currentPosition.value,
  (newPos) => {
    if (!newPos) return;
    handleUIUpdate(newPos.lat, newPos.lng, null);
  },
  { deep: true }
);

watch(
  () => geofenceList.value,
  (next) => {
    if (selectedGeofenceId.value > 0) {
      const exists = next.some((item: any) => Number(item.id) === Number(selectedGeofenceId.value));
      if (!exists) selectedGeofenceId.value = 0;
    }
    applySelectedGeofenceToEditor();
    renderGeofences();
  },
  { deep: true }
);

watch(
  () => selectedGeofenceId.value,
  () => {
    applySelectedGeofenceToEditor();
    renderGeofences();
  }
);

onMounted(async () => {
  if (containerRef.value) {
    dimensions.value.width = containerRef.value.offsetWidth;
    dimensions.value.height = containerRef.value.offsetHeight;
  }
  await geoStore.loadGeofences();
  historyRoutes.value = await db.routes.orderBy('timestamp').reverse().toArray();

  if (!import.meta.client) return;
  L = await import('leaflet');

  // Always try fetching current device location for initial map center.
  const startPos = await resolveCurrentLatLng();
  const latlng = L.latLng(startPos.lat, startPos.lng);

  await initMap(latlng);
  const icon = L.divIcon({ className: '', html: buildUserMarkerHTML(), iconSize: [120, 120], iconAnchor: [60, 60] });
  userMarker.value = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(map.value);
  map.value.setView(latlng, 17);
  lastPanLatLng = { lat: startPos.lat, lng: startPos.lng };
  lastFixAt.value = Date.now();

  removeOrientationListener = setupDeviceOrientationListener();

  const onResize = () => {
    if (map.value) {
      map.value.invalidateSize();
    }
  };
  window.addEventListener('resize', onResize);
  removeResizeListener = () => window.removeEventListener('resize', onResize);
});

onUnmounted(async () => {
  await stopActiveForegroundWatch();
  if (removeOrientationListener) {
    removeOrientationListener();
    removeOrientationListener = null;
  }
  if (removeResizeListener) {
    removeResizeListener();
    removeResizeListener = null;
  }
  if (map.value) {
    map.value.remove();
    map.value = null;
  }
});
</script>
