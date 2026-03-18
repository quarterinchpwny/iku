<template>
  <div class="flex h-screen w-full flex-col bg-black p-2">
    <!-- OTA Update Indicator -->
    <div
      v-if="otaStore.updateAvailable"
      class="mb-4 rounded-lg bg-blue-600 p-4 text-white shadow-lg"
    >
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-bold">Update Available!</h3>
          <p class="text-xs opacity-90">Version {{ otaStore.latestVersion?.version }} is ready.</p>
        </div>
        <button
          @click="otaStore.performUpdate()"
          :disabled="otaStore.isUpdating"
          class="rounded bg-white px-4 py-2 text-sm font-semibold text-blue-600 active:scale-95 disabled:opacity-50"
        >
          {{ otaStore.isUpdating ? 'Updating...' : 'Update Now' }}
        </button>
      </div>
    </div>

    <WeatherWidget />

    <!-- Tracking Timeline -->
    <div class="mt-4 flex-1 overflow-auto pb-8">
      <div class="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-sm">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400">
            Shield Timeline
          </h3>
        </div>

        <div
          v-if="passiveDayTimeline.length === 0"
          class="rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-6 text-center"
        >
          <p class="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
            No telemetry data recorded
          </p>
        </div>

        <div v-else class="space-y-6">
          <!-- Day Selector -->
          <div class="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
            <button
              v-for="day in passiveDayTimeline"
              :key="`dash-chip-${day.dayKey}`"
              @click="selectDashboardTimelineDay(day.dayKey)"
              :class="[
                'whitespace-nowrap rounded-full border px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-tighter transition-all',
                dashboardTimelineActiveDay?.dayKey === day.dayKey
                  ? 'border-blue-500 bg-blue-600 text-white'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-500'
              ]"
            >
              <span>{{ day.label }}</span>
              <span class="ml-2 opacity-50">{{ day.routeCount }}R</span>
            </button>
          </div>

          <!-- Day Stats -->
          <div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div class="mb-3 flex items-center justify-between">
              <span
                class="font-mono text-[10px] font-black uppercase tracking-widest text-blue-500"
              >
                {{ dashboardTimelineActiveDay?.label }} Summary
              </span>
              <span class="font-mono text-[10px] text-zinc-500">
                {{ dashboardTimelineStats.tripCount }} TRIPS
              </span>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div class="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                <div class="font-mono text-[8px] uppercase tracking-widest text-zinc-600">
                  Distance
                </div>
                <div class="font-mono text-sm font-bold text-white">
                  {{ dashboardTimelineStats.displacementLabel }}
                </div>
              </div>
              <div class="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                <div class="font-mono text-[8px] uppercase tracking-widest text-zinc-600">
                  Duration
                </div>
                <div class="font-mono text-sm font-bold text-white">
                  {{ dashboardTimelineStats.durationLabel }}
                </div>
              </div>
            </div>
          </div>

          <!-- Timeline Rows -->
          <div class="space-y-4">
            <div
              v-for="(row, idx) in dashboardTimelineRows"
              :key="`dash-seg-${row.id}`"
              class="relative pl-8"
            >
              <!-- Connection Line -->
              <div
                class="absolute left-3 top-0 h-full w-px bg-zinc-800"
                :class="idx === dashboardTimelineRows.length - 1 ? 'h-6' : 'h-full'"
              ></div>
              <!-- Dot -->
              <div
                class="absolute left-[9px] top-3 h-2 w-2 rounded-full border border-zinc-900 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
              ></div>

              <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div class="mb-3 flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span
                      class="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-tighter text-zinc-400"
                    >
                      {{ row.mode }}
                    </span>
                    <span class="font-mono text-[10px] text-zinc-500"
                      >Trip {{ row.timelineIndex }}</span
                    >
                  </div>
                  <div class="flex items-center gap-1 font-mono text-[9px] text-zinc-500">
                    <Icon name="ph:clock" size="12" />
                    <span>{{ row.rangeLabel }}</span>
                  </div>
                </div>

                <!-- Places -->
                <div class="mb-3 grid grid-cols-1 gap-2">
                  <div class="flex items-start gap-3">
                    <div class="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                    <div>
                      <div class="font-mono text-[10px] font-bold text-zinc-200">
                        {{ row.startPlace }}
                      </div>
                      <div class="text-[9px] leading-tight text-zinc-500">{{ row.startStory }}</div>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="mt-1 h-1.5 w-1.5 rounded-full bg-orange-500"></div>
                    <div>
                      <div class="font-mono text-[10px] font-bold text-zinc-200">
                        {{ row.endPlace }}
                      </div>
                      <div class="text-[9px] leading-tight text-zinc-500">{{ row.endStory }}</div>
                    </div>
                  </div>
                </div>

                <!-- Mini Map -->
                <div class="mt-3 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                  <div
                    :ref="(el) => setDashboardTimelineMapRef(el, row.id)"
                    class="h-24 w-full opacity-80 contrast-125"
                  ></div>
                </div>

                <!-- Metrics -->
                <div class="mt-3 flex flex-wrap gap-2">
                  <span class="font-mono text-[8px] uppercase tracking-widest text-zinc-600">
                    {{ row.pointCount }} POINTS
                  </span>
                  <span class="font-mono text-[8px] uppercase tracking-widest text-zinc-600">
                    {{ row.displacementMeters }}M DIST
                  </span>
                  <span class="font-mono text-[8px] uppercase tracking-widest text-zinc-600">
                    {{ row.durationLabel }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import WeatherWidget from '~/components/widgets/WeatherWidget.vue';
import { useOTAStore } from '~/stores/ota';
import { usePedometerStore } from '~/stores/pedometer';
import { useGeolocationStore } from '~/stores/geolocation';
import { useWaitForAuth } from '~/composables/useWaitForAuth';
import { db } from '@/db/index.js';
import { syncDownFromCloudflare } from '~/db';
import { syncPassiveFromPluginToDexie } from '~/composables/passive/syncPluginPassiveToDexie';
import * as TimelineUtils from '~/lib/timeline';
import {
  buildLocalPassiveTimelineData,
  utcDayKeyFromTimestamp
} from '@/composables/community/localPassiveRoutes';
import 'leaflet/dist/leaflet.css';

const otaStore = useOTAStore();
const pedometerStore = usePedometerStore();
const geoStore = useGeolocationStore();
const waitForAuth = useWaitForAuth();

// --- Timeline State ---
const trackingRoutes = ref<any[]>([]);
const trackingPoints = ref<any[]>([]);
const passiveLocations = ref<any[]>([]);
const dashboardTimelineDayKey = ref('');
const dashboardTimelineMapRefs = ref(new Map());
const dashboardTimelineMiniMaps = ref(new Map());
let mapLib: any = null;
let miniMapAlerted = false;

const normalizedPassiveLocations = computed(() => {
  return passiveLocations.value
    .map((row: any) => {
      const routeId = Number(row?.route_id ?? row?.routeId);
      const lat = Number(row?.lat);
      const lng = Number(row?.lng);
      const timestamp = Number(row?.timestamp || 0);
      return {
        ...row,
        route_id: routeId,
        lat,
        lng,
        timestamp
      };
    })
    .filter(
      (row: any) =>
        Number.isFinite(row.route_id) &&
        Number.isFinite(row.lat) &&
        Number.isFinite(row.lng) &&
        Number.isFinite(row.timestamp) &&
        row.timestamp > 0
    );
});

const timelinePoints = computed(() => {
  const activePoints = trackingPoints.value.filter(
    (p) => String(p?.source || '').toUpperCase() !== 'PASSIVE'
  );
  const passivePoints = normalizedPassiveLocations.value.map((row: any) => ({
    lat: Number(row.lat),
    lng: Number(row.lng),
    timestamp: Number(row.timestamp || 0),
    routeId: Number(row.route_id),
    source: 'PASSIVE'
  }));
  return [...activePoints, ...passivePoints];
});

const routeSummaries = computed(() => {
  return TimelineUtils.buildRouteSummaries(
    trackingRoutes.value,
    timelinePoints.value,
    normalizedPassiveLocations.value
  );
});

const passiveDayTimeline = computed(() => {
  return TimelineUtils.buildPassiveDayTimeline(routeSummaries.value);
});

const dashboardTimelineActiveDay = computed(() => {
  const days = passiveDayTimeline.value;
  if (!days.length) return null;
  return days.find((day) => day.dayKey === dashboardTimelineDayKey.value) || days[0];
});

const dashboardTimelineActiveSegments = computed(() => {
  const day = dashboardTimelineActiveDay.value;
  if (!day) return [];
  const ids = Array.isArray(day.routeIds) ? day.routeIds : [];
  if (!ids.length) return [];
  const points = ids
    .flatMap((rid) => timelinePoints.value.filter((p) => Number(p.routeId) === Number(rid)))
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  return TimelineUtils.buildDayTripSegments(points);
});

const dashboardTimelineRows = computed(() => {
  return dashboardTimelineActiveSegments.value.map((segment: any, index: number) => ({
    ...segment,
    timelineIndex: index + 1,
    startPlace: TimelineUtils.segmentStartPlace(segment.startStory),
    endPlace: TimelineUtils.segmentEndPlace(segment.endStory),
    mode: TimelineUtils.segmentTravelMode(segment),
    rangeLabel: `${segment.startTime} - ${segment.endTime}`
  }));
});

const dashboardTimelineStats = computed(() => {
  const segments = dashboardTimelineActiveSegments.value;
  const displacementMeters = segments.reduce(
    (acc: number, seg: any) => acc + Number(seg.displacementMeters || 0),
    0
  );
  const durationMs = segments.reduce(
    (acc: number, seg: any) => acc + Number(seg.durationMs || 0),
    0
  );
  return {
    tripCount: segments.length,
    displacementLabel: `${Math.round(displacementMeters)}m`,
    durationLabel: TimelineUtils.formatDurationLabel(durationMs)
  };
});

async function fetchTimelineData() {
  try {
    const [routes, points, passive] = await Promise.all([
      db.routes.toArray(),
      db.points.toArray(),
      db.passive_locations.toArray()
    ]);
    const passiveDayKeys = new Set<string>();
    for (const row of passive) {
      const ts = Number(row?.timestamp || 0);
      if (!Number.isFinite(ts) || ts <= 0) continue;
      passiveDayKeys.add(utcDayKeyFromTimestamp(ts));
    }
    for (const route of routes) {
      if (String(route?.source || '').toUpperCase() !== 'PASSIVE') continue;
      const ts = Number(route?.timestamp || 0);
      if (!Number.isFinite(ts) || ts <= 0) continue;
      passiveDayKeys.add(utcDayKeyFromTimestamp(ts));
    }
    const localTimeline = await buildLocalPassiveTimelineData(passiveDayKeys);
    trackingRoutes.value = [...routes, ...localTimeline.routes];
    trackingPoints.value = [...points, ...localTimeline.points];
    passiveLocations.value = [...passive, ...localTimeline.passiveLocations];
  } catch (err) {
    console.error('Failed to fetch timeline data:', err);
  }
}

function selectDashboardTimelineDay(dayKey: string) {
  dashboardTimelineDayKey.value = dayKey;
}

async function loadLeaflet() {
  if (mapLib) return mapLib;
  try {
    const mod = await import('leaflet');
    mapLib = mod?.default || mod;
    return mapLib;
  } catch (err: any) {
    const message = err?.message ? String(err.message) : String(err || 'Unknown error');
    alert(`Leaflet load failed: ${message}`);
    throw err;
  }
}

function setDashboardTimelineMapRef(el, id) {
  if (el) {
    dashboardTimelineMapRefs.value.set(id, el);
  }
}

async function renderDashboardTimelineMiniMaps() {
  let L;
  try {
    L = await loadLeaflet();
  } catch {
    return;
  }

  await nextTick();
  await new Promise((r) => setTimeout(r, 100));

  const ids = new Set(dashboardTimelineRows.value.map((row) => row.id));
  for (const [id, mini] of dashboardTimelineMiniMaps.value.entries()) {
    if (!ids.has(id)) {
      mini.remove();
      dashboardTimelineMiniMaps.value.delete(id);
    }
  }

  for (const row of dashboardTimelineRows.value) {
    const container = dashboardTimelineMapRefs.value.get(row.id);
    if (!container) continue;

    // Force explicit pixel size so Leaflet can measure it
    container.style.height = '96px';
    container.style.width = '100%';
    container.style.display = 'block';

    await new Promise((r) => setTimeout(r, 10));

    if (container.offsetWidth === 0 || container.offsetHeight === 0) continue;

    if (dashboardTimelineMiniMaps.value.has(row.id)) {
      dashboardTimelineMiniMaps.value.get(row.id).remove();
      dashboardTimelineMiniMaps.value.delete(row.id);
    }

    const mini = L.map(container, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false
    });

    // Use light tiles + CSS invert for reliable dark look
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(mini);

    const coords = (Array.isArray(row.points) ? row.points : [])
      .map((p) => [Number(p.lat), Number(p.lng)])
      .filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]));

    if (coords.length >= 2) {
      L.polyline(coords, { color: '#38bdf8', weight: 3, opacity: 1 }).addTo(mini);
      L.circleMarker(coords[0], {
        radius: 4,
        color: '#ffffff',
        fillColor: '#10b981',
        fillOpacity: 1,
        weight: 1.5
      }).addTo(mini);
      L.circleMarker(coords[coords.length - 1], {
        radius: 4,
        color: '#ffffff',
        fillColor: '#f59e0b',
        fillOpacity: 1,
        weight: 1.5
      }).addTo(mini);
    } else {
      mini.setView([14.5995, 120.9842], 12);
    }

    // Invalidate then fit after a frame
    setTimeout(() => {
      mini.invalidateSize();
      if (coords.length >= 2) {
        mini.fitBounds(L.latLngBounds(coords), { padding: [12, 12] });
      }
    }, 50);

    dashboardTimelineMiniMaps.value.set(row.id, mini);
  }
}
watch(
  dashboardTimelineRows,
  async () => {
    await nextTick();
    await new Promise((r) => setTimeout(r, 50));
    await renderDashboardTimelineMiniMaps();
  },
  { flush: 'post' }
);
watch(
  passiveDayTimeline,
  (days) => {
    if (days.length && !dashboardTimelineDayKey.value) {
      dashboardTimelineDayKey.value = days[0].dayKey;
    }
  },
  { immediate: true }
);

watch(
  dashboardTimelineRows,
  async () => {
    await nextTick();
    await renderDashboardTimelineMiniMaps();
  },
  { flush: 'post' }
);

onMounted(async () => {
  try {
    await waitForAuth();
    await syncPassiveFromPluginToDexie();
    await syncDownFromCloudflare({ includeGeofences: false, scope: 'account' });
    await fetchTimelineData();
    await pedometerStore.checkSupport();
    if (pedometerStore.isSupported) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaySteps = await pedometerStore.querySteps(today, new Date());
      pedometerStore.steps = todaySteps;
    }
  } catch (err) {
    console.error('Initialization failed:', err);
  }
});

onUnmounted(() => {
  for (const map of dashboardTimelineMiniMaps.value.values()) {
    map.remove();
  }
});
</script>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.timeline-map-container {
  mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
}

/* Custom Leaflet Dark Mode Overrides */
:deep(.leaflet-container) {
  background: #09090b !important;
}
:deep(.leaflet-tile) {
  filter: brightness(0.6) contrast(1.2) saturate(0.5) invert(1) hue-rotate(180deg) !important;
}
:deep(.leaflet-container) {
  background: #1a1f2e !important;
}

/* Dark mode: invert light tiles, re-invert hue so colors stay correct */
:deep(.leaflet-tile-pane) {
  filter: invert(1) hue-rotate(180deg) brightness(0.85) contrast(1.1);
}

/* Re-invert the route overlay so cyan stays cyan, not orange */
:deep(.leaflet-overlay-pane) {
  filter: invert(1) hue-rotate(180deg);
}
</style>
