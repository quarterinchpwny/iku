<template>
  <div class="min-h-screen bg-[var(--bg-main)] p-4 pt-12 font-mono text-[var(--text-main)]">
    <!-- Header -->
    <div class="mb-8 border-l-4 border-[var(--accent)] pl-4">
      <h1 class="text-xl font-black uppercase tracking-tighter">> VISITED_ROUTES.DB</h1>
      <p class="text-xs opacity-50">Local intelligence extraction...</p>
    </div>

    <!-- Stats Row -->
    <div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
      <div class="border border-white/10 bg-white/5 p-3">
        <span class="block text-[10px] uppercase opacity-50">Total Logs</span>
        <span class="text-lg font-bold text-[var(--accent)]">{{ history.length }}</span>
      </div>
      <div class="border border-white/10 bg-white/5 p-3">
        <span class="block text-[10px] uppercase opacity-50">Active</span>
        <span class="text-lg font-bold text-cyan-300">{{ activeCount }}</span>
      </div>
      <div class="border border-white/10 bg-white/5 p-3">
        <span class="block text-[10px] uppercase opacity-50">Passive</span>
        <span class="text-lg font-bold text-amber-300">{{ passiveCount }}</span>
      </div>
      <div class="border border-white/10 bg-white/5 p-3">
        <span class="block text-[10px] uppercase opacity-50">Last Update</span>
        <span class="text-[10px] font-bold">{{ lastSync }}</span>
      </div>
    </div>

    <div class="mb-6 rounded-xl border border-white/10 bg-white/[0.04] p-4" v-if="dayTimeline.length">
      <div class="mb-3 flex items-center justify-between">
        <div class="text-[11px] font-bold uppercase tracking-wider opacity-80">Day Timeline</div>
        <div class="rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-[9px] uppercase tracking-wider opacity-70">Passive Story</div>
      </div>
      <div class="space-y-3">
        <button
          v-for="day in dayTimeline"
          :key="day.dayKey"
          @click="openDayTimelineModal(day.dayKey, day.label)"
          class="group w-full rounded-lg border border-white/10 bg-black/25 p-3 text-left text-[10px] transition-colors hover:border-[var(--accent)]/45 hover:bg-black/35"
        >
          <div class="mb-2 flex items-center justify-between">
            <span class="font-bold text-[var(--accent)]">{{ day.label }}</span>
            <span class="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[9px] opacity-80">
              {{ day.routeCount }} ROUTES • {{ day.totalDurationLabel }}
            </span>
          </div>
          <div class="relative pl-5">
            <div class="absolute left-[5px] top-1 bottom-1 w-px bg-white/15"></div>
            <div
              v-for="(evt, idx) in day.events"
              :key="`${day.dayKey}-evt-${idx}`"
              class="relative mb-1.5 last:mb-0"
            >
              <span class="absolute -left-5 top-1 h-2.5 w-2.5 rounded-full border border-white/70 bg-[var(--accent)]"></span>
              <p class="text-[10px] opacity-85">{{ evt }}</p>
            </div>
          </div>
          <p class="mt-2 text-[9px] opacity-65">{{ day.narrative }}</p>
        </button>
      </div>
    </div>

    <!-- Search/Filter -->
    <div class="relative mb-6">
      <input
        v-model="search"
        type="text"
        placeholder="SEARCH_LOGS..."
        class="w-full border border-white/10 bg-black/40 px-4 py-2 text-xs outline-none focus:border-[var(--accent)]"
      />
      <div class="absolute right-3 top-2 text-[var(--accent)]">
        <i class="ph ph-magnifying-glass"></i>
      </div>
    </div>

    <!-- Routes List -->
    <div class="space-y-4">
      <div
        v-for="route in filteredHistory"
        :key="route.id"
        @click="openRouteModal(route.id)"
        class="hover:border-[var(--accent)]/30 group relative isolate cursor-pointer overflow-hidden border border-white/5 bg-white/[0.02] p-4 transition-all hover:bg-white/[0.05]"
      >
        <div class="flex gap-4">
          <!-- Mini Map Thumbnail -->
          <div
            class="relative z-0 h-24 w-24 flex-shrink-0 overflow-hidden rounded border border-white/10 bg-[#1a1a1a]"
          >
            <div :ref="(el) => setMapRef(el, route.id)" class="h-full w-full"></div>
            <!-- Route badge -->
            <div
              class="absolute left-1 top-1 z-10 rounded-full bg-black/80 px-2 py-0.5 text-[8px] font-bold text-white"
            >
              #{{ route.id }}
            </div>
          </div>

          <!-- Route Info -->
          <div class="flex flex-1 flex-col justify-between">
            <div>
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="text-sm font-bold uppercase tracking-wide">
                    {{ new Date(route.timestamp).toLocaleDateString() }}
                  </h3>
                  <p class="text-[10px] opacity-40">
                    {{ new Date(route.timestamp).toLocaleTimeString() }}
                  </p>
                </div>
                <div
                  class="rounded border px-2 py-1 text-[9px] font-bold uppercase tracking-wider"
                  :class="route.classification === 'PASSIVE'
                    ? 'border-amber-400/40 text-amber-300'
                    : 'border-cyan-400/40 text-cyan-300'"
                >
                  {{ route.classification }}
                </div>
                <div class="flex gap-2 text-right">
                  <button
                    @click.stop="viewRoute(route.id)"
                    class="border-[var(--accent)]/20 border px-3 py-1 text-[10px] uppercase transition-colors hover:bg-[var(--accent)] hover:text-black"
                  >
                    View Map
                  </button>
                  <button
                    @click.stop="deleteRoute(route.id)"
                    class="border-red-500/20 border px-3 py-1 text-[10px] uppercase transition-colors hover:bg-red-500/20 text-red-400"
                  >
                    <i class="ph ph-trash"></i>
                  </button>
                </div>
              </div>
            </div>

            <div class="flex gap-4 text-[10px] opacity-60">
              <div class="flex items-center gap-1">
                <i class="ph ph-note-pencil"></i>
                <span>{{ route.story || `${route.pointCount || 0} NODES` }}</span>
              </div>
              <div class="flex items-center gap-1">
                <i class="ph ph-clock"></i>
                <span>{{ route.durationLabel || 'LOGGED' }}</span>
              </div>
            </div>
            <div
              v-if="route.classification === 'ACTIVE' && route.activeMetrics"
              class="mt-2 flex flex-wrap gap-2 text-[9px] uppercase tracking-wide"
            >
              <span class="border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-cyan-200">
                AVG {{ route.activeMetrics.avgSpeedKmh }} km/h
              </span>
              <span class="border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-200">
                MAX {{ route.activeMetrics.maxSpeedKmh }} km/h
              </span>
              <span class="border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-amber-200">
                DIR {{ route.activeMetrics.direction }}
              </span>
              <span class="border border-violet-400/30 bg-violet-400/10 px-2 py-1 text-violet-200">
                TREND {{ route.activeMetrics.speedTrend }}
              </span>
            </div>
          </div>
        </div>

        <!-- Decorative corner -->
        <div class="absolute -right-4 -top-4 h-8 w-8 rotate-45 border-b border-white/10"></div>
      </div>

      <div v-if="history.length === 0" class="py-12 text-center">
        <p class="text-xs italic opacity-30">NO_LOGS_FOUND.INIT_TRACKING_FIRST</p>
      </div>
    </div>

    <!-- Route Modal -->
    <div
      v-if="selectedRouteId !== null"
      @click="closeRouteModal"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4"
    >
      <div
        @click.stop
        class="border-[var(--accent)]/30 relative h-[90vh] w-full max-w-4xl overflow-hidden border bg-[var(--bg-main)]"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b border-white/10 bg-black/40 p-4">
          <div>
            <h2 class="text-sm font-bold uppercase tracking-wider text-[var(--accent)]">
              Route #{{ selectedRouteId }}
            </h2>
            <p class="text-[10px] opacity-50">{{ selectedRouteDate }}</p>
          </div>
          <button
            @click="closeRouteModal"
            class="flex h-8 w-8 items-center justify-center border border-white/10 text-white/50 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <i class="ph ph-x text-lg"></i>
          </button>
        </div>

        <!-- Modal Map -->
        <div class="relative h-[calc(100%-60px)]">
          <div ref="modalMapContainer" class="h-full w-full"></div>
        </div>
      </div>
    </div>

    <div
      v-if="selectedDayKey !== null"
      @click="closeDayTimelineModal"
      class="fixed inset-0 z-[12000] flex items-center justify-center bg-black/90 p-4"
    >
      <div
        @click.stop
        class="border-[var(--accent)]/30 relative h-[90vh] w-full max-w-5xl overflow-hidden border bg-[var(--bg-main)]"
      >
        <div class="flex items-center justify-between border-b border-white/10 bg-black/40 p-4">
          <div>
            <h2 class="text-sm font-bold uppercase tracking-wider text-[var(--accent)]">
              Day Timeline {{ selectedDayLabel || '' }}
            </h2>
            <p class="text-[10px] opacity-50">
              {{ dayTimelineRouteStats.totalRoutes }} routes • {{ dayTimelineRouteStats.totalPoints }} points •
              {{ dayTimelineRouteStats.segmentCount }} trips
            </p>
          </div>
          <button
            @click="closeDayTimelineModal"
            class="flex h-8 w-8 items-center justify-center border border-white/10 text-white/50 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <i class="ph ph-x text-lg"></i>
          </button>
        </div>
        <div class="h-[calc(100%-60px)] overflow-y-auto p-4">
          <div v-if="selectedDaySegments.length === 0" class="rounded border border-white/10 bg-black/20 p-4 text-xs opacity-70">
            No timeline segments detected for this day.
          </div>
          <div v-else class="space-y-5">
            <div
              v-for="(segment, idx) in selectedDaySegments"
              :key="segment.id"
              class="rounded border border-white/10 bg-black/20 p-3"
            >
              <div class="mb-2 flex items-center justify-between text-[9px] uppercase tracking-wider opacity-70">
                <span>Trip {{ idx + 1 }}</span>
                <span>{{ segment.startTime }} -> {{ segment.endTime }}</span>
              </div>
              <div class="relative pl-4">
                <div class="absolute bottom-2 left-[5px] top-2 w-px bg-white/20"></div>
                <div class="relative mb-2 rounded border border-emerald-400/25 bg-emerald-500/10 p-2">
                  <span class="absolute -left-[13px] top-3 h-2.5 w-2.5 rounded-full border border-white/70 bg-emerald-300"></span>
                  <p class="text-[10px] font-semibold text-emerald-100">{{ segment.startStory }}</p>
                  <p class="mt-1 text-[9px] opacity-60">{{ segment.startTime }}</p>
                </div>
                <div class="mb-2 rounded border border-sky-400/25 bg-sky-500/10 p-2">
                  <div :ref="(el) => setDaySegmentMapRef(el, segment.id)" class="h-32 w-full rounded border border-white/10"></div>
                </div>
                <div class="relative rounded border border-amber-400/25 bg-amber-500/10 p-2">
                  <span class="absolute -left-[13px] top-3 h-2.5 w-2.5 rounded-full border border-white/70 bg-amber-300"></span>
                  <p class="text-[10px] font-semibold text-amber-100">{{ segment.endStory }}</p>
                  <p class="mt-1 text-[9px] opacity-60">{{ segment.endTime }}</p>
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
import { ref, onMounted, computed, nextTick } from 'vue';
import { db } from '@/db/index.js';
import { syncDownFromCloudflare } from '~/db';
import { useRouter } from 'vue-router';
import L from 'leaflet';

const router = useRouter();
const history = ref([]);
const search = ref('');
const lastSync = ref('--:--');
const miniMaps = ref<Map<number, any>>(new Map());
const mapRefs = ref<Map<number, HTMLElement>>(new Map());

// Modal state
const selectedRouteId = ref<number | null>(null);
const selectedRouteDate = ref('');
const modalMapContainer = ref<HTMLElement | null>(null);
const modalMap = ref<any>(null);
const modalPolyline = ref<any>(null);
const selectedDayKey = ref<string | null>(null);
const selectedDayLabel = ref('');
const dayTimelineRouteStats = ref({ totalRoutes: 0, totalPoints: 0, segmentCount: 0 });
const selectedDaySegments = ref<any[]>([]);
const daySegmentMapRefs = ref<Map<string, HTMLElement>>(new Map());
const daySegmentMiniMaps = ref<Map<string, any>>(new Map());

const passiveCount = computed(
  () => history.value.filter((r) => r.classification === 'PASSIVE').length
);
const activeCount = computed(
  () => history.value.filter((r) => r.classification === 'ACTIVE').length
);

const filteredHistory = computed(() => {
  if (!search.value) return history.value;
  const s = search.value.toLowerCase();
  return history.value.filter(
    (r) =>
      new Date(r.timestamp).toLocaleString().toLowerCase().includes(s) ||
      r.id.toString().includes(s) ||
      String(r.classification || '').toLowerCase().includes(s) ||
      String(r.story || '').toLowerCase().includes(s)
  );
});

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function formatDuration(ms: number): string {
  const safe = Math.max(0, Number(ms || 0));
  const totalMinutes = Math.floor(safe / 60_000);
  if (totalMinutes < 1) return '<1m';
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

function bearingDegrees(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

function toCompass(deg: number): string {
  if (!Number.isFinite(deg)) return 'N/A';
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return labels[idx];
}

function labelPlace(
  center: { lat: number; lng: number },
  knownHome: { lat: number; lng: number } | null,
  knownOffice: { lat: number; lng: number } | null,
  fallbackIndex: number
): string {
  if (knownHome && distanceMeters(center, knownHome) <= 220) return 'Home';
  if (knownOffice && distanceMeters(center, knownOffice) <= 220) return 'Office';
  return `Location ${fallbackIndex}`;
}

function buildPassiveStory(rawPoints: any[]): { story: string; durationLabel: string; durationMs: number } {
  const points = [...rawPoints]
    .map((p: any) => ({
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      timestamp: Number(p?.timestamp || 0)
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!points.length) return { story: 'No route points', durationLabel: 'LOGGED', durationMs: 0 };
  if (points.length === 1) return { story: 'Single passive check-in', durationLabel: 'LOGGED', durationMs: 0 };

  const totalDurationMs = points[points.length - 1].timestamp - points[0].timestamp;
  const stays: Array<{ center: { lat: number; lng: number }; start: number; end: number; durationMs: number }> = [];

  const STOP_RADIUS_M = 120;
  const STOP_MIN_DURATION_MS = 20 * 60 * 1000;
  let groupStart = 0;
  let sumLat = points[0].lat;
  let sumLng = points[0].lng;
  let groupCount = 1;

  for (let i = 1; i < points.length; i++) {
    const candidateCenter = { lat: sumLat / groupCount, lng: sumLng / groupCount };
    const far = distanceMeters(candidateCenter, points[i]) > STOP_RADIUS_M;
    if (!far) {
      sumLat += points[i].lat;
      sumLng += points[i].lng;
      groupCount += 1;
      continue;
    }
    const startTs = points[groupStart].timestamp;
    const endTs = points[i - 1].timestamp;
    const durationMs = endTs - startTs;
    if (durationMs >= STOP_MIN_DURATION_MS) {
      stays.push({
        center: { lat: sumLat / groupCount, lng: sumLng / groupCount },
        start: startTs,
        end: endTs,
        durationMs
      });
    }
    groupStart = i;
    sumLat = points[i].lat;
    sumLng = points[i].lng;
    groupCount = 1;
  }

  const lastStartTs = points[groupStart].timestamp;
  const lastEndTs = points[points.length - 1].timestamp;
  const lastDurationMs = lastEndTs - lastStartTs;
  if (lastDurationMs >= STOP_MIN_DURATION_MS) {
    stays.push({
      center: { lat: sumLat / groupCount, lng: sumLng / groupCount },
      start: lastStartTs,
      end: lastEndTs,
      durationMs: lastDurationMs
    });
  }

  // Home: first stay if available, otherwise first point.
  const homeCenter = stays[0]?.center || { lat: points[0].lat, lng: points[0].lng };
  // Office: longest stay away from home.
  const officeCandidate = [...stays]
    .filter((s) => distanceMeters(s.center, homeCenter) > 220)
    .sort((a, b) => b.durationMs - a.durationMs)[0];
  const officeCenter = officeCandidate?.center || null;

  const fragments: string[] = [];
  let placeIndex = 1;

  if (stays.length) {
    const firstStay = stays[0];
    const firstLabel = labelPlace(firstStay.center, homeCenter, officeCenter, placeIndex++);
    fragments.push(`At ${firstLabel} for ${formatDuration(firstStay.durationMs)}`);
  }

  for (let i = 0; i < stays.length - 1; i++) {
    const from = stays[i];
    const to = stays[i + 1];
    const travelMs = Math.max(0, to.start - from.end);
    if (travelMs > 0) {
      const toLabel = labelPlace(to.center, homeCenter, officeCenter, placeIndex++);
      fragments.push(`Went to ${toLabel} in ${formatDuration(travelMs)}`);
      fragments.push(`Stayed ${formatDuration(to.durationMs)}`);
    }
  }

  if (!fragments.length) {
    const dist = distanceMeters(points[0], points[points.length - 1]);
    if (dist < 200) {
      fragments.push(`Stayed nearby for ${formatDuration(totalDurationMs)}`);
    } else {
      fragments.push(`Moved for ${formatDuration(totalDurationMs)}`);
    }
  }

  return {
    story: fragments.slice(0, 4).join(' • '),
    durationLabel: formatDuration(totalDurationMs),
    durationMs: totalDurationMs
  };
}

function buildActiveStory(points: any[]): {
  story: string;
  durationLabel: string;
  durationMs: number;
  activeMetrics?: {
    avgSpeedKmh: string;
    maxSpeedKmh: string;
    direction: string;
    speedTrend: string;
  };
} {
  const normalized = [...points]
    .map((p: any) => ({
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      timestamp: Number(p?.timestamp || 0)
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!normalized.length) return { story: 'No route points', durationLabel: 'LOGGED', durationMs: 0 };
  if (normalized.length === 1) return { story: 'Active route with 1 point', durationLabel: 'LOGGED', durationMs: 0 };

  const speeds: number[] = [];
  const bearings: number[] = [];
  for (let i = 1; i < normalized.length; i++) {
    const prev = normalized[i - 1];
    const cur = normalized[i];
    const dtSec = Math.max(1, (cur.timestamp - prev.timestamp) / 1000);
    const distM = distanceMeters(prev, cur);
    if (distM < 2) continue;
    speeds.push((distM / dtSec) * 3.6);
    bearings.push(bearingDegrees(prev, cur));
  }

  const totalMs = Math.max(0, normalized[normalized.length - 1].timestamp - normalized[0].timestamp);
  if (!speeds.length) {
    return {
      story: `Active route with low movement (${normalized.length} points)`,
      durationLabel: formatDuration(totalMs),
      durationMs: totalMs
    };
  }

  const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const min = Math.min(...speeds);
  const max = Math.max(...speeds);
  const window = Math.max(1, Math.floor(speeds.length / 3));
  const startAvg =
    speeds.slice(0, window).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(window, speeds.length));
  const endSlice = speeds.slice(Math.max(0, speeds.length - window));
  const endAvg = endSlice.reduce((a, b) => a + b, 0) / Math.max(1, endSlice.length);
  const speedTrend = endAvg > startAvg + 1 ? 'sped up' : endAvg < startAvg - 1 ? 'slowed down' : 'kept steady';

  const firstBearing = bearings[0];
  const lastBearing = bearings[bearings.length - 1];
  const overallBearing = bearingDegrees(normalized[0], normalized[normalized.length - 1]);
  const directionText = `${toCompass(firstBearing)}→${toCompass(lastBearing)} (overall ${toCompass(overallBearing)})`;

  return {
    story:
      `Speed ${speedTrend}: ${startAvg.toFixed(1)}→${endAvg.toFixed(1)} km/h ` +
      `(avg ${avg.toFixed(1)}, min ${min.toFixed(1)}, max ${max.toFixed(1)}) • Direction ${directionText}`,
    durationLabel: formatDuration(totalMs),
    durationMs: totalMs,
    activeMetrics: {
      avgSpeedKmh: avg.toFixed(1),
      maxSpeedKmh: max.toFixed(1),
      direction: toCompass(overallBearing),
      speedTrend
    }
  };
}

function buildRouteStory(
  classification: string,
  points: any[]
): {
  story: string;
  durationLabel: string;
  durationMs: number;
  activeMetrics?: {
    avgSpeedKmh: string;
    maxSpeedKmh: string;
    direction: string;
    speedTrend: string;
  };
} {
  if (!Array.isArray(points) || points.length === 0) {
    return { story: 'No route points', durationLabel: 'LOGGED', durationMs: 0 };
  }
  const sorted = [...points]
    .map((p: any) => ({ timestamp: Number(p?.timestamp || 0) }))
    .filter((p) => Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  const totalMs =
    sorted.length > 1
      ? Math.max(0, sorted[sorted.length - 1].timestamp - sorted[0].timestamp)
      : 0;
  if (classification === 'PASSIVE') {
    return buildPassiveStory(points);
  }
  if (classification === 'ACTIVE') return buildActiveStory(points);
  return { story: `Route with ${points.length} points`, durationLabel: sorted.length > 1 ? formatDuration(totalMs) : 'LOGGED', durationMs: totalMs };
}

const dayTimeline = computed(() => {
  const byDay = new Map<string, any[]>();
  for (const r of history.value) {
    if (String(r?.classification || '') !== 'PASSIVE') continue;
    const ts = Number(r?.timestamp || 0);
    if (!Number.isFinite(ts) || ts <= 0) continue;
    const d = new Date(ts);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!byDay.has(dayKey)) byDay.set(dayKey, []);
    byDay.get(dayKey)!.push(r);
  }

  const items = [...byDay.entries()].map(([dayKey, routes]) => {
    const sorted = [...routes].sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
    const totalDurationMs = sorted.reduce((acc, r) => acc + Number(r.durationMs || 0), 0);
    const labelDate = new Date(`${dayKey}T00:00:00`);
    const narrative = sorted
      .slice(0, 4)
      .map((r) => {
        const t = new Date(Number(r.timestamp || 0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${t} ${String(r.story || `${r.pointCount || 0} points`)}`;
      })
      .join(' → ');
    return {
      dayKey,
      label: labelDate.toLocaleDateString(),
      routeCount: sorted.length,
      totalDurationLabel: formatDuration(totalDurationMs),
      narrative: narrative || 'No timeline story',
      events: narrative
        ? narrative.split(' → ').map((s) => s.trim()).filter(Boolean).slice(0, 4)
        : [`${sorted.length} routes tracked`, `duration ${formatDuration(totalDurationMs)}`]
    };
  });

  return items.sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1)).slice(0, 5);
});

function setMapRef(el: HTMLElement | null, routeId: number) {
  if (el) {
    mapRefs.value.set(routeId, el);
  }
}

async function createMiniMap(routeId: number, points: any[]) {
  await nextTick();

  const container = mapRefs.value.get(routeId);
  if (!container || points.length === 0) return;

  // Clean up existing map if any
  if (miniMaps.value.has(routeId)) {
    miniMaps.value.get(routeId).remove();
  }

  try {
    // Create mini map
    const miniMap = L.map(container, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
      interactive: false
    });

    // Add dark tile layer
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(miniMap);

    // Create path from points
    const latlngs = points.map((p) => [p.lat, p.lng]);

    // Add route line
    L.polyline(latlngs, {
      color: points[0]?.color || '#00ff41',
      weight: 3,
      opacity: 0.9
    }).addTo(miniMap);

    // Add start marker (green)
    if (latlngs.length > 0) {
      L.circleMarker(latlngs[0], {
        radius: 4,
        fillColor: '#22c55e',
        color: '#fff',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 1
      }).addTo(miniMap);
    }

    // Add end marker (red)
    if (latlngs.length > 1) {
      L.circleMarker(latlngs[latlngs.length - 1], {
        radius: 4,
        fillColor: '#ef4444',
        color: '#fff',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 1
      }).addTo(miniMap);
    }

    // Fit bounds to show entire route
    const bounds = L.latLngBounds(latlngs);
    miniMap.fitBounds(bounds, { padding: [10, 10] });

    miniMaps.value.set(routeId, miniMap);
  } catch (err) {
    console.error(`Failed to create mini map for route ${routeId}:`, err);
  }
}

async function loadHistory() {
  try {
    const routes = await db.routes.orderBy('timestamp').reverse().toArray();
    const passiveRows = await db.passive_locations.toArray();
    const passiveRouteIds = new Set<number>(
      passiveRows
        .map((pl: any) => Number(pl.route_id))
        .filter((id) => Number.isFinite(id) && id > 0)
    );

    // Enrich route rows without letting a single malformed row fail the whole list.
    const enriched = [];
    for (const r of routes) {
      const routeId = Number(r?.id);
      const safeRouteId = Number.isFinite(routeId) ? routeId : null;
      let count = 0;
      let routePoints: any[] = [];
      if (safeRouteId !== null) {
        try {
          routePoints = await db.points.where('routeId').equals(safeRouteId).sortBy('timestamp');
          count = routePoints.length;
        } catch (err) {
          console.warn(`Failed to count points for route ${safeRouteId}:`, err);
        }
      }
      const routeSource = String((r as any)?.source || '').toUpperCase();
      const hasPassivePointSource = routePoints.some(
        (p: any) => String(p?.source || '').toUpperCase() === 'PASSIVE'
      );
      const classification =
        routeSource === 'PASSIVE' ||
        (safeRouteId !== null && passiveRouteIds.has(safeRouteId)) ||
        hasPassivePointSource
          ? 'PASSIVE'
          : 'ACTIVE';
      const narrative = buildRouteStory(classification, routePoints);
      enriched.push({
        ...r,
        pointCount: count,
        classification,
        story: narrative.story,
        durationLabel: narrative.durationLabel,
        durationMs: narrative.durationMs,
        activeMetrics: narrative.activeMetrics
      });
    }

    history.value = enriched;
    lastSync.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Create mini maps after DOM updates
    await nextTick();

    for (const route of enriched) {
      const points = await db.points.where('routeId').equals(route.id).toArray();
      if (points.length > 0) {
        await createMiniMap(route.id, points);
      }
    }
  } catch (err) {
    console.error('Failed to load intelligence:', err);
  }
}

function viewRoute(id: number) {
  // Navigate to map and potentially auto-load this route
  router.push(`/map?routeId=${id}`);
}

async function deleteRoute(id: number) {
  if (!confirm('CONFIRM_DELETION?')) return;

  try {
    // Clean up mini map instance
    if (miniMaps.value.has(id)) {
      miniMaps.value.get(id).remove();
      miniMaps.value.delete(id);
    }

    // Delete from Dexie (this triggers the 'deleting' hook for Cloudflare sync)
    await db.routes.delete(id);
    // Explicitly delete points (Backend handles cascading but we need to trigger hooks or just clean up local)
    await db.points.where('routeId').equals(id).delete();

    // Refresh history
    await loadHistory();
  } catch (err) {
    console.error('Failed to delete route:', err);
  }
}

async function openRouteModal(routeId: number) {
  selectedRouteId.value = routeId;

  // Get route details
  const route = history.value.find((r) => r.id === routeId);
  if (route) {
    selectedRouteDate.value = new Date(route.timestamp).toLocaleString();
  }

  // Wait for modal DOM to render
  await nextTick();

  // Add extra delay to ensure container is fully visible
  setTimeout(async () => {
    // Load route points and initialize map
    const points = await db.points.where('routeId').equals(routeId).toArray();
    if (points.length > 0) {
      initModalMap(points, route?.color || '#00ff41');
    }
  }, 100);
}

function closeRouteModal() {
  // Clean up map
  if (modalMap.value) {
    modalMap.value.remove();
    modalMap.value = null;
  }
  if (modalPolyline.value) {
    modalPolyline.value = null;
  }

  selectedRouteId.value = null;
  selectedRouteDate.value = '';
}

async function initModalMap(points: any[], color: string) {
  if (!modalMapContainer.value) {
    console.error('Modal map container not found');
    return;
  }

  try {
    // Ensure container has size
    const rect = modalMapContainer.value.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.error('Map container has no size:', rect);
      return;
    }

    // Create map
    modalMap.value = L.map(modalMapContainer.value, {
      zoomControl: false,
      attributionControl: false
    });

    // Add tile layer
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(modalMap.value);

    // Create path from points
    const latlngs = points.map((p) => [p.lat, p.lng]);

    // Add route polyline
    modalPolyline.value = L.polyline(latlngs, {
      color: color,
      weight: 4,
      opacity: 0.8
    }).addTo(modalMap.value);

    // Add start marker (green)
    L.circleMarker(latlngs[0], {
      radius: 6,
      fillColor: '#22c55e',
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 1
    }).addTo(modalMap.value);

    // Add end marker (red)
    if (latlngs.length > 1) {
      L.circleMarker(latlngs[latlngs.length - 1], {
        radius: 6,
        fillColor: '#ef4444',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 1
      }).addTo(modalMap.value);
    }

    // Fit bounds to show entire route
    const bounds = L.latLngBounds(latlngs);
    modalMap.value.fitBounds(bounds, { padding: [50, 50] });

    // Force map to recalculate size
    setTimeout(() => {
      if (modalMap.value) {
        modalMap.value.invalidateSize();
      }
    }, 100);

    // Add zoom control
    L.control.zoom({ position: 'topright' }).addTo(modalMap.value);
  } catch (err) {
    console.error('Failed to initialize modal map:', err);
  }
}

function clearDayTimelineMap() {
  for (const map of daySegmentMiniMaps.value.values()) {
    map.remove();
  }
  daySegmentMiniMaps.value.clear();
  daySegmentMapRefs.value.clear();
}

function setDaySegmentMapRef(el: HTMLElement | null, id: string) {
  if (el) {
    daySegmentMapRefs.value.set(id, el);
  }
}

function prettyTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function labelFromCoords(
  center: { lat: number; lng: number },
  homeCenter: { lat: number; lng: number } | null,
  officeCenter: { lat: number; lng: number } | null,
  fallbackIndex: number
): string {
  if (homeCenter && distanceMeters(center, homeCenter) <= 220) return 'Home';
  if (officeCenter && distanceMeters(center, officeCenter) <= 220) return 'Office';
  return `Place ${fallbackIndex}`;
}

function buildDaySegments(points: any[]) {
  const sorted = [...points]
    .map((p: any) => ({
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      timestamp: Number(p?.timestamp || 0)
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (sorted.length < 4) return [];

  const STOP_RADIUS_M = 130;
  const STOP_MIN_DURATION_MS = 20 * 60 * 1000;
  const stays: Array<{ startIdx: number; endIdx: number; start: number; end: number; center: { lat: number; lng: number }; durationMs: number }> = [];
  let groupStart = 0;
  let sumLat = sorted[0].lat;
  let sumLng = sorted[0].lng;
  let count = 1;

  for (let i = 1; i < sorted.length; i++) {
    const center = { lat: sumLat / count, lng: sumLng / count };
    const far = distanceMeters(center, sorted[i]) > STOP_RADIUS_M;
    if (!far) {
      sumLat += sorted[i].lat;
      sumLng += sorted[i].lng;
      count += 1;
      continue;
    }
    const startTs = sorted[groupStart].timestamp;
    const endTs = sorted[i - 1].timestamp;
    const durationMs = endTs - startTs;
    if (durationMs >= STOP_MIN_DURATION_MS) {
      stays.push({
        startIdx: groupStart,
        endIdx: i - 1,
        start: startTs,
        end: endTs,
        center,
        durationMs
      });
    }
    groupStart = i;
    sumLat = sorted[i].lat;
    sumLng = sorted[i].lng;
    count = 1;
  }

  const finalStart = sorted[groupStart].timestamp;
  const finalEnd = sorted[sorted.length - 1].timestamp;
  const finalDuration = finalEnd - finalStart;
  if (finalDuration >= STOP_MIN_DURATION_MS) {
    stays.push({
      startIdx: groupStart,
      endIdx: sorted.length - 1,
      start: finalStart,
      end: finalEnd,
      center: { lat: sumLat / count, lng: sumLng / count },
      durationMs: finalDuration
    });
  }

  if (stays.length < 2) return [];

  const homeCenter = stays[0]?.center || null;
  const officeCenter = [...stays]
    .filter((s) => homeCenter && distanceMeters(s.center, homeCenter) > 220)
    .sort((a, b) => b.durationMs - a.durationMs)[0]?.center || null;

  const segments: any[] = [];
  let labelIdx = 1;
  for (let i = 0; i < stays.length - 1; i++) {
    const from = stays[i];
    const to = stays[i + 1];
    const fromLabel = labelFromCoords(from.center, homeCenter, officeCenter, labelIdx++);
    const toLabel = labelFromCoords(to.center, homeCenter, officeCenter, labelIdx++);
    const travelMs = Math.max(0, to.start - from.end);
    const tripPoints = sorted.slice(from.endIdx, to.startIdx + 1);
    if (tripPoints.length < 2) continue;
    segments.push({
      id: `${from.start}-${to.end}-${i}`,
      startStory: `At ${fromLabel} for ${formatDuration(from.durationMs)}`,
      endStory: `Went to ${toLabel} in ${formatDuration(travelMs)} • stayed ${formatDuration(to.durationMs)}`,
      startTime: prettyTime(from.start),
      endTime: prettyTime(to.end),
      points: tripPoints
    });
  }
  return segments;
}

async function renderDaySegmentMiniMaps() {
  await nextTick();
  const colors = ['#f59e0b', '#38bdf8', '#22c55e', '#f472b6', '#a78bfa', '#fb7185'];
  for (let i = 0; i < selectedDaySegments.value.length; i++) {
    const segment = selectedDaySegments.value[i];
    const container = daySegmentMapRefs.value.get(segment.id);
    if (!container) continue;

    if (daySegmentMiniMaps.value.has(segment.id)) {
      daySegmentMiniMaps.value.get(segment.id).remove();
      daySegmentMiniMaps.value.delete(segment.id);
    }

    const mini = L.map(container, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false
    });
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(mini);
    const latlngs = segment.points.map((p: any) => [p.lat, p.lng]);
    const color = colors[i % colors.length];
    L.polyline(latlngs, { color, weight: 4, opacity: 0.9 }).addTo(mini);
    L.circleMarker(latlngs[0], {
      radius: 4,
      color: '#fff',
      fillColor: '#22c55e',
      fillOpacity: 1,
      weight: 1.5
    }).addTo(mini);
    L.circleMarker(latlngs[latlngs.length - 1], {
      radius: 4,
      color: '#fff',
      fillColor: '#ef4444',
      fillOpacity: 1,
      weight: 1.5
    }).addTo(mini);
    mini.fitBounds(L.latLngBounds(latlngs), { padding: [14, 14] });
    daySegmentMiniMaps.value.set(segment.id, mini);
  }
}

async function openDayTimelineModal(dayKey: string, label: string) {
  selectedDayKey.value = dayKey;
  selectedDayLabel.value = label;
  dayTimelineRouteStats.value = { totalRoutes: 0, totalPoints: 0, segmentCount: 0 };
  selectedDaySegments.value = [];
  await nextTick();
  const start = new Date(`${dayKey}T00:00:00`).getTime();
  const end = start + 24 * 60 * 60 * 1000 - 1;

  const routes = history.value
    .filter((r: any) => r.classification === 'PASSIVE')
    .filter((r: any) => {
      const ts = Number(r?.timestamp || 0);
      return ts >= start && ts <= end;
    });

  clearDayTimelineMap();
  let totalPoints = 0;
  const allPoints: any[] = [];

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const routePoints = await db.points.where('routeId').equals(Number(route.id)).sortBy('timestamp');
    if (!routePoints.length) continue;
    totalPoints += routePoints.length;
    allPoints.push(...routePoints);
  }
  selectedDaySegments.value = buildDaySegments(allPoints);
  dayTimelineRouteStats.value = {
    totalRoutes: routes.length,
    totalPoints,
    segmentCount: selectedDaySegments.value.length
  };
  await renderDaySegmentMiniMaps();
}

function closeDayTimelineModal() {
  clearDayTimelineMap();
  selectedDayKey.value = null;
  selectedDayLabel.value = '';
  selectedDaySegments.value = [];
  dayTimelineRouteStats.value = { totalRoutes: 0, totalPoints: 0, segmentCount: 0 };
}

onMounted(async () => {
  try {
    await syncDownFromCloudflare();
  } catch (err) {
    console.error('Sync failed, loading local routes only:', err);
  }
  await loadHistory();
});
</script>

<style scoped>
.container-v {
  max-width: 600px;
  margin: 0 auto;
}
</style>
