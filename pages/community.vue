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

function buildPassiveStory(rawPoints: any[]): { story: string; durationLabel: string } {
  const points = [...rawPoints]
    .map((p: any) => ({
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      timestamp: Number(p?.timestamp || 0)
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!points.length) return { story: 'No route points', durationLabel: 'LOGGED' };
  if (points.length === 1) return { story: 'Single passive check-in', durationLabel: 'LOGGED' };

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
    durationLabel: formatDuration(totalDurationMs)
  };
}

function buildRouteStory(classification: string, points: any[]): { story: string; durationLabel: string } {
  if (!Array.isArray(points) || points.length === 0) {
    return { story: 'No route points', durationLabel: 'LOGGED' };
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
  return {
    story: `Active route with ${points.length} points`,
    durationLabel: sorted.length > 1 ? formatDuration(totalMs) : 'LOGGED'
  };
}

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
      const classification = safeRouteId !== null && passiveRouteIds.has(safeRouteId) ? 'PASSIVE' : 'ACTIVE';
      const narrative = buildRouteStory(classification, routePoints);
      enriched.push({
        ...r,
        pointCount: count,
        classification,
        story: narrative.story,
        durationLabel: narrative.durationLabel
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
