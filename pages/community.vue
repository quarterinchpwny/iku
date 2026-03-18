<template>
  <div
    class="relative flex flex-col overflow-hidden pb-16"
    style="height: calc(100dvh - env(safe-area-inset-top))"
    ref="pageRoot"
  >
    <!-- ══ MAP SECTION ══════════════════════════════════════ -->
    <div
      class="relative z-0 flex-shrink-0 overflow-hidden transition-none"
      :style="{ height: mapHeight + 'px' }"
    >
      <div ref="heroMapContainer" class="hero-map-container absolute inset-0 z-0"></div>

      <!-- gradient scrim -->
      <div
        class="pointer-events-none absolute inset-0 z-10"
        style="
          background: linear-gradient(
            to top,
            rgba(10, 10, 10, 0.97) 0%,
            rgba(10, 10, 10, 0.3) 40%,
            rgba(10, 10, 10, 0.15) 100%
          );
        "
      ></div>

      <!-- top bar -->
      <div class="absolute left-0 right-0 top-0 z-20 flex items-start justify-between px-4 pt-3">
        <div>
          <p class="mb-0.5 text-xs font-semibold uppercase tracking-widest text-orange-500">
            Community
          </p>
          <h1 class="text-lg font-bold leading-tight text-white">Routes</h1>
          <p class="mt-0.5 text-xs text-zinc-400">{{ history.length }} tracked · {{ lastSync }}</p>
        </div>
        <div class="mt-1 flex gap-2">
          <div
            class="flex min-w-[48px] flex-col items-center rounded-xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur"
          >
            <span class="text-base font-bold leading-none text-white">{{ history.length }}</span>
            <span class="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">All</span>
          </div>
          <div
            class="flex min-w-[48px] flex-col items-center rounded-xl border border-orange-500/30 bg-black/60 px-3 py-2 backdrop-blur"
          >
            <span class="text-base font-bold leading-none text-orange-400">{{ activeCount }}</span>
            <span class="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">Active</span>
          </div>
          <div
            class="flex min-w-[48px] flex-col items-center rounded-xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur"
          >
            <span class="text-base font-bold leading-none text-white">{{ passiveCount }}</span>
            <span class="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">Passive</span>
          </div>
        </div>
      </div>

      <!-- selected route info — bottom of map (only in split mode) -->
      <Transition name="rise">
        <div
          v-if="selectedRoute && panelSnap !== 'map'"
          class="absolute bottom-0 left-0 right-0 z-20 px-4 pb-3"
        >
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
            <span class="text-xs text-zinc-400">{{
              new Date(selectedRoute.timestamp).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            }}</span>
            <span
              v-if="routePointsLoading"
              class="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-400"
            >
              <span
                class="h-2.5 w-2.5 animate-spin rounded-full border-2 border-orange-400/70 border-t-transparent"
              ></span>
              Loading points
            </span>
          </div>
          <p class="mt-1 truncate text-xs text-zinc-400">{{ selectedRoute.story }}</p>
        </div>
      </Transition>

      <!-- FULL MAP MODE: mini route SVG strip -->
      <Transition name="fade-up">
        <div
          v-if="panelSnap === 'map' && history.length"
          class="absolute bottom-0 left-0 right-0 z-20 px-3 pb-3"
        >
          <div class="scrollbar-none flex gap-2 overflow-x-auto pb-1">
            <button
              v-for="route in history.slice(0, 25)"
              :key="`mini-${route.id}`"
              class="group relative flex-shrink-0 overflow-hidden rounded-xl border transition-all"
              :class="
                Number(selectedRouteId) === Number(route.id)
                  ? 'border-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.4)]'
                  : 'border-zinc-800 hover:border-zinc-600'
              "
              style="width: 72px; height: 80px; background: rgba(10, 10, 10, 0.85)"
              @click="focusRoute(route.id)"
            >
              <!-- SVG polyline of the route -->
              <svg
                viewBox="0 0 100 100"
                class="absolute inset-0 w-full"
                style="height: 60px"
                preserveAspectRatio="xMidYMid meet"
              >
                <polyline
                  v-if="routeSvgPaths.get(Number(route.id))"
                  :points="routeSvgPaths.get(Number(route.id))"
                  :stroke="route.classification === 'ACTIVE' ? '#f97316' : '#60a5fa'"
                  stroke-width="2.5"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  opacity="0.9"
                />
                <text v-else x="50" y="50" text-anchor="middle" fill="#52525b" font-size="10">
                  no pts
                </text>
              </svg>

              <!-- label -->
              <div class="absolute bottom-0 left-0 right-0 px-1 pb-1 text-center">
                <span class="font-mono text-[9px] font-bold text-zinc-400">#{{ route.id }}</span>
              </div>
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- ══ DRAG HANDLE ══════════════════════════════════════ -->
    <div
      class="relative z-30 flex flex-shrink-0 cursor-row-resize select-none flex-col items-center justify-center bg-zinc-950"
      style="height: 28px; touch-action: none"
      @mousedown="startDrag"
      @touchstart.prevent="startDrag"
    >
      <!-- snap indicator dots -->
      <div class="flex items-center gap-2">
        <div
          class="h-1 rounded-full transition-all duration-200"
          :class="panelSnap === 'map' ? 'w-6 bg-orange-400' : 'w-2 bg-zinc-700'"
        ></div>
        <div
          class="h-1 rounded-full transition-all duration-200"
          :class="panelSnap === 'split' ? 'w-6 bg-orange-400' : 'w-2 bg-zinc-700'"
        ></div>
        <div
          class="h-1 rounded-full transition-all duration-200"
          :class="panelSnap === 'list' ? 'w-6 bg-orange-400' : 'w-2 bg-zinc-700'"
        ></div>
      </div>
    </div>

    <!-- ══ PANEL SECTION ════════════════════════════════════ -->
    <div class="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-950">
      <!-- day timeline chips -->
      <div
        v-if="dayTimeline.length && panelSnap !== 'map'"
        class="scrollbar-none flex flex-shrink-0 gap-2 overflow-x-auto px-3 pb-2 pt-1"
      >
        <button
          v-for="day in dayTimeline"
          :key="day.dayKey"
          class="flex flex-shrink-0 flex-col items-start rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 transition-colors active:border-orange-500/40 active:bg-orange-500/10"
          @click="focusFirstRouteForDay(day.dayKey)"
        >
          <span class="text-[11px] font-semibold text-zinc-200">{{ day.label }}</span>
          <span class="mt-0.5 text-[10px] text-zinc-500"
            >{{ day.routeCount }} · {{ day.totalDurationLabel }}</span
          >
        </button>
      </div>

      <!-- search bar -->
      <!-- <div v-if="panelSnap !== 'map'" class="flex-shrink-0 px-3 pb-2">
        <div class="relative">
          <svg
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
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
            class="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-500 transition focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>
      </div> -->

      <!-- routes list -->
      <div
        class="flex-1 space-y-2 overflow-y-auto px-3 pb-2"
        :class="panelSnap === 'map' ? 'pointer-events-none opacity-0' : 'opacity-100'"
        style="transition: opacity 200ms"
      >
        <template v-if="filteredHistory.length > 0">
          <div
            v-for="route in filteredHistory"
            :key="route.id"
            class="route-card cursor-pointer overflow-hidden rounded-2xl transition-all active:scale-[0.99]"
            :class="Number(selectedRouteId) === Number(route.id) ? 'route-card--selected' : ''"
            @click="focusRoute(route.id)"
          >
            <!-- top: mini map + info side by side -->
            <div class="flex">
              <!-- mini map -->
              <div class="route-card__map flex-shrink-0">
                <svg
                  viewBox="0 0 100 100"
                  width="96"
                  height="120"
                  preserveAspectRatio="xMidYMid meet"
                  class="block"
                >
                  <template v-if="routeSvgPaths.get(Number(route.id))">
                    <!-- glow layer -->
                    <polyline
                      :points="routeSvgPaths.get(Number(route.id))"
                      :stroke="
                        route.classification === 'ACTIVE'
                          ? 'rgba(255,78,32,0.18)'
                          : 'rgba(96,165,250,0.18)'
                      "
                      stroke-width="7"
                      fill="none"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <!-- main line -->
                    <polyline
                      :points="routeSvgPaths.get(Number(route.id))"
                      :stroke="route.classification === 'ACTIVE' ? '#FF4E20' : '#60a5fa'"
                      stroke-width="2.5"
                      fill="none"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </template>
                  <template v-else>
                    <!-- stayed nearby: concentric rings -->
                    <circle
                      cx="50"
                      cy="50"
                      r="22"
                      fill="none"
                      :stroke="
                        route.classification === 'ACTIVE'
                          ? 'rgba(255,78,32,0.1)'
                          : 'rgba(96,165,250,0.1)'
                      "
                      stroke-width="1.5"
                      stroke-dasharray="6 5"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="11"
                      fill="none"
                      :stroke="
                        route.classification === 'ACTIVE'
                          ? 'rgba(255,78,32,0.2)'
                          : 'rgba(96,165,250,0.2)'
                      "
                      stroke-width="1.2"
                      stroke-dasharray="4 3"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="3"
                      :fill="route.classification === 'ACTIVE' ? '#FF4E20' : '#60a5fa'"
                    />
                  </template>
                </svg>
              </div>


              <!-- info -->
              <div class="flex min-w-0 flex-1 flex-col gap-2 px-3 py-3">
                <!-- row 1: id + badge + actions -->
                <div class="flex items-center justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="route-card__id">#{{ route.id }}</span>
                    <span
                      class="route-card__badge"
                      :class="
                        route.classification === 'ACTIVE'
                          ? 'route-card__badge--active'
                          : 'route-card__badge--passive'
                      "
                    >
                      <span class="route-card__badge-dot"></span>
                      {{ route.classification }}
                    </span>
                    <span
                      v-if="
                        routePointsLoading && Number(selectedRouteId) === Number(route.id)
                      "
                      class="h-2.5 w-2.5 animate-spin rounded-full border-2 border-orange-400/70 border-t-transparent"
                    ></span>
                  </div>
                  <div class="flex flex-shrink-0 gap-1.5">
                    <button
                      v-if="!route.localOnly"
                      class="route-card__action-btn"
                      @click.stop="viewRoute(route.id)"
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.4"
                      >
                        <circle cx="8" cy="8" r="3" />
                        <path d="M2 8s2-5 6-5 6 5 6 5-2 5-6 5-6-5-6-5z" />
                      </svg>
                      Map
                    </button>
                    <button
                      class="route-card__action-btn route-card__action-btn--del"
                      @click.stop="deleteRoute(route.id)"
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.4"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5L11 4" />
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- row 2: story -->
                <p class="route-card__story line-clamp-2">
                  {{ route.story || `${route.pointCount || 0} points recorded` }}
                </p>

                <!-- row 3: tags -->
                <div class="flex flex-wrap gap-1.5">
                  <span class="route-card__tag">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                    </svg>
                    {{ Math.round(route.routeDistanceMeters || 0) }}m
                  </span>
                  <span
                    class="route-card__tag"
                    :class="
                      route.classification === 'ACTIVE'
                        ? 'route-card__tag--active'
                        : 'route-card__tag--passive'
                    "
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {{ route.durationLabel || 'Logged' }}
                  </span>
                  <span
                    class="route-card__tag"
                    :class="
                      route.routeStatus === 'OPEN'
                        ? 'route-card__tag--open'
                        : 'route-card__tag--closed'
                    "
                  >
                    {{ route.routeStatus || '—' }}
                  </span>
                  <span
                    v-if="route.passiveMeta"
                    class="route-card__tag"
                    :class="
                      route.passiveMeta.uploadedAt
                        ? 'route-card__tag--uploaded'
                        : 'route-card__tag--pending'
                    "
                  >
                    {{ route.passiveMeta.uploadedAt ? 'uploaded' : 'pending' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- bottom strip: time window -->
            <div class="route-card__time-strip">
              <span>{{ formatRouteTimeWindow(route) }}</span>
              <span v-if="route.pointCount" class="route-card__pts"
                >{{ route.pointCount }} pts</span
              >
            </div>
          </div>
        </template>
        <div v-else class="flex flex-col items-center justify-center py-16 text-center">
          <div
            class="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900"
          >
            <svg class="h-7 w-7 text-zinc-700" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <p class="text-sm font-medium text-zinc-400">No routes found</p>
          <p class="mt-1 text-xs text-zinc-500">Try adjusting your search</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import L from 'leaflet';
import { addLeafletBaseLayer, isOfflineClient } from '@/composables/maps/leafletBaseLayer';
import { Capacitor } from '@capacitor/core';
import { ActivityRecognition } from '@/src/plugins/activityRecognition';
import { buildLocalRoutesFromPlugin, utcDayKeyFromTimestamp } from '@/composables/community/localPassiveRoutes';
import { useWaitForAuth } from '~/composables/useWaitForAuth';
import { db } from '@/db/index.js';
import { syncDownFromCloudflare } from '~/db';
import { syncPassiveFromPluginToDexie } from '~/composables/passive/syncPluginPassiveToDexie';

const router = useRouter();
const waitForAuth = useWaitForAuth();

// ── State ──────────────────────────────────────────────────
const history = ref<any[]>([]);
const search = ref('');
const lastSync = ref('--:--');
const selectedRouteId = ref<number | null>(null);
const routePointsById = ref<Map<number, any[]>>(new Map());
const passivePointsByRouteId = ref<Map<number, any[]>>(new Map());
const passivePointsLoaded = ref(false);
const routePointsLoading = ref(false);
const heroMapContainer = ref<HTMLElement | null>(null);
const heroMap = ref<any>(null);
const heroLayerGroup = ref<any>(null);
const pageRoot = ref<HTMLElement | null>(null);
let leafletCssLoaded = false;

// SVG paths for mini route cards
const routeSvgPaths = reactive(new Map<number, string>());

// ── Drag / Snap Panel ──────────────────────────────────────

type Snap = 'map' | 'split' | 'list';
const panelSnap = ref<Snap>('split');
const mapHeight = ref(0);
const totalHeight = ref(0);
const HANDLE_H = 28;
const NAV_H = 64; // pb-16

// Snap positions as fraction of usable height (totalHeight - HANDLE_H)
const SNAPS: Record<Snap, number> = { map: 0.88, split: 0.52, list: 0.12 };

function usableH() {
  return (pageRoot.value?.clientHeight ?? window.innerHeight) - NAV_H - HANDLE_H;
}
function snapToMapHeight(snap: Snap) {
  return Math.round(usableH() * SNAPS[snap]);
}
function applySnap(snap: Snap, animate = true) {
  panelSnap.value = snap;
  const h = snapToMapHeight(snap);
  if (animate) {
    mapHeightAnimating.value = true;
    mapHeight.value = h;
    setTimeout(() => {
      mapHeightAnimating.value = false;
      if (heroMap.value) heroMap.value.invalidateSize();
    }, 300);
  } else {
    mapHeight.value = h;
    if (heroMap.value) heroMap.value.invalidateSize();
  }
}
const mapHeightAnimating = ref(false);

// Drag logic
let dragStartY = 0;
let dragStartH = 0;
let isDragging = false;

function startDrag(e: MouseEvent | TouchEvent) {
  isDragging = true;
  dragStartY = 'touches' in e ? e.touches[0].clientY : e.clientY;
  dragStartH = mapHeight.value;

  const onMove = (ev: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const y = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;
    const delta = y - dragStartY;
    const newH = Math.max(
      snapToMapHeight('list') - 20,
      Math.min(snapToMapHeight('map') + 20, dragStartH + delta)
    );
    mapHeight.value = newH;
    // live snap indicator
    const frac = newH / usableH();
    if (frac > 0.72) panelSnap.value = 'map';
    else if (frac > 0.32) panelSnap.value = 'split';
    else panelSnap.value = 'list';
  };

  const onEnd = () => {
    isDragging = false;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onEnd);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onEnd);
    // snap to nearest
    const frac = mapHeight.value / usableH();
    const closest = (Object.keys(SNAPS) as Snap[]).reduce((a, b) =>
      Math.abs(SNAPS[a] - frac) < Math.abs(SNAPS[b] - frac) ? a : b
    );
    applySnap(closest, true);
    // rebuild mini SVGs when going to map mode
    if (closest === 'map') buildAllSvgPaths();
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
}

// ── SVG mini path builder ──────────────────────────────────
function buildSvgPath(points: any[], W = 100, H = 100): string | null {
  const pts = points
    .map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (pts.length < 2) return null;
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats),
    maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs),
    maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;
  const pad = 10;
  return pts
    .map((p) => {
      const x = pad + ((p.lng - minLng) / lngRange) * (W - pad * 2);
      const y = pad + ((maxLat - p.lat) / latRange) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

async function buildAllSvgPaths() {
  // Build first 25 for fast initial list view
  for (const route of history.value.slice(0, 25)) {
    const id = Number(route.id);
    if (routeSvgPaths.has(id)) continue;
    const pts = await getRoutePoints(id);
    const path = buildSvgPath(pts);
    if (path) routeSvgPaths.set(id, path);
  }
}


// ── Computed ───────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────
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

async function getRoutePoints(routeId: number, withLoading = false): Promise<any[]> {
  if (routePointsById.value.has(routeId)) return routePointsById.value.get(routeId) || [];
  if (withLoading) routePointsLoading.value = true;
  try {
    const pts = await db.points.where('routeId').equals(Number(routeId)).sortBy('timestamp');
    if (pts.length) {
      routePointsById.value.set(routeId, pts);
      return pts;
    }
    await loadPassivePointsCache();
    const fallback = passivePointsByRouteId.value.get(Number(routeId)) || [];
    routePointsById.value.set(routeId, fallback);
    return fallback;
  } finally {
    if (withLoading) routePointsLoading.value = false;
  }
}
async function loadPassivePointsCache(force = false) {
  if (passivePointsLoaded.value && !force) return;
  const rows = await db.passive_locations.toArray();
  const grouped = new Map<number, any[]>();
  for (const row of rows) {
    const routeId = Number(row?.route_id ?? row?.routeId);
    const lat = Number(row?.lat),
      lng = Number(row?.lng),
      timestamp = Number(row?.timestamp || 0);
    if (!Number.isFinite(routeId) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!Number.isFinite(timestamp) || timestamp <= 0) continue;
    if (!grouped.has(routeId)) grouped.set(routeId, []);
    grouped.get(routeId)!.push({ lat, lng, timestamp, routeId, source: 'PASSIVE' });
  }
  for (const list of grouped.values())
    list.sort((a: any, b: any) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  passivePointsByRouteId.value = grouped;
  passivePointsLoaded.value = true;
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
  if (!Number.isFinite(firstTs) || !Number.isFinite(lastTs) || firstTs <= 0 || lastTs <= 0)
    return null;
  const windowStart = Math.max(0, firstTs - 2 * 60 * 1000);
  const windowEnd = lastTs + 2 * 60 * 1000;
  for (let i = passiveRows.length - 1; i >= 0; i--) {
    const ts = Number(passiveRows[i]?.timestamp || 0);
    if (ts > windowEnd) continue;
    if (ts < windowStart) break;
    return passiveRows[i];
  }
  return null;
}

async function loadHistory() {
  try {
    routePointsById.value = new Map();
    routeSvgPaths.clear();
    await loadPassivePointsCache(true);
    const routes = await db.routes.orderBy('timestamp').reverse().toArray();
    const passiveRows = await loadPassiveRowsForRoutes(routes);
    const enriched: any[] = [];
    const passiveDayKeys = new Set<string>();
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
      if (classification === 'PASSIVE' && startTimestamp > 0)
        passiveDayKeys.add(utcDayKeyFromTimestamp(startTimestamp));
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
    const localResult = await buildLocalRoutesFromPlugin(
      passiveDayKeys,
      buildRouteStory,
      distanceMeters
    );
    for (const [routeId, points] of localResult.pointsById.entries()) {
      routePointsById.value.set(routeId, points);
    }
    history.value = [...enriched, ...localResult.routes].sort(
      (a, b) =>
        Number(b.startTimestamp || b.timestamp || 0) - Number(a.startTimestamp || a.timestamp || 0)
    );
    lastSync.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    void buildAllSvgPaths();
  } catch (err) {
    console.error('Failed to load routes:', err);
  }
}

function ensureSelectedRoute() {
  if (!history.value.length) {
    selectedRouteId.value = null;
    if (heroLayerGroup.value) heroLayerGroup.value.clearLayers();
    return;
  }
  const current = Number(selectedRouteId.value);
  const hasCurrent = history.value.some((route) => Number(route.id) === current);
  if (!current || !hasCurrent) selectedRouteId.value = Number(history.value[0].id);
}

async function initHeroMap() {
  if (!heroMapContainer.value || heroMap.value) return;
  if (!leafletCssLoaded) {
    await import('leaflet/dist/leaflet.css');
    leafletCssLoaded = true;
  }
  heroMap.value = L.map(heroMapContainer.value, { zoomControl: false, attributionControl: false });
  addLeafletBaseLayer(
    L,
    heroMap.value,
    'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png',
    {
      offline: isOfflineClient(),
      onReady: () => {
        if (heroMap.value) heroMap.value.invalidateSize();
      },
      onError: () => {
        if (heroMap.value) heroMap.value.invalidateSize();
      }
    }
  );
  heroLayerGroup.value = L.layerGroup().addTo(heroMap.value);
  L.control.zoom({ position: 'bottomright' }).addTo(heroMap.value);
  heroMap.value.setView([14.5764, 121.0851], 12);
}
async function renderSelectedRouteOnHeroMap() {
  if (!heroMap.value || !heroLayerGroup.value || !selectedRouteId.value) return;
  const pts = await getRoutePoints(Number(selectedRouteId.value), true);
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
  // Pre-build SVG path for this route
  const id = Number(routeId);
  if (!routeSvgPaths.has(id)) {
    const pts = await getRoutePoints(id);
    const path = buildSvgPath(pts);
    if (path) routeSvgPaths.set(id, path);
  }
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
    const target = history.value.find((route) => Number(route.id) === Number(id));
    if (target?.localOnly) {
      history.value = history.value.filter((route) => Number(route.id) !== Number(id));
      routePointsById.value.delete(Number(id));
      routeSvgPaths.delete(Number(id));
      if (Number(selectedRouteId.value) === Number(id)) {
        const fallback = history.value[0];
        selectedRouteId.value = fallback ? Number(fallback.id) : null;
        await renderSelectedRouteOnHeroMap();
      }
      return;
    }
    await db.routes.delete(Number(id));
    await db.points.where('routeId').equals(Number(id)).delete();
    routePointsById.value.delete(Number(id));
    routeSvgPaths.delete(Number(id));
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
    if (!selectedRouteId.value || !ids.includes(Number(selectedRouteId.value)))
      selectedRouteId.value = Number(ids[0]);
    await renderSelectedRouteOnHeroMap();
  }
);

// Animate map height transitions
watch(mapHeight, () => {
  if (!mapHeightAnimating.value && heroMap.value) {
    heroMap.value.invalidateSize();
  }
});

onMounted(async () => {
  await waitForAuth();
  await syncPassiveFromPluginToDexie();
  await syncDownFromCloudflare({ includeGeofences: false, scope: 'account' });
  await loadHistory();
  await nextTick();
  // Init map height
  applySnap('split', false);
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

.fade-up-enter-active {
  transition:
    transform 250ms ease,
    opacity 250ms ease;
}
.fade-up-leave-active {
  transition:
    transform 150ms ease,
    opacity 150ms ease;
}
.fade-up-enter-from,
.fade-up-leave-to {
  transform: translateY(12px);
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

/* Map section transitions */
.relative.z-0 {
  transition: height 280ms cubic-bezier(0.32, 0.72, 0, 1);
}

.hero-map-container :deep(.leaflet-control-zoom a) {
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.8);
  border-radius: 6px;
}

:deep(.leaflet-container) {
  background: #0a0a0a !important;
}

.route-card {
  background: #1a2228;
  border: 1px solid rgba(218, 216, 207, 0.07);
  border-radius: 18px;
  overflow: hidden;
  transition: border-color 0.18s;
}
.route-card:hover {
  border-color: rgba(218, 216, 207, 0.14);
}
.route-card--selected {
  border-color: rgba(255, 78, 32, 0.45);
}

.route-card__map {
  width: 96px;
  background: #131d22;
  border-right: 1px solid rgba(218, 216, 207, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
}

.route-card__id {
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 12px;
  font-weight: 500;
  color: #8a9299;
  letter-spacing: 0.1em;
}

.route-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  font-weight: 700;
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  letter-spacing: 0.1em;
  padding: 2px 8px;
  border-radius: 20px;
}
.route-card__badge--active {
  background: rgba(255, 78, 32, 0.1);
  color: #ff4e20;
  border: 1px solid rgba(255, 78, 32, 0.22);
}
.route-card__badge--passive {
  background: rgba(96, 165, 250, 0.1);
  color: #60a5fa;
  border: 1px solid rgba(96, 165, 250, 0.22);
}
.route-card__badge-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}
.route-card__badge--active .route-card__badge-dot {
  animation: badge-blink 1.5s infinite;
}
@keyframes badge-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.2;
  }
}

.route-card__action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(218, 216, 207, 0.05);
  border: 1px solid rgba(218, 216, 207, 0.09);
  border-radius: 7px;
  padding: 4px 8px;
  font-size: 11px;
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  color: #536270;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}
.route-card__action-btn:hover {
  background: rgba(218, 216, 207, 0.1);
  color: #e4e3dc;
}
.route-card__action-btn--del:hover {
  background: rgba(255, 78, 32, 0.1);
  color: #ff4e20;
  border-color: rgba(255, 78, 32, 0.2);
}

.route-card__story {
  font-size: 12px;
  color: #536270;
  line-height: 1.5;
}

.route-card__tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: rgba(218, 216, 207, 0.04);
  border: 1px solid rgba(218, 216, 207, 0.08);
  border-radius: 20px;
  padding: 3px 9px;
  font-size: 10px;
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  color: #536270;
}
.route-card__tag--active {
  background: rgba(255, 78, 32, 0.07);
  border-color: rgba(255, 78, 32, 0.18);
  color: #ff4e20;
}
.route-card__tag--passive {
  background: rgba(96, 165, 250, 0.07);
  border-color: rgba(96, 165, 250, 0.18);
  color: #60a5fa;
}
.route-card__tag--open {
  background: rgba(77, 153, 98, 0.07);
  border-color: rgba(77, 153, 98, 0.18);
  color: #4d9962;
}
.route-card__tag--closed {
  background: rgba(255, 78, 32, 0.07);
  border-color: rgba(255, 78, 32, 0.18);
  color: #ff4e20;
}
.route-card__tag--uploaded {
  background: rgba(77, 153, 98, 0.07);
  border-color: rgba(77, 153, 98, 0.18);
  color: #4d9962;
}
.route-card__tag--pending {
  background: rgba(229, 168, 48, 0.07);
  border-color: rgba(229, 168, 48, 0.18);
  color: #e5a830;
}

.route-card__time-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 14px;
  border-top: 1px solid rgba(218, 216, 207, 0.05);
  font-size: 11px;
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  color: #2e3c45;
}
.route-card__pts {
  color: #2e3c45;
}
</style>
