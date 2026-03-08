<template>
  <!-- pb-16 accounts for the fixed bottom nav bar (h-16) -->
  <div class="flex flex-col pb-16" style="height: calc(100dvh - env(safe-area-inset-top))">
    <!-- ══ MAP SECTION ══════════════════════════════════════ -->
    <div class="relative flex-shrink-0" style="height: 52%">
      <div ref="heroMapContainer" class="absolute inset-0 z-0"></div>

      <!-- gradient scrim -->
      <div
        class="pointer-events-none absolute inset-0 z-10"
        style="
          background: linear-gradient(
            to top,
            rgba(15, 15, 15, 0.95) 0%,
            rgba(15, 15, 15, 0.35) 40%,
            rgba(15, 15, 15, 0.18) 100%
          );
        "
      ></div>

      <!-- top bar: title left, stats right -->
      <div class="absolute left-0 right-0 top-0 z-20 flex items-start justify-between px-4 pt-3">
        <!-- title -->
        <div>
          <p class="mb-0.5 text-xs font-semibold uppercase tracking-widest text-orange-500">
            Community
          </p>
          <h1 class="text-lg font-bold leading-tight text-white">Routes</h1>
          <p class="mt-0.5 text-xs text-gray-400">{{ history.length }} tracked · {{ lastSync }}</p>
        </div>
        <!-- stat pills -->
        <div class="mt-1 flex gap-2">
          <div
            class="flex min-w-[48px] flex-col items-center rounded-xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur"
          >
            <span class="text-base font-bold leading-none text-white">{{ history.length }}</span>
            <span class="mt-1 text-[10px] uppercase tracking-wider text-gray-500">All</span>
          </div>
          <div
            class="flex min-w-[48px] flex-col items-center rounded-xl border border-orange-500/30 bg-black/60 px-3 py-2 backdrop-blur"
          >
            <span class="text-base font-bold leading-none text-orange-400">{{ activeCount }}</span>
            <span class="mt-1 text-[10px] uppercase tracking-wider text-gray-500">Active</span>
          </div>
          <div
            class="flex min-w-[48px] flex-col items-center rounded-xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur"
          >
            <span class="text-base font-bold leading-none text-white">{{ passiveCount }}</span>
            <span class="mt-1 text-[10px] uppercase tracking-wider text-gray-500">Passive</span>
          </div>
        </div>
      </div>

      <!-- selected route info — bottom of map -->
      <Transition name="rise">
        <div v-if="selectedRoute" class="absolute bottom-0 left-0 right-0 z-20 px-4 pb-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-bold text-white">#{{ selectedRoute.id }}</span>
            <span
              class="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              :class="
                selectedRoute.classification === 'ACTIVE'
                  ? 'border border-orange-500/30 bg-orange-500/20 text-orange-400'
                  : 'border border-blue-500/30 bg-blue-500/20 text-blue-400'
              "
              >{{ selectedRoute.classification }}</span
            >
            <span class="text-xs text-gray-400">{{
              new Date(selectedRoute.timestamp).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            }}</span>
          </div>
          <p class="mt-1 truncate text-xs text-gray-400">{{ selectedRoute.story }}</p>
        </div>
      </Transition>
    </div>

    <!-- ══ PANEL SECTION ════════════════════════════════════ -->
    <div class="flex min-h-0 flex-1 flex-col bg-gray-50">
      <!-- drag handle -->
      <div class="flex flex-shrink-0 justify-center pb-1 pt-2.5">
        <div class="h-1 w-8 rounded-full bg-gray-300"></div>
      </div>

      <!-- day timeline chips -->
      <div
        v-if="dayTimeline.length"
        class="scrollbar-none flex flex-shrink-0 gap-2 overflow-x-auto px-3 pb-2"
      >
        <button
          v-for="day in dayTimeline"
          :key="day.dayKey"
          class="flex flex-shrink-0 flex-col items-start rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm transition-colors active:border-orange-200 active:bg-orange-50"
          @click="focusFirstRouteForDay(day.dayKey)"
        >
          <span class="text-[11px] font-semibold text-gray-700">{{ day.label }}</span>
          <span class="mt-0.5 text-[10px] text-gray-400"
            >{{ day.routeCount }} · {{ day.totalDurationLabel }}</span
          >
        </button>
      </div>

      <!-- search bar -->
      <div class="flex-shrink-0 px-3 pb-2">
        <div class="relative">
          <svg
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            viewBox="0 0 20 20"
            fill="none"
          >
            <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.5" />
            <path
              d="M13 13l3.5 3.5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
          <input
            v-model="search"
            type="text"
            placeholder="Search routes…"
            class="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 shadow-sm transition focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>
      </div>

      <!-- routes list — this is the scrollable area -->
      <div class="flex-1 space-y-2 overflow-y-auto px-3 pb-2">
        <template v-if="filteredHistory.length > 0">
          <div
            v-for="route in filteredHistory"
            :key="route.id"
            class="cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition-all active:scale-[0.99]"
            :class="
              Number(selectedRouteId) === Number(route.id)
                ? 'border-orange-400 shadow-orange-100'
                : 'border-gray-100'
            "
            @click="focusRoute(route.id)"
          >
            <!-- left-edge bar + content -->
            <div class="flex">
              <!-- accent bar -->
              <div
                class="w-1 flex-shrink-0"
                :class="route.classification === 'ACTIVE' ? 'bg-orange-500' : 'bg-blue-500'"
              ></div>

              <div class="min-w-0 flex-1 p-3">
                <!-- top row -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span class="text-[13px] font-bold text-gray-800">#{{ route.id }}</span>
                    <span
                      class="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      :class="
                        route.classification === 'ACTIVE'
                          ? 'bg-orange-100 text-orange-600'
                          : 'bg-blue-100 text-blue-600'
                      "
                      >{{ route.classification }}</span
                    >
                    <span class="text-[11px] text-gray-400">
                      {{ formatRouteTimeWindow(route) }}
                    </span>
                  </div>
                  <!-- actions -->
                  <div class="flex flex-shrink-0 gap-1.5">
                    <button
                      class="flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-[11px] text-gray-500 transition-colors hover:bg-gray-200"
                      @click.stop="viewRoute(route.id)"
                    >
                      <svg class="h-3 w-3" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.3" />
                        <path
                          d="M2 8s2-5 6-5 6 5 6 5-2 5-6 5-6-5-6-5z"
                          stroke="currentColor"
                          stroke-width="1.3"
                        />
                      </svg>
                      Map
                    </button>
                    <button
                      class="flex items-center rounded-lg bg-red-50 px-2 py-1 text-[11px] text-red-400 transition-colors hover:bg-red-100"
                      @click.stop="deleteRoute(route.id)"
                    >
                      <svg class="h-3 w-3" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M3 4h10M6 4V3h4v1M5 4l.5 9h5L11 4"
                          stroke="currentColor"
                          stroke-width="1.3"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- story -->
                <p class="mt-1.5 line-clamp-2 text-[12px] leading-snug text-gray-500">
                  {{ route.story || `${route.pointCount || 0} points recorded` }}
                </p>

                <!-- chips -->
                <div class="mt-2 flex flex-wrap gap-1">
                  <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">{{
                    route.routeStatus || '—'
                  }}</span>
                  <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500"
                    >{{ Math.round(route.routeDistanceMeters || 0) }}m</span
                  >
                  <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500"
                    >{{ route.pointCount || 0 }} pts</span
                  >
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px]"
                    :class="
                      route.classification === 'ACTIVE'
                        ? 'bg-orange-100 text-orange-500'
                        : 'bg-blue-100 text-blue-500'
                    "
                    >{{ route.durationLabel || 'Logged' }}</span
                  >
                  <span
                    v-if="route.passiveMeta"
                    class="rounded-full px-2 py-0.5 text-[10px]"
                    :class="
                      route.passiveMeta.uploadedAt
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    "
                  >
                    {{ route.passiveMeta.uploadedAt ? 'uploaded' : 'pending' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- empty state -->
        <div v-else class="flex flex-col items-center justify-center py-16 text-center">
          <div class="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <svg class="h-7 w-7 text-gray-300" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <p class="text-sm font-medium text-gray-400">No routes found</p>
          <p class="mt-1 text-xs text-gray-300">Try adjusting your search</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import L from 'leaflet';
import { Capacitor } from '@capacitor/core';
import { ActivityRecognition } from '@/src/plugins/activityRecognition';
import { db } from '@/db/index.js';
import { syncDownFromCloudflare } from '~/db';

const router = useRouter();
const history = ref<any[]>([]);
const search = ref('');
const lastSync = ref('--:--');
const selectedRouteId = ref<number | null>(null);
const routePointsById = ref<Map<number, any[]>>(new Map());
const heroMapContainer = ref<HTMLElement | null>(null);
const heroMap = ref<any>(null);
const heroLayerGroup = ref<any>(null);

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
      String(r.id).includes(s) ||
      String(r.classification || '')
        .toLowerCase()
        .includes(s) ||
      String(r.story || '')
        .toLowerCase()
        .includes(s)
  );
});

const selectedRoute = computed(
  () => history.value.find((route) => Number(route.id) === Number(selectedRouteId.value)) || null
);

const dayTimeline = computed(() => {
  const byDay = new Map<string, any[]>();
  for (const route of history.value) {
    if (String(route?.classification || '') !== 'PASSIVE') continue;
    const ts = Number(route?.timestamp || 0);
    if (!Number.isFinite(ts) || ts <= 0) continue;
    const date = new Date(ts);
    const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (!byDay.has(dayKey)) byDay.set(dayKey, []);
    byDay.get(dayKey)!.push(route);
  }
  return [...byDay.entries()]
    .map(([dayKey, routes]) => {
      const sorted = [...routes].sort(
        (a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0)
      );
      const totalDurationMs = sorted.reduce((sum, row) => sum + Number(row.durationMs || 0), 0);
      const dayLabel = new Date(`${dayKey}T00:00:00`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });
      return {
        dayKey,
        label: dayLabel,
        routeCount: sorted.length,
        totalDurationLabel: formatDuration(totalDurationMs)
      };
    })
    .sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))
    .slice(0, 6);
});

function toRad(v: number) {
  return (v * Math.PI) / 180;
}
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000,
    dLat = toRad(b.lat - a.lat),
    dLng = toRad(b.lng - a.lng);
  const ha =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(ha), Math.sqrt(1 - ha));
}
function formatDuration(ms: number): string {
  const m = Math.floor(Math.max(0, Number(ms || 0)) / 60_000);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60),
    rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}
function formatRouteTimeWindow(route: any): string {
  const start = Number(route?.startTimestamp || route?.timestamp || 0);
  const end = Number(route?.endTimestamp || start);
  if (!start) return '-';
  const startDate = new Date(start);
  const startLabel = `${startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (!end || end <= start) return startLabel;
  const endDate = new Date(end);
  const endLabel = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (startDate.toDateString() === endDate.toDateString()) return `${startLabel} -> ${endLabel}`;
  return `${startLabel} -> ${endDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${endLabel}`;
}
function bearingDegrees(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
function toCompass(deg: number): string {
  if (!Number.isFinite(deg)) return 'N/A';
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][
    Math.round((((deg % 360) + 360) % 360) / 45) % 8
  ];
}
function labelPlace(
  c: { lat: number; lng: number },
  home: { lat: number; lng: number } | null,
  office: { lat: number; lng: number } | null,
  i: number
): string {
  if (home && distanceMeters(c, home) <= 220) return 'Home';
  if (office && distanceMeters(c, office) <= 220) return 'Office';
  return `Place ${i}`;
}
function buildPassiveStory(rawPoints: any[]) {
  const pts = [...rawPoints]
    .map((p: any) => ({
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      timestamp: Number(p?.timestamp || 0)
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (pts.length < 2)
    return {
      story: pts.length ? 'Single check-in' : 'No points',
      durationLabel: 'Logged',
      durationMs: 0
    };
  const totalMs = pts[pts.length - 1].timestamp - pts[0].timestamp;
  const stops: any[] = [];
  const R = 120,
    minMs = 20 * 60 * 1000;
  let gs = 0,
    sLat = pts[0].lat,
    sLng = pts[0].lng,
    gc = 1;
  for (let i = 1; i < pts.length; i++) {
    if (distanceMeters({ lat: sLat / gc, lng: sLng / gc }, pts[i]) <= R) {
      sLat += pts[i].lat;
      sLng += pts[i].lng;
      gc++;
      continue;
    }
    const dMs = pts[i - 1].timestamp - pts[gs].timestamp;
    if (dMs >= minMs)
      stops.push({
        center: { lat: sLat / gc, lng: sLng / gc },
        start: pts[gs].timestamp,
        end: pts[i - 1].timestamp,
        durationMs: dMs
      });
    gs = i;
    sLat = pts[i].lat;
    sLng = pts[i].lng;
    gc = 1;
  }
  const lastDMs = pts[pts.length - 1].timestamp - pts[gs].timestamp;
  if (lastDMs >= minMs)
    stops.push({
      center: { lat: sLat / gc, lng: sLng / gc },
      start: pts[gs].timestamp,
      end: pts[pts.length - 1].timestamp,
      durationMs: lastDMs
    });
  const home = stops[0]?.center || pts[0];
  const office =
    [...stops]
      .filter((s) => distanceMeters(s.center, home) > 220)
      .sort((a, b) => b.durationMs - a.durationMs)[0]?.center || null;
  const frags: string[] = [];
  let idx = 1;
  if (stops.length)
    frags.push(
      `At ${labelPlace(stops[0].center, home, office, idx++)} ${formatDuration(stops[0].durationMs)}`
    );
  for (let i = 0; i < stops.length - 1; i++) {
    const tMs = Math.max(0, stops[i + 1].start - stops[i].end);
    if (tMs > 0)
      frags.push(
        `→ ${labelPlace(stops[i + 1].center, home, office, idx++)} in ${formatDuration(tMs)}`
      );
  }
  if (!frags.length)
    frags.push(
      distanceMeters(pts[0], pts[pts.length - 1]) < 200
        ? `Stayed nearby ${formatDuration(totalMs)}`
        : `Moving ${formatDuration(totalMs)}`
    );
  return {
    story: frags.slice(0, 3).join(' · '),
    durationLabel: formatDuration(totalMs),
    durationMs: totalMs
  };
}
function buildActiveStory(pts: any[]) {
  const norm = [...pts]
    .map((p: any) => ({
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      timestamp: Number(p?.timestamp || 0)
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (norm.length < 2) return { story: 'Active route', durationLabel: 'Logged', durationMs: 0 };
  const speeds: number[] = [],
    bearings: number[] = [];
  for (let i = 1; i < norm.length; i++) {
    const dt = Math.max(1, (norm[i].timestamp - norm[i - 1].timestamp) / 1000);
    const d = distanceMeters(norm[i - 1], norm[i]);
    if (d < 2) continue;
    speeds.push((d / dt) * 3.6);
    bearings.push(bearingDegrees(norm[i - 1], norm[i]));
  }
  const totalMs = Math.max(0, norm[norm.length - 1].timestamp - norm[0].timestamp);
  if (!speeds.length)
    return {
      story: `Active · ${norm.length} pts`,
      durationLabel: formatDuration(totalMs),
      durationMs: totalMs
    };
  const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const w = Math.max(1, Math.floor(speeds.length / 3));
  const s0 = speeds.slice(0, w).reduce((a, b) => a + b, 0) / w;
  const sN = speeds.slice(-w).reduce((a, b) => a + b, 0) / w;
  const trend = sN > s0 + 1 ? 'accelerating' : sN < s0 - 1 ? 'decelerating' : 'steady';
  const ob = bearingDegrees(norm[0], norm[norm.length - 1]);
  return {
    story: `${trend} · avg ${avg.toFixed(1)} km/h · ${toCompass(bearings[0] ?? ob)}→${toCompass(ob)}`,
    durationLabel: formatDuration(totalMs),
    durationMs: totalMs
  };
}
function buildRouteStory(cls: string, pts: any[]) {
  if (!Array.isArray(pts) || !pts.length)
    return { story: 'No points', durationLabel: 'Logged', durationMs: 0 };
  if (cls === 'PASSIVE') return buildPassiveStory(pts);
  if (cls === 'ACTIVE') return buildActiveStory(pts);
  return { story: `${pts.length} pts`, durationLabel: 'Logged', durationMs: 0 };
}
async function getRoutePoints(routeId: number): Promise<any[]> {
  if (routePointsById.value.has(routeId)) return routePointsById.value.get(routeId) || [];
  const pts = await db.points.where('routeId').equals(Number(routeId)).sortBy('timestamp');
  routePointsById.value.set(routeId, pts);
  return pts;
}
async function loadPassiveRowsForRoutes(routes: any[]): Promise<any[]> {
  const routeTimestamps = routes
    .map((route: any) => Number(route?.timestamp || 0))
    .filter((ts: number) => Number.isFinite(ts) && ts > 0);
  if (!routeTimestamps.length) return [];
  if (!Capacitor.isPluginAvailable('qipz-activity')) return [];
  const fromTs = Math.max(0, Math.min(...routeTimestamps) - 12 * 60 * 60 * 1000);
  const toTs = Math.max(...routeTimestamps) + 12 * 60 * 60 * 1000;
  try {
    const merged: any[] = [];
    let cursor: number | undefined;
    for (let i = 0; i < 25; i++) {
      const response = await ActivityRecognition.getPassiveEvents({
        fromTs,
        toTs,
        cursor,
        limit: 400
      });
      const events = Array.isArray(response?.events) ? response.events : [];
      if (!events.length) break;
      merged.push(...events);
      if (!response?.hasMore || !response?.nextCursor) break;
      cursor = Number(response.nextCursor);
      if (!Number.isFinite(cursor) || cursor <= 0) break;
    }
    return merged
      .map((row: any) => ({
        timestamp: Number(row?.timestamp || 0),
        trigger: String(row?.trigger || ''),
        provider: String(row?.provider || ''),
        acc: Number(row?.acc || 0),
        source: String(row?.source || ''),
        uploadedAt: Number(row?.uploadedAt || 0)
      }))
      .filter((row: any) => Number.isFinite(row.timestamp) && row.timestamp > 0)
      .sort((a: any, b: any) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  } catch (err) {
    console.warn('Plugin passive history read failed:', err);
    return [];
  }
}
function latestPassiveForRoute(routePoints: any[], passiveRows: any[]): any | null {
  if (!routePoints.length || !passiveRows.length) return null;
  const firstTs = Number(routePoints[0]?.timestamp || 0);
  const lastTs = Number(routePoints[routePoints.length - 1]?.timestamp || 0);
  if (!Number.isFinite(firstTs) || !Number.isFinite(lastTs) || firstTs <= 0 || lastTs <= 0) return null;
  const windowStart = Math.max(0, firstTs - 2 * 60 * 1000);
  const windowEnd = lastTs + 2 * 60 * 1000;
  let latest: any | null = null;
  for (let i = passiveRows.length - 1; i >= 0; i--) {
    const row = passiveRows[i];
    const ts = Number(row?.timestamp || 0);
    if (ts > windowEnd) continue;
    if (ts < windowStart) break;
    latest = row;
    break;
  }
  return latest;
}
async function loadHistory() {
  try {
    const routes = await db.routes.orderBy('timestamp').reverse().toArray();
    const passiveRows = await loadPassiveRowsForRoutes(routes);
    const enriched: any[] = [];
    for (const route of routes) {
      const routeId = Number(route?.id);
      if (!Number.isFinite(routeId)) continue;
      const routePoints = await getRoutePoints(routeId);
      const src = String(route?.source || '').toUpperCase();
      const hasPassive = routePoints.some(
        (p: any) => String(p?.source || '').toUpperCase() === 'PASSIVE'
      );
      const classification = src === 'PASSIVE' || hasPassive ? 'PASSIVE' : 'ACTIVE';
      const narrative = buildRouteStory(classification, routePoints);
      const firstPointTimestamp = Number(routePoints[0]?.timestamp || 0);
      const lastPointTimestamp = Number(routePoints[routePoints.length - 1]?.timestamp || 0);
      const startTimestamp = firstPointTimestamp || Number(route?.timestamp || 0);
      const endTimestamp = lastPointTimestamp || startTimestamp;
      const latestPassive = latestPassiveForRoute(routePoints, passiveRows);
      enriched.push({
        ...route,
        startTimestamp,
        endTimestamp,
        pointCount: routePoints.length,
        classification,
        story: narrative.story,
        durationLabel: narrative.durationLabel,
        durationMs: narrative.durationMs,
        routeStatus: String(route?.status || '').toUpperCase() || '—',
        routeDistanceMeters: Number(route?.distance_meters || 0),
        passiveMeta: latestPassive
          ? {
              trigger: String(latestPassive?.trigger || ''),
              provider: String(latestPassive?.provider || ''),
              acc: Number(latestPassive?.acc || 0),
              uploadedAt: Number(latestPassive?.uploadedAt || 0)
            }
          : null
      });
    }
    history.value = enriched;
    lastSync.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (err) {
    console.error('Failed to load routes:', err);
  }
}
async function initHeroMap() {
  if (!heroMapContainer.value || heroMap.value) return;
  heroMap.value = L.map(heroMapContainer.value, { zoomControl: false, attributionControl: false });
  L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(heroMap.value);
  heroLayerGroup.value = L.layerGroup().addTo(heroMap.value);
  L.control.zoom({ position: 'bottomright' }).addTo(heroMap.value);
  heroMap.value.setView([14.5764, 121.0851], 12);
}
async function renderSelectedRouteOnHeroMap() {
  if (!heroMap.value || !heroLayerGroup.value || !selectedRouteId.value) return;
  const pts = await getRoutePoints(Number(selectedRouteId.value));
  const latlngs = pts
    .map((p: any) => [Number(p?.lat), Number(p?.lng)])
    .filter((pair: any[]) => Number.isFinite(pair[0]) && Number.isFinite(pair[1]));
  heroLayerGroup.value.clearLayers();
  if (!latlngs.length) return;
  L.polyline(latlngs, { color: '#f97316', weight: 4, opacity: 0.9 }).addTo(heroLayerGroup.value);
  L.circleMarker(latlngs[0], {
    radius: 7,
    fillColor: '#22c55e',
    color: '#fff',
    weight: 2,
    fillOpacity: 1
  }).addTo(heroLayerGroup.value);
  L.circleMarker(latlngs[latlngs.length - 1], {
    radius: 7,
    fillColor: '#ef4444',
    color: '#fff',
    weight: 2,
    fillOpacity: 1
  }).addTo(heroLayerGroup.value);
  heroMap.value.fitBounds(L.latLngBounds(latlngs), { padding: [44, 44] });
}
async function focusRoute(routeId: number) {
  selectedRouteId.value = Number(routeId);
  await renderSelectedRouteOnHeroMap();
}
function focusFirstRouteForDay(dayKey: string) {
  const first = history.value
    .filter((r: any) => {
      if (String(r?.classification || '') !== 'PASSIVE') return false;
      const ts = Number(r?.timestamp || 0);
      if (!Number.isFinite(ts) || ts <= 0) return false;
      const d = new Date(ts);
      return (
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` ===
        dayKey
      );
    })
    .sort((a: any, b: any) => Number(b.timestamp || 0) - Number(a.timestamp || 0))[0];
  if (first) void focusRoute(Number(first.id));
}
function viewRoute(id: number) {
  router.push(`/map?routeId=${id}`);
}
async function deleteRoute(id: number) {
  if (!confirm('Delete this route?')) return;
  try {
    await db.routes.delete(Number(id));
    await db.points.where('routeId').equals(Number(id)).delete();
    routePointsById.value.delete(Number(id));
    await loadHistory();
    if (Number(selectedRouteId.value) === Number(id)) {
      const fallback = history.value[0];
      selectedRouteId.value = fallback ? Number(fallback.id) : null;
      await renderSelectedRouteOnHeroMap();
    }
  } catch (err) {
    console.error('Delete failed:', err);
  }
}
watch(
  () => filteredHistory.value.map((r) => Number(r.id)),
  async (ids) => {
    if (!ids.length) {
      selectedRouteId.value = null;
      if (heroLayerGroup.value) heroLayerGroup.value.clearLayers();
      return;
    }
    if (!selectedRouteId.value || !ids.includes(Number(selectedRouteId.value))) {
      selectedRouteId.value = Number(ids[0]);
    }
    await renderSelectedRouteOnHeroMap();
  }
);
onMounted(async () => {
  try {
    await syncDownFromCloudflare();
  } catch (err) {
    console.error('Sync failed:', err);
  }
  await loadHistory();
  await nextTick();
  await initHeroMap();
  if (history.value.length) {
    selectedRouteId.value = Number(history.value[0].id);
    await renderSelectedRouteOnHeroMap();
  }
});
onBeforeUnmount(() => {
  if (heroMap.value) {
    heroMap.value.remove();
    heroMap.value = null;
  }
  heroLayerGroup.value = null;
});
</script>

<style scoped>
.rise-enter-active {
  transition:
    transform 200ms ease,
    opacity 200ms ease;
}
.rise-leave-active {
  transition:
    transform 150ms ease,
    opacity 150ms ease;
}
.rise-enter-from,
.rise-leave-to {
  transform: translateY(6px);
  opacity: 0;
}

.scrollbar-none {
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hero-map-container :deep(.leaflet-control-zoom a) {
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #f97316;
  border-radius: 6px;
}
</style>
