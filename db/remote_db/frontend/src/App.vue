<template>
  <AdminLoginView v-if="!isAuthenticated" />

  <div v-else class="iku-shell iku-grid-bg min-h-screen pb-12 font-sans text-slate-800">
    <AdminShellHeader />

    <DashboardPage v-if="currentPage === 'dashboard'" />
    <TrackingMapPage v-else-if="currentPage === 'map'" />
    <LogsPage v-else-if="currentPage === 'logs'" />
    <QueuePage v-else />

    <DayTimelineModal />
    <AdminToast />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AdminLoginView from './components/auth/AdminLoginView.vue';
import AdminShellHeader from './components/layout/AdminShellHeader.vue';
import AdminToast from './components/feedback/AdminToast.vue';
import DayTimelineModal from './components/tracking/DayTimelineModal.vue';
import { provideAdminAppContext } from './composables/useAdminAppContext';
import DashboardPage from './pages/DashboardPage.vue';
import LogsPage from './pages/LogsPage.vue';
import QueuePage from './pages/QueuePage.vue';
import TrackingMapPage from './pages/TrackingMapPage.vue';

const DEFAULT_AUTO_REFRESH_MS = 60_000;
const MAX_PASSIVE_PAGES = 3;
const PASSIVE_FETCH_LIMIT = 200;
const PASSIVE_CATCHUP_PASSES = 2;
const ACTIVE_POINTS_LIMIT = 2000;
const TIMELINE_CHUNK_MAX_GAP_MS = 15 * 60 * 1000;
const TIMELINE_CHUNK_MAX_JUMP_M = 800;
const TIMELINE_CHUNK_MAX_DURATION_MS = 90 * 60 * 1000;
const TIMELINE_PLACE_MATCH_RADIUS_M = 220;
const ROUTES_FETCH_MIN_INTERVAL_MS = 5 * 60 * 1000;

const activeUploadTab = ref('ota');
const activeHistoryTab = ref('history');
const dragOver = ref(false);
const dragOverApk = ref(false);
const router = useRouter();
const route = useRoute();

const currentPage = computed(() =>
  route.path.startsWith('/map')
    ? 'map'
    : route.path.startsWith('/queue')
      ? 'queue'
      : route.path.startsWith('/logs')
        ? 'logs'
        : 'dashboard'
);

const isAuthenticated = ref(false);
const authToken = ref(localStorage.getItem('authToken') || null);
const username = ref('');
const password = ref('');
const loggingIn = ref(false);
const loginError = ref('');

const bundles = ref([]);
const channels = reactive({});
const history = ref([]);
const apks = ref([]);
const loading = ref(false);
const uploading = ref(false);
const apkUploading = ref(false);
const selectedChannel = ref('stable');
const versionInput = ref('');
const apkVersionInput = ref('');
const uploadFile = ref(null);
const apkFile = ref(null);
const message = ref(null);
const mapContainer = ref(null);
function setMapContainer(el) {
  mapContainer.value = el;
}
const showPassiveDots = ref(true);
const showLiveDevices = ref(true);
const routeFilter = ref('ALL');
const routeListMode = ref('routes');
const selectedRouteId = ref(null);
const displayedRouteId = ref(null);
const selectedDeviceId = ref(null);
const trackingRoutes = ref([]);
const trackingPoints = ref([]);
const passiveLocations = ref([]);
const liveDevices = ref([]);
const trackingEvents = ref([]);
const backendApiLogs = ref([]);
const routePointsById = ref(new Map());
const routePointLoadingIds = ref(new Set());
const routePointsLoading = computed(() => routePointLoadingIds.value.size > 0);
const pendingRouteRender = ref(false);
const routeResolvingId = ref(null);
const passiveFetchSinceTs = ref(Date.now() - 24 * 60 * 60 * 1000);

const apiLogsSourceFilter = ref('ALL');
const apiLogsMethodFilter = ref('');
const apiLogsStatusFilter = ref('');
const apiLogsPathFilter = ref('');
const liveWindowMinutes = ref(360);

const mapAutoRefreshEnabled = ref(true);
const mapAutoRefreshMs = ref(DEFAULT_AUTO_REFRESH_MS);

let lastLiveFetchAt = 0;
const LIVE_FETCH_MIN_INTERVAL_MS = 30_000;

let mapLib = null;
let mapInstance = null;
let mapMarker = null;
let mapRouteLine = null;
let mapPassiveLayer = null;
let mapLiveLayer = null;
let mapStartMarker = null;
let mapEndMarker = null;
let mapRefreshTimer = null;
let lastRoutesFetchAt = 0;
let suppressSelectedDeviceFetch = false;
let mapHasInitialView = false;
let lastMapViewportKey = '';

const dayTimelineMapOpen = ref(false);
const dayTimelineMapLabel = ref('');
const dayTimelineMapMeta = ref('');
const selectedDaySegments = ref([]);
const daySegmentMapRefs = ref(new Map());
const daySegmentMiniMaps = ref(new Map());
const dashboardTimelineMapRefs = ref(new Map());
const dashboardTimelineMiniMaps = ref(new Map());
const dashboardTimelineDayKey = ref('');
const visitedPlaces = ref([]);
const visitedTimelineSegments = ref([]);
const visitedPlacesLoading = ref(false);
const visitedPlacesError = ref('');
const visitedTimelineDayKey = ref('');
const suppressDashboardMiniMapRender = ref(false);
const timelinePlaceAnchors = computed(() => {
  const anchors = [];
  const seen = new Set();
  const pushAnchor = (name, autoLabel, lat, lng) => {
    const resolvedName = formatVisitedLabel(name, autoLabel);
    const resolvedLat = Number(lat);
    const resolvedLng = Number(lng);
    if (!resolvedName || !Number.isFinite(resolvedLat) || !Number.isFinite(resolvedLng)) return;
    const key = `${resolvedName}:${resolvedLat.toFixed(4)}:${resolvedLng.toFixed(4)}`;
    if (seen.has(key)) return;
    seen.add(key);
    anchors.push({ name: resolvedName, lat: resolvedLat, lng: resolvedLng });
  };
  for (const place of visitedPlaces.value) {
    pushAnchor(place?.name || place?.geocodeName, place?.autoLabel, place?.lat, place?.lng);
  }
  for (const segment of visitedTimelineSegments.value) {
    if (segment?.segmentType !== 'place') continue;
    pushAnchor(segment?.labelName, segment?.autoLabel, segment?.lat, segment?.lng);
  }
  return anchors;
});

const selectedHistory = ref([]);
const selectedApks = ref([]);
const selectedBundles = ref([]);

watch(activeHistoryTab, () => {
  selectedHistory.value = [];
  selectedApks.value = [];
  selectedBundles.value = [];
});

function normalizeLogUrl(url) {
  const raw = String(url || '');
  if (!raw) return '/';
  try {
    const parsed = new URL(raw, window.location.origin);
    return `${parsed.pathname}${parsed.search || ''}`;
  } catch {
    return raw;
  }
}

function goToPage(page) {
  const path =
    page === 'map' ? '/map' : page === 'logs' ? '/logs' : page === 'queue' ? '/queue' : '/';
  if (route.path !== path) router.push(path);
}

const channelOptions = computed(() => {
  const keys = Object.keys(channels);
  return keys.length ? keys : ['stable', 'beta', 'dev'];
});

function geoDistanceMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(Number(b.lat) - Number(a.lat));
  const dLng = toRad(Number(b.lng) - Number(a.lng));
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(Number(a.lat))) * Math.cos(toRad(Number(b.lat))) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function prettyTime(ts) {
  return new Date(Number(ts || 0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRouteWindowLabel(route) {
  const start = Number(route?.startTimestamp || route?.timestamp || 0);
  const end = Number(route?.endTimestamp || start);
  if (!start) return '-';
  if (!end || end <= start) return new Date(start).toLocaleString();
  const startDate = new Date(start),
    endDate = new Date(end);
  if (startDate.toDateString() === endDate.toDateString())
    return `${startDate.toLocaleDateString()} ${prettyTime(start)} -> ${prettyTime(end)}`;
  return `${startDate.toLocaleString()} -> ${endDate.toLocaleString()}`;
}

function mergedDayRouteId(dayKey) {
  if (!dayKey) return 0;
  return -Number(String(dayKey).replace(/-/g, ''));
}

function routeDisplayLabel(route) {
  if (route?.mergedDayKey)
    return `Day ${new Date(`${route.mergedDayKey}T00:00:00`).toLocaleDateString()}`;
  return `Route #${route?.id}`;
}

function formatDurationLabel(ms) {
  const safe = Math.max(0, Number(ms || 0));
  const mins = Math.floor(safe / 60_000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60),
    m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatDistanceLabel(meters) {
  const safe = Math.max(0, Number(meters || 0));
  if (safe < 1000) return `${Math.round(safe)}m`;
  return `${(safe / 1000).toFixed(safe >= 10_000 ? 0 : 1)}km`;
}

function timelineDayKeyFromMs(ts) {
  const date = new Date(Number(ts || 0));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatVisitedLabel(name, autoLabel) {
  const trimmed = String(name || '').trim();
  if (trimmed) return trimmed;
  const normalized = String(autoLabel || '').toLowerCase();
  if (normalized === 'home') return 'Home';
  if (normalized === 'work') return 'Work';
  if (normalized === 'frequent') return 'Frequent place';
  return 'Visited place';
}

function normalizeVisitedPlace(row) {
  return {
    id: Number(row?.id),
    lat: Number(row?.centroid_lat),
    lng: Number(row?.centroid_lng),
    name: formatVisitedLabel(row?.name || row?.geocode_name, row?.auto_label),
    geocodeName: String(row?.geocode_name || ''),
    autoLabel: String(row?.auto_label || 'new'),
    visitCount: Number(row?.visit_count || 0),
    firstSeenMs: Number(row?.first_seen_ms || 0),
    lastSeenMs: Number(row?.last_seen_ms || 0)
  };
}

function normalizeVisitedTimelineSegment(row) {
  const segmentType = String(row?.segmentType || '');
  if (segmentType === 'place') {
    const arrivalMs = Number(row?.arrivalMs || row?.startMs || 0);
    const departureMs = row?.departureMs != null ? Number(row.departureMs) : arrivalMs;
    return {
      id: `place-${row?.labelId || row?.startMs || arrivalMs}`,
      segmentType,
      startMs: arrivalMs,
      endMs: departureMs,
      durationMs: Number(row?.durationMs || Math.max(0, departureMs - arrivalMs)),
      labelName: formatVisitedLabel(row?.labelName, row?.autoLabel),
      autoLabel: String(row?.autoLabel || 'new'),
      visitCount: Number(row?.visitCount || 0),
      lat: Number(row?.lat),
      lng: Number(row?.lng)
    };
  }
  const startMs = Number(row?.startMs || 0);
  const endMs = row?.endMs != null ? Number(row.endMs) : startMs;
  return {
    id: `trip-${row?.routeId || row?.startMs || startMs}`,
    segmentType,
    startMs,
    endMs,
    durationMs: Number(row?.durationMs || Math.max(0, endMs - startMs)),
    routeId: Number(row?.routeId || 0),
    distanceMeters: Number(row?.distanceMeters || 0),
    pointCount: Number(row?.pointCount || 0),
    status: String(row?.status || '')
  };
}

function normalizePassivePoints(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      id: row?.id,
      routeId: Number(row?.route_id ?? row?.routeId),
      lat: Number(row?.lat),
      lng: Number(row?.lng),
      timestamp: Number(row?.timestamp || 0),
      activityType: row?.activity_type ?? row?.activityType,
      activityConfidence: row?.activity_confidence ?? row?.activityConfidence
    }))
    .filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp)
    );
}

function normalizeRoutePoints(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      id: row?.id,
      routeId: Number(row?.routeId ?? row?.route_id),
      lat: Number(row?.lat),
      lng: Number(row?.lng),
      timestamp: Number(row?.timestamp || 0)
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
}

function markRoutePointLoading(routeId, loading) {
  const id = Number(routeId);
  if (!Number.isFinite(id) || id <= 0) return;
  const next = new Set(routePointLoadingIds.value);
  if (loading) next.add(id);
  else next.delete(id);
  routePointLoadingIds.value = next;
}

async function fetchRoutePoints(routeId, force = false) {
  const id = Number(routeId);
  if (!Number.isFinite(id) || id <= 0) return [];
  const cached = routePointsById.value.get(id);
  if (cached && !force) return cached;
  markRoutePointLoading(id, true);
  const params = new URLSearchParams();
  params.set('routeId', String(id));
  params.set('pointsLimit', String(ACTIVE_POINTS_LIMIT));
  params.set('includePassive', '0');
  params.set('includeRoutes', '0');
  params.set('includeGeofences', '0');
  try {
    const res = await authenticatedFetch(`/api/location/fetchAll?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load route points');
    const data = await res.json();
    const normalized = normalizeRoutePoints(data?.points || []);
    const next = new Map(routePointsById.value);
    next.set(id, normalized);
    routePointsById.value = next;
    return normalized;
  } finally {
    markRoutePointLoading(id, false);
  }
}

async function fetchPassiveRoutePoints(routeId, force = false) {
  const id = Number(routeId);
  if (!Number.isFinite(id) || id <= 0) return [];
  const cached = routePointsById.value.get(id);
  if (cached && !force) return cached;
  markRoutePointLoading(id, true);
  const params = new URLSearchParams();
  params.set('routeId', String(id));
  params.set('pointsLimit', String(ACTIVE_POINTS_LIMIT));
  params.set('since', '0');
  params.set('includePassive', '1');
  params.set('includeRoutes', '0');
  params.set('includeGeofences', '0');
  params.set('includePoints', '0');
  try {
    const res = await authenticatedFetch(`/api/location/fetchAll?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load passive route points');
    const data = await res.json();
    const normalized = normalizeRoutePoints(data?.passive_locations || []);
    const next = new Map(routePointsById.value);
    next.set(id, normalized);
    routePointsById.value = next;
    return normalized;
  } finally {
    markRoutePointLoading(id, false);
  }
}

function mergePassiveLocations(rows) {
  const incoming = Array.isArray(rows) ? rows : [];
  if (!incoming.length) return;
  const merged = new Map(passiveLocations.value.map((row) => [Number(row?.id), row]));
  let maxTs = passiveFetchSinceTs.value;
  for (const row of incoming) {
    const id = Number(row?.id);
    if (Number.isFinite(id)) merged.set(id, row);
    const ts = Number(row?.timestamp || 0);
    if (Number.isFinite(ts) && ts > maxTs) maxTs = ts;
  }
  passiveLocations.value = Array.from(merged.values());
  passiveFetchSinceTs.value = maxTs;
}

function buildActiveMetaStory(route) {
  const start = Number(route?.started_at || route?.timestamp || 0);
  const end = Number(route?.ended_at || route?.last_point_at || start);
  const durationMs = Math.max(0, end - start);
  const pointCount = Number(route?.point_count || 0);
  if (!start) return { story: `Active route (${pointCount || 0} points)`, durationMs: 0 };
  if (pointCount <= 1) return { story: `Active route (${pointCount || 0} point)`, durationMs };
  return {
    story: `Active route ${formatDurationLabel(durationMs)} (${pointCount} points)`,
    durationMs
  };
}

function bearingDegrees(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const y = Math.sin(toRad(Number(b.lng) - Number(a.lng))) * Math.cos(toRad(Number(b.lat)));
  const x =
    Math.cos(toRad(Number(a.lat))) * Math.sin(toRad(Number(b.lat))) -
    Math.sin(toRad(Number(a.lat))) *
      Math.cos(toRad(Number(b.lat))) *
      Math.cos(toRad(Number(b.lng) - Number(a.lng)));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function toCompass(deg) {
  if (!Number.isFinite(deg)) return 'N/A';
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][
    Math.round((((deg % 360) + 360) % 360) / 45) % 8
  ];
}

function labelFromCenter(center, knownPlaces, fallbackIndex) {
  let nearestPlace = null;
  for (const place of Array.isArray(knownPlaces) ? knownPlaces : []) {
    const distanceMeters = geoDistanceMeters(center, place);
    if (!Number.isFinite(distanceMeters) || distanceMeters > TIMELINE_PLACE_MATCH_RADIUS_M)
      continue;
    if (!nearestPlace || distanceMeters < nearestPlace.distanceMeters) {
      nearestPlace = { name: place.name, distanceMeters };
    }
  }
  if (nearestPlace?.name) return nearestPlace.name;
  return `Place ${fallbackIndex}`;
}

function summarizeTimelineSegment(segmentPoints) {
  const points = Array.isArray(segmentPoints) ? segmentPoints : [];
  if (!points.length)
    return {
      routeIds: [],
      routeLabel: '-',
      pointCount: 0,
      durationMs: 0,
      durationLabel: formatDurationLabel(0),
      displacementMeters: 0,
      hasRoute14: false
    };
  const routeIds = [
    ...new Set(points.map((p) => Number(p?.routeId)).filter((id) => Number.isFinite(id)))
  ].sort((a, b) => a - b);
  const start = points[0],
    end = points[points.length - 1];
  const durationMs = Math.max(0, Number(end?.timestamp || 0) - Number(start?.timestamp || 0));
  let displacementMeters = 0;
  for (let i = 1; i < points.length; i++)
    displacementMeters += geoDistanceMeters(points[i - 1], points[i]);
  return {
    routeIds,
    routeLabel: routeIds.length ? routeIds.map((id) => `#${id}`).join(', ') : '-',
    pointCount: points.length,
    durationMs,
    durationLabel: formatDurationLabel(durationMs),
    displacementMeters: Math.round(displacementMeters),
    hasRoute14: routeIds.includes(14)
  };
}

function buildTimeDistanceChunks(points) {
  const sorted = [...points]
    .map((p) => ({
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      timestamp: Number(p?.timestamp || 0),
      routeId: Number(p?.routeId)
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length < 2) return [];
  const chunks = [];
  let chunkStart = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1],
      cur = sorted[i];
    const gapMs = Math.max(0, cur.timestamp - prev.timestamp);
    const jumpM = geoDistanceMeters(prev, cur);
    const durationMs = Math.max(0, cur.timestamp - sorted[chunkStart].timestamp);
    if (
      gapMs > TIMELINE_CHUNK_MAX_GAP_MS ||
      jumpM > TIMELINE_CHUNK_MAX_JUMP_M ||
      durationMs > TIMELINE_CHUNK_MAX_DURATION_MS
    ) {
      chunks.push(sorted.slice(chunkStart, i));
      chunkStart = i;
    }
  }
  chunks.push(sorted.slice(chunkStart));
  return chunks
    .filter((c) => c.length >= 2)
    .map((chunk, idx) => {
      const start = chunk[0],
        end = chunk[chunk.length - 1];
      const durationMs = Math.max(0, end.timestamp - start.timestamp);
      return {
        id: `${start.timestamp}-${end.timestamp}-fallback-${idx}`,
        startStory: 'Started moving',
        endStory: `Stopped after ${formatDurationLabel(durationMs)}`,
        startTime: prettyTime(start.timestamp),
        endTime: prettyTime(end.timestamp),
        points: chunk,
        ...summarizeTimelineSegment(chunk)
      };
    });
}

function buildDayTripSegments(points, knownPlaces = []) {
  const sorted = [...points]
    .map((p) => ({
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      timestamp: Number(p?.timestamp || 0),
      routeId: Number(p?.routeId)
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length < 2) return [];
  const grouped = [];
  for (const point of sorted) {
    const routeId = Number(point.routeId);
    if (!Number.isFinite(routeId)) continue;
    const last = grouped[grouped.length - 1];
    if (!last || last.routeId !== routeId) grouped.push({ routeId, points: [point] });
    else last.points.push(point);
  }
  if (grouped.length > 1) {
    const segments = grouped
      .filter((g) => g.points.length >= 2)
      .map((g, idx) => {
        const start = g.points[0],
          end = g.points[g.points.length - 1];
        const durationMs = Math.max(0, end.timestamp - start.timestamp);
        return {
          id: `${start.timestamp}-${end.timestamp}-route-${g.routeId}-${idx}`,
          startStory: 'Started moving',
          endStory: `Stopped after ${formatDurationLabel(durationMs)}`,
          startTime: prettyTime(start.timestamp),
          endTime: prettyTime(end.timestamp),
          points: g.points,
          ...summarizeTimelineSegment(g.points)
        };
      });
    if (segments.length) return segments;
  }
  const STOP_RADIUS_M = 130,
    STOP_MIN_DURATION_MS = 20 * 60 * 1000;
  const stays = [];
  let groupStart = 0,
    sumLat = sorted[0].lat,
    sumLng = sorted[0].lng,
    groupCount = 1;
  for (let i = 1; i < sorted.length; i++) {
    const center = { lat: sumLat / groupCount, lng: sumLng / groupCount };
    const far = geoDistanceMeters(center, sorted[i]) > STOP_RADIUS_M;
    if (!far) {
      sumLat += sorted[i].lat;
      sumLng += sorted[i].lng;
      groupCount += 1;
      continue;
    }
    const startTs = sorted[groupStart].timestamp,
      endTs = sorted[i - 1].timestamp,
      durationMs = endTs - startTs;
    if (durationMs >= STOP_MIN_DURATION_MS)
      stays.push({
        startIdx: groupStart,
        endIdx: i - 1,
        start: startTs,
        end: endTs,
        center,
        durationMs
      });
    groupStart = i;
    sumLat = sorted[i].lat;
    sumLng = sorted[i].lng;
    groupCount = 1;
  }
  const finalStart = sorted[groupStart].timestamp,
    finalEnd = sorted[sorted.length - 1].timestamp,
    finalDuration = finalEnd - finalStart;
  if (finalDuration >= STOP_MIN_DURATION_MS)
    stays.push({
      startIdx: groupStart,
      endIdx: sorted.length - 1,
      start: finalStart,
      end: finalEnd,
      center: { lat: sumLat / groupCount, lng: sumLng / groupCount },
      durationMs: finalDuration
    });
  if (stays.length < 2) return buildTimeDistanceChunks(sorted);
  const segments = [];
  let idx = 1;
  for (let i = 0; i < stays.length - 1; i++) {
    const from = stays[i],
      to = stays[i + 1];
    const fromLabel = labelFromCenter(from.center, knownPlaces, idx++);
    const toLabel = labelFromCenter(to.center, knownPlaces, idx++);
    const travelMs = Math.max(0, to.start - from.end);
    const tripPoints = sorted.slice(from.endIdx, to.startIdx + 1);
    if (tripPoints.length < 2) continue;
    segments.push({
      id: `${from.start}-${to.end}-${i}`,
      startPlace: fromLabel,
      endPlace: toLabel,
      startStory: `At ${fromLabel} for ${formatDurationLabel(from.durationMs)}`,
      endStory: `Went to ${toLabel} in ${formatDurationLabel(travelMs)} • stayed ${formatDurationLabel(to.durationMs)}`,
      startTime: prettyTime(from.start),
      endTime: prettyTime(to.end),
      points: tripPoints,
      ...summarizeTimelineSegment(tripPoints)
    });
  }
  return segments.length ? segments : buildTimeDistanceChunks(sorted);
}

function buildPassiveStory(points) {
  const sorted = [...points]
    .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng), timestamp: Number(p.timestamp || 0) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length < 2)
    return { story: `Passive route with ${sorted.length} point`, durationMs: 0 };
  const totalMs = Math.max(0, sorted[sorted.length - 1].timestamp - sorted[0].timestamp);
  const dist = geoDistanceMeters(sorted[0], sorted[sorted.length - 1]);
  if (dist < 200)
    return { story: `Stayed nearby for ${formatDurationLabel(totalMs)}`, durationMs: totalMs };
  return {
    story: `Moved for ${formatDurationLabel(totalMs)} (${Math.round(dist)}m displacement)`,
    durationMs: totalMs
  };
}

function buildActiveStory(points) {
  const sorted = [...points]
    .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng), timestamp: Number(p.timestamp || 0) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length < 2)
    return { story: `Active route with ${sorted.length} point`, durationMs: 0 };
  const speeds = [],
    bearings = [];
  for (let i = 1; i < sorted.length; i++) {
    const dt = Math.max(1, (sorted[i].timestamp - sorted[i - 1].timestamp) / 1000);
    const d = geoDistanceMeters(sorted[i - 1], sorted[i]);
    if (d < 2) continue;
    speeds.push((d / dt) * 3.6);
    bearings.push(bearingDegrees(sorted[i - 1], sorted[i]));
  }
  const totalMs = Math.max(0, sorted[sorted.length - 1].timestamp - sorted[0].timestamp);
  if (!speeds.length)
    return {
      story: `Active low movement for ${formatDurationLabel(totalMs)}`,
      durationMs: totalMs
    };
  const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const max = Math.max(...speeds);
  const w = Math.max(1, Math.floor(speeds.length / 3));
  const s0 = speeds.slice(0, w).reduce((a, b) => a + b, 0) / w;
  const sN = speeds.slice(-w).reduce((a, b) => a + b, 0) / Math.max(1, speeds.slice(-w).length);
  const trend = sN > s0 + 1 ? 'sped up' : sN < s0 - 1 ? 'slowed down' : 'steady';
  const overall = toCompass(bearingDegrees(sorted[0], sorted[sorted.length - 1]));
  return {
    story: `Speed ${trend}: ${s0.toFixed(1)}→${sN.toFixed(1)} km/h • dir ${overall}`,
    durationMs: totalMs,
    activeMetrics: {
      avgSpeedKmh: avg.toFixed(1),
      maxSpeedKmh: max.toFixed(1),
      direction: overall,
      speedTrend: trend
    }
  };
}

const lastSyncedPoint = computed(
  () =>
    [...trackingPoints.value].sort(
      (a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)
    )[0] || null
);
const latestLocation = computed(() => {
  const lp = lastSyncedPoint.value;
  if (lp) return { lat: Number(lp.lat), lng: Number(lp.lng), timestamp: lp.timestamp };
  const lpa = [...passiveLocations.value].sort((a, b) => b.timestamp - a.timestamp)[0];
  if (lpa) return { lat: Number(lpa.lat), lng: Number(lpa.lng), timestamp: lpa.timestamp };
  return null;
});
const lastPassiveSampleLabel = computed(() =>
  passiveFetchSinceTs.value ? new Date(Number(passiveFetchSinceTs.value)).toLocaleString() : '-'
);

const routeSummaries = computed(() => {
  const passiveRouteIds = new Set(
    passiveLocations.value.map((pl) => Number(pl.route_id)).filter((id) => Number.isFinite(id))
  );
  const passiveByRoute = new Map();
  for (const pl of passiveLocations.value) {
    const k = Number(pl?.route_id);
    if (!Number.isFinite(k)) continue;
    if (!passiveByRoute.has(k)) passiveByRoute.set(k, []);
    passiveByRoute.get(k).push(pl);
  }
  const pointsByRoute = new Map();
  for (const p of trackingPoints.value) {
    const k = Number(p.routeId);
    if (!pointsByRoute.has(k)) pointsByRoute.set(k, []);
    pointsByRoute.get(k).push(p);
  }
  return [...trackingRoutes.value]
    .map((r) => {
      const id = Number(r.id);
      const source = String(r.source || '').toUpperCase();
      const cachedPassivePoints = routePointsById.value.get(id) || [];
      const hasCachedPassive = cachedPassivePoints.length > 0;
      const classification =
        source === 'ACTIVE'
          ? 'ACTIVE'
          : source === 'PASSIVE'
            ? 'PASSIVE'
            : hasCachedPassive
              ? 'PASSIVE'
              : passiveRouteIds.has(id)
                ? 'PASSIVE'
                : 'ACTIVE';
      const routePoints = (pointsByRoute.get(id) || []).sort(
        (a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0)
      );
      const passiveRows = (passiveByRoute.get(id) || []).sort(
        (a, b) => Number(a?.timestamp || 0) - Number(b?.timestamp || 0)
      );
      const passiveRowsForStory = hasCachedPassive ? cachedPassivePoints : passiveRows;
      const firstPointTs = Number(routePoints[0]?.timestamp || 0);
      const lastPointTs = Number(routePoints[routePoints.length - 1]?.timestamp || 0);
      const baseStart = Number(r?.started_at || r?.timestamp || 0);
      const baseEnd = Number(r?.ended_at || r?.last_point_at || baseStart);
      const passiveStart = Number(passiveRowsForStory[0]?.timestamp || 0) || baseStart;
      const passiveEnd =
        Number(passiveRowsForStory[passiveRowsForStory.length - 1]?.timestamp || 0) || passiveStart;
      const activeStart = firstPointTs || baseStart;
      const activeEnd = lastPointTs || baseEnd || activeStart;
      const narrative =
        classification === 'ACTIVE'
          ? routePoints.length
            ? buildActiveStory(routePoints)
            : buildActiveMetaStory(r)
          : buildPassiveStory(passiveRowsForStory);
      const latestPassive = passiveRows.length ? passiveRows[passiveRows.length - 1] : null;
      const avgAcc = passiveRows.length
        ? passiveRows.reduce((acc, row) => acc + Number(row?.acc || 0), 0) / passiveRows.length
        : null;
      const routePointCountServer = Number(r?.point_count || 0);
      const pointCount =
        classification === 'ACTIVE'
          ? routePoints.length || routePointCountServer
          : passiveRowsForStory.length || routePointCountServer || passiveRows.length;
      return {
        ...r,
        id,
        startTimestamp: classification === 'ACTIVE' ? activeStart : passiveStart,
        endTimestamp: classification === 'ACTIVE' ? activeEnd : passiveEnd,
        pointCount,
        classification,
        story: narrative.story,
        durationLabel: formatDurationLabel(narrative.durationMs || 0),
        activeMetrics: narrative.activeMetrics,
        routeStatus: String(r?.status || '').toUpperCase() || '-',
        routeDistanceMeters: Number(r?.distance_meters || 0),
        routePointCountServer,
        passiveSampleCount:
          passiveRowsForStory.length || routePointCountServer || passiveRows.length,
        passiveSummary: latestPassive
          ? {
              trigger: String(latestPassive?.trigger || ''),
              provider: String(latestPassive?.provider || ''),
              acc: Number(latestPassive?.acc || 0),
              vel: Number(latestPassive?.vel || 0),
              cog: Number(latestPassive?.cog || 0),
              alt: Number(latestPassive?.alt || 0),
              avgAcc: avgAcc == null || Number.isNaN(avgAcc) ? null : Number(avgAcc)
            }
          : null
      };
    })
    .filter((r) => r.pointCount > 0 || r.routePointCountServer > 0 || r.passiveSampleCount > 0)
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
});

const filteredRouteSummaries = computed(() =>
  routeFilter.value === 'ALL'
    ? routeSummaries.value
    : routeSummaries.value.filter((r) => r.classification === routeFilter.value)
);
const mergedDayRouteSummaries = computed(() =>
  passiveDayTimeline.value
    .map((day) => {
      const mergedPoints = (Array.isArray(day.routeIds) ? day.routeIds : [])
        .flatMap((rid) => {
          const cached = routePointsById.value.get(Number(rid));
          if (cached && cached.length) return cached;
          return trackingPoints.value.filter((point) => Number(point.routeId) === Number(rid));
        })
        .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
      let displacementMeters = 0;
      for (let i = 1; i < mergedPoints.length; i++)
        displacementMeters += geoDistanceMeters(mergedPoints[i - 1], mergedPoints[i]);
      const startTimestamp = Number(mergedPoints[0]?.timestamp || 0);
      const endTimestamp = Number(
        mergedPoints[mergedPoints.length - 1]?.timestamp || startTimestamp
      );
      const durationMs = Math.max(0, endTimestamp - startTimestamp);
      return {
        id: mergedDayRouteId(day.dayKey),
        mergedDayKey: day.dayKey,
        classification: 'PASSIVE',
        pointCount: mergedPoints.length,
        routePointCountServer: 0,
        passiveSampleCount: mergedPoints.length,
        startTimestamp,
        endTimestamp,
        timestamp: endTimestamp || startTimestamp,
        story: day.summary || `${day.routeCount} routes merged`,
        durationLabel: formatDurationLabel(durationMs),
        durationMs,
        routeStatus: 'DAY',
        routeDistanceMeters: Math.round(displacementMeters),
        routeCount: Number(day.routeCount || 0),
        totalPoints: Number(day.totalPoints || mergedPoints.length)
      };
    })
    .filter((route) => route.pointCount > 0)
);

const displayedRouteSummaries = computed(() =>
  routeListMode.value === 'days' ? mergedDayRouteSummaries.value : filteredRouteSummaries.value
);
const activeRouteCount = computed(
  () => routeSummaries.value.filter((r) => r.classification === 'ACTIVE').length
);
const passiveRouteCount = computed(
  () => routeSummaries.value.filter((r) => r.classification === 'PASSIVE').length
);

const pointsByRouteId = computed(() => {
  const grouped = new Map();
  for (const point of trackingPoints.value) {
    const routeId = Number(point?.routeId);
    if (!Number.isFinite(routeId)) continue;
    if (!grouped.has(routeId)) grouped.set(routeId, []);
    grouped.get(routeId).push(point);
  }
  for (const points of grouped.values())
    points.sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  return grouped;
});

const routePointsForId = (routeId) => {
  const id = Number(routeId || 0);
  if (!id) return [];
  if (id < 0) {
    const merged = mergedDayRouteSummaries.value.find((route) => Number(route.id) === id);
    if (!merged?.mergedDayKey) return [];
    return (
      passiveDayTimeline.value
        .find((day) => day.dayKey === merged.mergedDayKey)
        ?.routeIds?.flatMap((rid) => {
          const cached = routePointsById.value.get(Number(rid));
          if (cached && cached.length) return cached;
          return trackingPoints.value.filter((point) => Number(point.routeId) === Number(rid));
        })
        .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0)) || []
    );
  }
  return routePointsById.value.get(id) || pointsByRouteId.value.get(id) || [];
};

const selectedRoutePointsLoading = computed(() => {
  const id = Number(selectedRouteId.value || 0);
  if (!id) return false;
  if (id < 0) return false;
  return routePointLoadingIds.value.has(id) || Number(routeResolvingId.value || 0) === id;
});
const renderedRouteId = computed(() => {
  if (!selectedRouteId.value) return null;
  if (selectedRoutePointsLoading.value && displayedRouteId.value) return displayedRouteId.value;
  return selectedRouteId.value;
});
const selectedRoutePoints = computed(() =>
  !renderedRouteId.value ? [] : routePointsForId(renderedRouteId.value)
);
const latestLocationLabel = computed(() =>
  !latestLocation.value
    ? 'No synced point yet'
    : `${Number(latestLocation.value.lat).toFixed(6)}, ${Number(latestLocation.value.lng).toFixed(6)}`
);

const passiveStayGroups = computed(() => {
  if (!Array.isArray(passiveLocations.value) || !passiveLocations.value.length) return [];
  const sorted = [...passiveLocations.value]
    .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng), timestamp: Number(p.timestamp || 0) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (!sorted.length) return [];
  const DIST_THRESHOLD_M = 40,
    MAX_GAP_MS = 15 * 60 * 1000;
  const groups = [];
  let current = {
    start: sorted[0].timestamp,
    end: sorted[0].timestamp,
    lat: sorted[0].lat,
    lng: sorted[0].lng,
    count: 1
  };
  for (let i = 1; i < sorted.length; i++) {
    const point = sorted[i],
      prevPoint = sorted[i - 1];
    const gap = point.timestamp - prevPoint.timestamp;
    const dist = geoDistanceMeters(current, point);
    if (gap <= MAX_GAP_MS && dist <= DIST_THRESHOLD_M) {
      current.end = point.timestamp;
      current.count += 1;
      current.lat = (current.lat * (current.count - 1) + point.lat) / current.count;
      current.lng = (current.lng * (current.count - 1) + point.lng) / current.count;
      continue;
    }
    groups.push(current);
    current = {
      start: point.timestamp,
      end: point.timestamp,
      lat: point.lat,
      lng: point.lng,
      count: 1
    };
  }
  groups.push(current);
  return groups;
});

const passiveDayTimeline = computed(() => {
  const buckets = new Map();
  for (const route of routeSummaries.value
    .filter((r) => r.classification === 'PASSIVE')
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0))) {
    const ts = Number(route.timestamp || 0);
    if (!Number.isFinite(ts) || ts <= 0) continue;
    const d = new Date(ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(route);
  }
  return [...buckets.entries()]
    .map(([dayKey, routes]) => {
      const routeIds = routes.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
      const totalPoints = routes.reduce((acc, r) => acc + Number(r.pointCount || 0), 0);
      const date = new Date(`${dayKey}T00:00:00`);
      const narrative = routes
        .slice(0, 3)
        .map((r) => String(r.story || `Route #${r.id}`))
        .join(' • ');
      return {
        dayKey,
        label: date.toLocaleDateString(),
        routeCount: routes.length,
        routeIds,
        totalPoints,
        summary: narrative || `${routes.length} routes • ${totalPoints} points`,
        events: narrative
          ? narrative
              .split(' • ')
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 4)
          : [`${routes.length} routes visited`, `${totalPoints} points logged`]
      };
    })
    .sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))
    .slice(0, 7);
});

const visitedTimelineDays = computed(() => {
  const buckets = new Map();
  for (const segment of visitedTimelineSegments.value
    .filter((segment) => Number.isFinite(Number(segment.startMs)) && Number(segment.startMs) > 0)
    .sort((a, b) => Number(a.startMs || 0) - Number(b.startMs || 0))) {
    const dayKey = timelineDayKeyFromMs(segment.startMs);
    if (!buckets.has(dayKey)) buckets.set(dayKey, []);
    buckets.get(dayKey).push(segment);
  }
  return [...buckets.entries()]
    .map(([dayKey, segments]) => {
      const date = new Date(`${dayKey}T00:00:00`);
      const places = segments.filter((segment) => segment.segmentType === 'place');
      const trips = segments.filter((segment) => segment.segmentType === 'trip');
      return {
        dayKey,
        label: date.toLocaleDateString(),
        segments,
        placeCount: places.length,
        tripCount: trips.length,
        summary:
          places.length > 0
            ? places
                .slice(0, 2)
                .map((segment) => segment.labelName)
                .filter(Boolean)
                .join(' • ')
            : `${trips.length} trips recorded`
      };
    })
    .sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))
    .slice(0, 7);
});

const visitedTimelineActiveDay = computed(() => {
  const days = visitedTimelineDays.value;
  if (!days.length) return null;
  return days.find((day) => day.dayKey === visitedTimelineDayKey.value) || days[0];
});

const visitedTimelineRows = computed(() =>
  (visitedTimelineActiveDay.value?.segments || []).map((segment) => {
    if (segment.segmentType === 'place') {
      return {
        ...segment,
        title: segment.labelName,
        eyebrow: 'Place',
        metaLabel: `${formatDurationLabel(segment.durationMs)} stay`,
        detailLabel: `${Math.max(1, Number(segment.visitCount || 0))} visits`,
        rangeLabel: `${prettyTime(segment.startMs)} - ${prettyTime(segment.endMs)}`
      };
    }
    return {
      ...segment,
      title: `Trip #${segment.routeId || '-'}`,
      eyebrow: 'Trip',
      metaLabel: formatDistanceLabel(segment.distanceMeters),
      detailLabel: `${Math.max(0, Number(segment.pointCount || 0))} pts`,
      rangeLabel: `${prettyTime(segment.startMs)} - ${prettyTime(segment.endMs)}`
    };
  })
);

const visitedTimelineStats = computed(() => {
  const segments = visitedTimelineActiveDay.value?.segments || [];
  const placeCount = segments.filter((segment) => segment.segmentType === 'place').length;
  const tripSegments = segments.filter((segment) => segment.segmentType === 'trip');
  return {
    placeCount,
    tripCount: tripSegments.length,
    distanceLabel: formatDistanceLabel(
      tripSegments.reduce((acc, segment) => acc + Number(segment.distanceMeters || 0), 0)
    ),
    durationLabel: formatDurationLabel(
      segments.reduce((acc, segment) => acc + Number(segment.durationMs || 0), 0)
    )
  };
});

const visitedTopPlaces = computed(() =>
  visitedPlaces.value
    .slice()
    .sort((a, b) => Number(b.visitCount || 0) - Number(a.visitCount || 0))
    .slice(0, 6)
);

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
  const routePoints = ids
    .flatMap((rid) => {
      const cached = routePointsById.value.get(Number(rid));
      if (cached && cached.length) return cached;
      return trackingPoints.value.filter((p) => Number(p.routeId) === Number(rid));
    })
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  return buildDayTripSegments(routePoints, timelinePlaceAnchors.value);
});

function segmentStartPlace(story) {
  const m = String(story || '').match(/^At\s+(.+?)\s+for\s+/i);
  return m?.[1] || 'Origin';
}
function segmentEndPlace(story) {
  const m = String(story || '').match(/^Went to\s+(.+?)\s+in\s+/i);
  return m?.[1] || 'Destination';
}
function segmentTravelMode(segment) {
  const durationHours = Math.max(0.01, Number(segment?.durationMs || 0) / 3_600_000);
  const distanceKm = Math.max(0, Number(segment?.displacementMeters || 0) / 1000);
  const speedKmh = distanceKm / durationHours;
  if (speedKmh < 8) return 'Walk';
  if (speedKmh < 22) return 'Bike';
  return 'Drive';
}

const dashboardTimelineRows = computed(() =>
  dashboardTimelineActiveSegments.value.map((segment, index) => ({
    ...segment,
    timelineIndex: index + 1,
    startPlace: segment.startPlace || segmentStartPlace(segment.startStory),
    endPlace: segment.endPlace || segmentEndPlace(segment.endStory),
    mode: segmentTravelMode(segment),
    rangeLabel: `${segment.startTime} - ${segment.endTime}`
  }))
);
const dashboardTimelineStats = computed(() => {
  const segments = dashboardTimelineActiveSegments.value;
  return {
    tripCount: segments.length,
    displacementLabel: `${Math.round(segments.reduce((acc, s) => acc + Number(s.displacementMeters || 0), 0))}m`,
    durationLabel: formatDurationLabel(
      segments.reduce((acc, s) => acc + Number(s.durationMs || 0), 0)
    )
  };
});

const currentStaySummary = computed(() => {
  if (!passiveStayGroups.value.length) return null;
  const last = passiveStayGroups.value[passiveStayGroups.value.length - 1];
  const durationMs = Math.max(0, Number(last.end) - Number(last.start));
  const hours = Math.floor(durationMs / (60 * 60 * 1000)),
    minutes = Math.floor((durationMs % (60 * 60 * 1000)) / (60 * 1000));
  return {
    ...last,
    durationMs,
    durationLabel: `${hours}h ${minutes}m`,
    startedAtLabel: new Date(Number(last.start)).toLocaleString(),
    endedAtLabel: new Date(Number(last.end)).toLocaleString()
  };
});

function formatAgeLabel(timestamp) {
  const ageMs = Math.max(0, Date.now() - Number(timestamp || 0));
  if (ageMs < 60_000) return `${Math.floor(ageMs / 1000)}s`;
  if (ageMs < 3_600_000) return `${Math.floor(ageMs / 60_000)}m`;
  return `${Math.floor(ageMs / 3_600_000)}h`;
}

function freshnessClassForTs(timestamp) {
  const ageMs = Math.max(0, Date.now() - Number(timestamp || 0));
  if (ageMs < 5 * 60_000) return 'text-emerald-600';
  if (ageMs < 30 * 60_000) return 'text-amber-600';
  return 'text-rose-600';
}

watch([latestLocation, selectedRouteId], async () => {
  if (selectedRoutePointsLoading.value) return;
  await renderMap();
  syncMapViewport();
});

watch(selectedRouteId, async (next, prev) => {
  if (currentPage.value !== 'map') return;
  if (!next || next === prev) {
    if (!next) displayedRouteId.value = null;
    await renderMap();
    syncMapViewport();
    return;
  }
  if (Number(next) < 0) {
    displayedRouteId.value = Number(next);
    await renderMap();
    syncMapViewport({ force: true });
    return;
  }
  const cached = routePointsForId(next);
  if (cached && cached.length) {
    displayedRouteId.value = Number(next);
    await renderMap();
    syncMapViewport({ force: true });
    return;
  }
  pendingRouteRender.value = true;
  routeResolvingId.value = Number(next);
  try {
    const passiveFirst = await fetchPassiveRoutePoints(next, true);
    if (!passiveFirst.length) await fetchRoutePoints(next);
  } catch (err) {
    console.error(err);
  } finally {
    if (Number(selectedRouteId.value || 0) === Number(next)) displayedRouteId.value = Number(next);
    pendingRouteRender.value = false;
    if (Number(routeResolvingId.value || 0) === Number(next)) routeResolvingId.value = null;
  }
  await renderMap();
  syncMapViewport({ force: true });
});

watch(
  () => [
    currentPage.value,
    selectedRouteId.value,
    selectedRoutePoints.value.length,
    selectedRoutePointsLoading.value
  ],
  async ([page, routeId, pointsLen, loading]) => {
    if (page !== 'map') return;
    if (!routeId) return;
    if (loading) return;
    if (pointsLen <= 0) return;
    await nextTick();
    await renderMap();
    syncMapViewport();
  }
);

watch(
  routeSummaries,
  async () => {
    if (currentPage.value !== 'map') return;
    if (!selectedRouteId.value) return;
    if (selectedRoutePointsLoading.value) return;
    if (selectedRoutePoints.value.length > 0) return;
    await ensureSelectedRoutePoints();
  },
  { flush: 'post' }
);

async function ensureSelectedRoutePoints() {
  const next = Number(selectedRouteId.value || 0);
  if (!next || selectedRoutePointsLoading.value) return;
  if (next < 0) {
    displayedRouteId.value = next;
    return;
  }
  const cached = routePointsForId(next);
  if (cached && cached.length) return;
  pendingRouteRender.value = true;
  routeResolvingId.value = next;
  try {
    const passiveFirst = await fetchPassiveRoutePoints(next, true);
    if (!passiveFirst.length) await fetchRoutePoints(next);
  } catch (err) {
    console.error(err);
  } finally {
    if (Number(selectedRouteId.value || 0) === next) displayedRouteId.value = next;
    pendingRouteRender.value = false;
    if (Number(routeResolvingId.value || 0) === next) routeResolvingId.value = null;
  }
}

async function enterMapPage() {
  await fetchTrackingSnapshot({
    forceRoutes: true,
    includePassive: true,
    includeLive: true,
    includeEvents: true
  });
  await prefetchRecentPassiveRoutePoints();
  await ensureSelectedRoutePoints();
  await nextTick();
  await new Promise((r) => setTimeout(r, 50));
  await renderMap();
  syncMapViewport({ force: true });
  restartMapAutoRefresh();
  clearDashboardTimelineMiniMaps();
  if (mapInstance) setTimeout(() => mapInstance.invalidateSize(), 80);
}

async function ensureTimelineRoutePoints(routeIds) {
  const ids = Array.isArray(routeIds)
    ? routeIds.map((rid) => Number(rid)).filter((id) => Number.isFinite(id) && id > 0)
    : [];
  if (!ids.length) return;
  const summaries = new Map(routeSummaries.value.map((route) => [Number(route.id), route]));
  const targets = ids.filter((id) => {
    const cached = routePointsById.value.get(id) || [];
    return cached.length < 2;
  });
  if (!targets.length) return;
  pendingRouteRender.value = true;
  suppressDashboardMiniMapRender.value = true;
  try {
    await Promise.all(
      targets.map(async (id) => {
        const summary = summaries.get(id);
        if (summary?.classification === 'PASSIVE') await fetchPassiveRoutePoints(id, true);
        else await fetchRoutePoints(id, true);
      })
    );
  } finally {
    pendingRouteRender.value = false;
    suppressDashboardMiniMapRender.value = false;
  }
}

async function enterDashboardPage() {
  await fetchTrackingSnapshot({
    forceRoutes: true,
    includePassive: false,
    includeLive: false,
    includeEvents: false
  });
  await fetchVisitedPlacesData();
  await nextTick();
  const day = dashboardTimelineActiveDay.value;
  if (day?.routeIds?.length) await ensureTimelineRoutePoints(day.routeIds);
  await renderDashboardTimelineMiniMaps();
}

async function enterLogsPage() {
  closeDayTimelineMap();
  clearDashboardTimelineMiniMaps();
  await fetchApiAccessLogs();
}

function enterQueuePage() {
  closeDayTimelineMap();
  clearDashboardTimelineMiniMaps();
}

async function finalizeCurrentPageAfterDataLoad() {
  if (currentPage.value === 'map') {
    await prefetchRecentPassiveRoutePoints();
    await ensureSelectedRoutePoints();
    await nextTick();
    await new Promise((r) => setTimeout(r, 50));
    await renderMap();
    syncMapViewport({ force: true });
    restartMapAutoRefresh();
    clearDashboardTimelineMiniMaps();
    if (mapInstance) setTimeout(() => mapInstance.invalidateSize(), 80);
    return;
  }
  teardownMap();
  stopMapAutoRefresh();
  if (currentPage.value === 'dashboard') {
    await fetchVisitedPlacesData();
    await nextTick();
    const day = dashboardTimelineActiveDay.value;
    if (day?.routeIds?.length) await ensureTimelineRoutePoints(day.routeIds);
    await renderDashboardTimelineMiniMaps();
    return;
  }
  if (currentPage.value === 'queue') {
    closeDayTimelineMap();
    clearDashboardTimelineMiniMaps();
    return;
  }
  closeDayTimelineMap();
  clearDashboardTimelineMiniMaps();
  await fetchApiAccessLogs();
}

watch(currentPage, async (page) => {
  if (!isAuthenticated.value) {
    teardownMap();
    stopMapAutoRefresh();
    return;
  }
  if (page === 'map') {
    await enterMapPage();
    return;
  }
  teardownMap();
  stopMapAutoRefresh();
  if (page === 'queue') {
    enterQueuePage();
    return;
  }
  if (page === 'dashboard') {
    await enterDashboardPage();
    return;
  }
  await enterLogsPage();
});

watch([mapAutoRefreshEnabled, mapAutoRefreshMs], () => {
  if (currentPage.value === 'map') restartMapAutoRefresh();
});
watch(showPassiveDots, () => {
  renderMap();
});
watch(showLiveDevices, () => {
  renderMap();
});
watch(
  passiveDayTimeline,
  (days) => {
    if (!days.length) {
      dashboardTimelineDayKey.value = '';
      return;
    }
    if (!days.some((day) => day.dayKey === dashboardTimelineDayKey.value))
      dashboardTimelineDayKey.value = days[0].dayKey;
  },
  { immediate: true }
);
watch(
  visitedTimelineDays,
  (days) => {
    if (!days.length) {
      visitedTimelineDayKey.value = '';
      return;
    }
    if (!days.some((day) => day.dayKey === visitedTimelineDayKey.value))
      visitedTimelineDayKey.value = days[0].dayKey;
  },
  { immediate: true }
);
watch(
  dashboardTimelineActiveDay,
  async (day) => {
    if (currentPage.value !== 'dashboard') return;
    if (day?.routeIds?.length) await ensureTimelineRoutePoints(day.routeIds);
  },
  { flush: 'post' }
);
watch(
  dashboardTimelineRows,
  async () => {
    if (suppressDashboardMiniMapRender.value) return;
    if (currentPage.value === 'dashboard') await renderDashboardTimelineMiniMaps();
  },
  { flush: 'post' }
);
watch(liveWindowMinutes, () => {
  if (currentPage.value === 'map') fetchTrackingSnapshot();
});
watch(selectedDeviceId, async (next, prev) => {
  if (suppressSelectedDeviceFetch) {
    suppressSelectedDeviceFetch = false;
    await renderMap();
    syncMapViewport({ force: true });
    return;
  }
  if (next !== prev) {
    trackingRoutes.value = [];
    trackingPoints.value = [];
    passiveLocations.value = [];
    passiveFetchSinceTs.value = 0;
    selectedRouteId.value = null;
    const onMap = currentPage.value === 'map';
    await fetchTrackingSnapshot({
      forceRoutes: true,
      includePassive: onMap,
      includeLive: onMap,
      includeEvents: onMap
    });
    if (currentPage.value === 'dashboard') await fetchVisitedPlacesData();
  }
  await renderMap();
  syncMapViewport({ force: true });
});

async function handleLogin() {
  loggingIn.value = true;
  loginError.value = '';
  try {
    const res = await loggedFetch(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.value, password: password.value })
      },
      false
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    authToken.value = data.token;
    localStorage.setItem('authToken', data.token);
    isAuthenticated.value = true;
    await fetchAll();
  } catch (err) {
    loginError.value = err.message;
  } finally {
    loggingIn.value = false;
  }
}

function handleLogout() {
  clearClientSession();
}

function clearClientSession() {
  stopMapAutoRefresh();
  teardownMap();
  closeDayTimelineMap();
  clearDashboardTimelineMiniMaps();
  const prevToken = authToken.value;
  if (prevToken)
    loggedFetch(
      '/api/auth/logout',
      { method: 'POST', headers: { Authorization: `Bearer ${prevToken}` } },
      false
    ).catch(() => {});
  localStorage.removeItem('authToken');
  authToken.value = null;
  isAuthenticated.value = false;
  bundles.value = [];
  Object.keys(channels).forEach((k) => delete channels[k]);
  history.value = [];
  apks.value = [];
  trackingRoutes.value = [];
  trackingPoints.value = [];
  passiveLocations.value = [];
  passiveFetchSinceTs.value = 0;
  selectedRouteId.value = null;
  selectedDeviceId.value = null;
}

async function verifyToken() {
  if (!authToken.value) {
    isAuthenticated.value = false;
    return false;
  }
  try {
    const res = await authenticatedFetch('/api/auth/me');
    if (!res.ok) throw new Error('Invalid session');
    isAuthenticated.value = true;
    return true;
  } catch {
    localStorage.removeItem('authToken');
    authToken.value = null;
    isAuthenticated.value = false;
    return false;
  }
}

async function authenticatedFetch(url, options = {}) {
  return loggedFetch(url, options, true);
}

async function loggedFetch(url, options = {}, requireAuth = false) {
  const headers = requireAuth
    ? { ...options.headers, Authorization: `Bearer ${authToken.value}` }
    : { ...options.headers };
  const res = await fetch(url, { ...options, headers });
  if (requireAuth && res.status === 401) {
    clearClientSession();
    throw new Error('Session expired. Please log in again.');
  }
  return res;
}

async function loadLeaflet() {
  if (mapLib) return mapLib;
  if (window.L) {
    mapLib = window.L;
    return mapLib;
  }
  if (!document.getElementById('leaflet-css')) {
    const css = document.createElement('link');
    css.id = 'leaflet-css';
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
  }
  if (!document.getElementById('leaflet-js')) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load map library'));
      document.body.appendChild(script);
    });
  }
  mapLib = window.L;
  return mapLib;
}

async function ensureMap() {
  if (!mapContainer.value) return null;
  const L = await loadLeaflet();
  if (mapInstance) return mapInstance;
  mapInstance = L.map(mapContainer.value, { zoomControl: false, attributionControl: false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(mapInstance);
  const initial = await getInitialLatLng();
  mapInstance.setView([initial.lat, initial.lng], 17);
  return mapInstance;
}

async function getInitialLatLng() {
  try {
    const pos = await new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('geolocation_unavailable'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });
    return { lat: Number(pos.coords.latitude), lng: Number(pos.coords.longitude) };
  } catch {
    return { lat: 14.5995, lng: 120.9842 };
  }
}

function currentMapViewportKey() {
  if (selectedRoutePoints.value.length > 1 && renderedRouteId.value)
    return `route:${Number(renderedRouteId.value)}`;
  if (selectedDeviceId.value) return `device:${selectedDeviceId.value}`;
  if (latestLocation.value) return 'latest';
  return '';
}

function syncMapViewport(options = {}) {
  if (!mapInstance || !mapLib) return;
  const { force = false } = options;
  const nextKey = currentMapViewportKey();
  if (!nextKey) return;
  if (!force && mapHasInitialView && lastMapViewportKey === nextKey) return;
  const L = mapLib;
  if (selectedRoutePoints.value.length > 1) {
    mapInstance.fitBounds(
      L.latLngBounds(selectedRoutePoints.value.map((p) => L.latLng(Number(p.lat), Number(p.lng)))),
      { padding: [24, 24] }
    );
  } else if (selectedDeviceId.value) {
    const selected = liveDevices.value.find((device) => device.deviceId === selectedDeviceId.value);
    if (selected)
      mapInstance.setView([Number(selected.lat), Number(selected.lng)], 15, { animate: force });
  } else if (latestLocation.value) {
    mapInstance.setView([latestLocation.value.lat, latestLocation.value.lng], 15, {
      animate: force
    });
  }
  mapHasInitialView = true;
  lastMapViewportKey = nextKey;
}

async function renderMap() {
  if (!isAuthenticated.value) return;
  const map = await ensureMap();
  if (!map) return;
  const L = mapLib;
  if (mapMarker) {
    map.removeLayer(mapMarker);
    mapMarker = null;
  }
  if (mapRouteLine) {
    map.removeLayer(mapRouteLine);
    mapRouteLine = null;
  }
  if (mapPassiveLayer) {
    map.removeLayer(mapPassiveLayer);
    mapPassiveLayer = null;
  }
  if (mapLiveLayer) {
    map.removeLayer(mapLiveLayer);
    mapLiveLayer = null;
  }
  if (mapStartMarker) {
    map.removeLayer(mapStartMarker);
    mapStartMarker = null;
  }
  if (mapEndMarker) {
    map.removeLayer(mapEndMarker);
    mapEndMarker = null;
  }

  if (latestLocation.value) {
    mapMarker = L.circleMarker([latestLocation.value.lat, latestLocation.value.lng], {
      radius: 7,
      color: '#fb923c',
      fillColor: '#fdba74',
      fillOpacity: 0.95,
      weight: 2
    }).addTo(map);
  }

  if (selectedRoutePoints.value.length > 1) {
    const coords = selectedRoutePoints.value.map((p) => [Number(p.lat), Number(p.lng)]);
    const selectedRoute =
      displayedRouteSummaries.value.find((r) => Number(r.id) === Number(renderedRouteId.value)) ||
      routeSummaries.value.find((r) => Number(r.id) === Number(renderedRouteId.value));
    const routeColor = selectedRoute?.classification === 'ACTIVE' ? '#10b981' : '#f97316';
    mapRouteLine = L.polyline(coords, { color: routeColor, weight: 4, opacity: 0.85 }).addTo(map);
    mapStartMarker = L.circleMarker(coords[0], {
      radius: 5,
      color: '#0f766e',
      fillColor: '#14b8a6',
      fillOpacity: 0.9,
      weight: 2
    }).addTo(map);
    mapEndMarker = L.circleMarker(coords[coords.length - 1], {
      radius: 6,
      color: '#92400e',
      fillColor: '#fb923c',
      fillOpacity: 1,
      weight: 2
    }).addTo(map);
    return;
  }

  if (showPassiveDots.value && passiveLocations.value.length > 0) {
    const dots = [...passiveLocations.value]
      .slice(-300)
      .map((p) => {
        const lat = Number(p.lat),
          lng = Number(p.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return L.circleMarker([lat, lng], {
          radius: 2,
          color: '#0369a1',
          fillColor: '#38bdf8',
          fillOpacity: 0.45,
          weight: 1
        });
      })
      .filter(Boolean);
    if (dots.length) mapPassiveLayer = L.layerGroup(dots).addTo(map);
  }

  if (showLiveDevices.value && liveDevices.value.length > 0) {
    const markers = liveDevices.value
      .map((d) => {
        const lat = Number(d.lat),
          lng = Number(d.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const selected = selectedDeviceId.value && selectedDeviceId.value === d.deviceId;
        const marker = L.circleMarker([lat, lng], {
          radius: selected ? 8 : 6,
          color: selected ? '#9a3412' : '#334155',
          fillColor:
            d.freshnessClass === 'text-emerald-600'
              ? '#10b981'
              : d.freshnessClass === 'text-amber-600'
                ? '#f59e0b'
                : '#f43f5e',
          fillOpacity: selected ? 0.95 : 0.8,
          weight: 2
        });
        marker.on('click', () => {
          selectedDeviceId.value = d.deviceId;
        });
        return marker;
      })
      .filter(Boolean);
    if (markers.length) mapLiveLayer = L.layerGroup(markers).addTo(map);
  }
}

function fitMapToData() {
  if (!mapInstance || !mapLib) return;
  const L = mapLib;
  if (selectedRoutePoints.value.length > 1) {
    mapInstance.fitBounds(
      L.latLngBounds(selectedRoutePoints.value.map((p) => L.latLng(Number(p.lat), Number(p.lng)))),
      { padding: [24, 24] }
    );
    return;
  }
  const points = [...trackingPoints.value].slice(-400);
  if (!points.length) {
    if (latestLocation.value)
      mapInstance.setView([latestLocation.value.lat, latestLocation.value.lng], 15);
    return;
  }
  mapInstance.fitBounds(L.latLngBounds(points.map((p) => L.latLng(Number(p.lat), Number(p.lng)))), {
    padding: [24, 24]
  });
}

async function refreshTrackingNow() {
  await fetchTrackingSnapshot({
    forceRoutes: true,
    includePassive: true,
    includeLive: currentPage.value === 'map',
    includeEvents: currentPage.value === 'map'
  });
  await prefetchRecentPassiveRoutePoints();
  if (selectedRouteId.value && Number(selectedRouteId.value) > 0) {
    try {
      const routeSummary = routeSummaries.value.find(
        (r) => Number(r.id) === Number(selectedRouteId.value)
      );
      if (routeSummary?.classification === 'PASSIVE')
        await fetchPassiveRoutePoints(selectedRouteId.value, true);
      else await fetchRoutePoints(selectedRouteId.value, true);
    } catch (err) {
      console.error(err);
    }
  }
  await ensureSelectedRoutePoints();
  fitMapToData();
}

function teardownMap() {
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  mapHasInitialView = false;
  lastMapViewportKey = '';
  mapMarker = null;
  mapRouteLine = null;
  mapPassiveLayer = null;
  mapLiveLayer = null;
  mapStartMarker = null;
  mapEndMarker = null;
}

async function prefetchRecentPassiveRoutePoints() {
  if (routePointsLoading.value || pendingRouteRender.value) return;
  const candidates = routeSummaries.value
    .filter((r) => {
      const id = Number(r.id);
      if (!id) return false;
      if (routePointsById.value.get(id)?.length) return false;
      const source = String(r.source || '').toUpperCase();
      return (
        r.classification === 'PASSIVE' ||
        source === 'PASSIVE' ||
        Number(r.routePointCountServer || 0) === 0
      );
    })
    .sort((a, b) => Number(b.startTimestamp || 0) - Number(a.startTimestamp || 0))
    .slice(0, 3);
  if (!candidates.length) return;
  pendingRouteRender.value = true;
  try {
    for (const route of candidates) await fetchPassiveRoutePoints(route.id, true);
  } catch (err) {
    console.error(err);
  } finally {
    pendingRouteRender.value = false;
  }
}

function focusSelectedDevice() {
  syncMapViewport({ force: true });
}
function focusDevice(deviceId) {
  selectedDeviceId.value = deviceId;
}
function selectDashboardTimelineDay(dayKey) {
  dashboardTimelineDayKey.value = String(dayKey || '');
}

function stopMapAutoRefresh() {
  if (mapRefreshTimer) {
    clearInterval(mapRefreshTimer);
    mapRefreshTimer = null;
  }
}

function restartMapAutoRefresh() {
  stopMapAutoRefresh();
  if (!mapAutoRefreshEnabled.value) return;
  mapRefreshTimer = setInterval(
    () => {
      if (currentPage.value === 'map' && document.visibilityState === 'visible')
        fetchTrackingSnapshot();
    },
    Number(mapAutoRefreshMs.value || DEFAULT_AUTO_REFRESH_MS)
  );
}

async function fetchLiveDevices(force = false) {
  const now = Date.now();
  if (!force && now - lastLiveFetchAt < LIVE_FETCH_MIN_INTERVAL_MS) return;
  lastLiveFetchAt = now;
  const res = await authenticatedFetch(
    `/api/location/live?windowMinutes=${Number(liveWindowMinutes.value || 360)}`
  );
  if (!res.ok) throw new Error('Failed to load live devices');
  const data = await res.json();
  const devices = Array.isArray(data?.devices) ? data.devices : [];
  liveDevices.value = devices
    .map((d) => ({
      ...d,
      deviceLabel: String(d.accountKey || d.deviceId || 'unknown-device').slice(0, 16),
      ageMs: Math.max(0, now - Number(d.timestamp || 0)),
      ageLabel: formatAgeLabel(Number(d.timestamp || 0)),
      freshnessClass: freshnessClassForTs(Number(d.timestamp || 0))
    }))
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  if (!selectedDeviceId.value && liveDevices.value.length === 1) {
    suppressSelectedDeviceFetch = true;
    selectedDeviceId.value = liveDevices.value[0].deviceId;
  }
  if (
    selectedDeviceId.value &&
    !liveDevices.value.some((d) => d.deviceId === selectedDeviceId.value)
  )
    selectedDeviceId.value = null;
}

async function fetchTrackingEvents() {
  const res = await authenticatedFetch('/api/location/events?limit=120');
  if (!res.ok) throw new Error('Failed to load tracking events');
  const data = await res.json();
  trackingEvents.value = Array.isArray(data?.events) ? data.events : [];
}

async function fetchApiAccessLogs() {
  const params = new URLSearchParams();
  params.set('limit', '180');
  if (apiLogsSourceFilter.value && apiLogsSourceFilter.value !== 'ALL')
    params.set('source', apiLogsSourceFilter.value);
  if (apiLogsMethodFilter.value) params.set('method', apiLogsMethodFilter.value);
  const statusVal = Number(apiLogsStatusFilter.value);
  if (Number.isFinite(statusVal) && statusVal >= 100 && statusVal <= 599)
    params.set('status', String(Math.floor(statusVal)));
  if (apiLogsPathFilter.value.trim()) params.set('pathContains', apiLogsPathFilter.value.trim());
  const res = await authenticatedFetch(`/api/location/api-logs?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load API access logs');
  const data = await res.json();
  backendApiLogs.value = Array.isArray(data?.logs) ? data.logs : [];
}

async function fetchTrackingSnapshot(options = {}) {
  const {
    forceRoutes = false,
    includePassive = currentPage.value === 'map',
    includeLive = currentPage.value === 'map',
    includeEvents = currentPage.value === 'map'
  } = options || {};
  try {
    const deviceId = selectedDeviceId.value || '';
    const activeRouteId = Number(selectedRouteId.value || 0);
    const includeRoutePoints = false;
    const includeRoutes =
      forceRoutes ||
      trackingRoutes.value.length === 0 ||
      Date.now() - lastRoutesFetchAt >= ROUTES_FETCH_MIN_INTERVAL_MS;
    const includeGeofences = false;

    if (currentPage.value === 'map') {
      const tasks = [];
      if (includeLive) tasks.push(fetchLiveDevices());
      if (includeEvents) tasks.push(fetchTrackingEvents());
      if (tasks.length) await Promise.allSettled(tasks);
    }

    if (!includePassive) {
      const params = new URLSearchParams();
      if (deviceId) params.set('deviceId', deviceId);
      if (!includeRoutes) params.set('includeRoutes', '0');
      if (!includeGeofences) params.set('includeGeofences', '0');
      if (!includeRoutePoints) params.set('includePoints', '0');
      params.set('includePassive', '0');
      const snapshotRes = await authenticatedFetch(`/api/location/fetchAll?${params.toString()}`);
      if (!snapshotRes.ok) throw new Error('Failed to load tracking snapshot');
      const data = await snapshotRes.json();
      if (includeRoutes) {
        trackingRoutes.value = Array.isArray(data?.routes) ? data.routes : [];
        lastRoutesFetchAt = Date.now();
      }
      return;
    }

    let serverPoints = [];
    for (let pass = 0; pass < PASSIVE_CATCHUP_PASSES; pass++) {
      const sinceTs = Number(passiveFetchSinceTs.value || 0);
      let cursor = null,
        page = 0,
        hitCap = false;
      do {
        const params = new URLSearchParams();
        params.set('since', String(sinceTs));
        params.set('limit', String(PASSIVE_FETCH_LIMIT));
        if (deviceId) params.set('deviceId', deviceId);
        if (!includeRoutes) params.set('includeRoutes', '0');
        if (!includeGeofences) params.set('includeGeofences', '0');
        if (!includeRoutePoints) params.set('includePoints', '0');
        if (page === 0 && includeRoutePoints) {
          params.set('routeId', String(activeRouteId));
          params.set('pointsLimit', String(ACTIVE_POINTS_LIMIT));
        }
        if (cursor?.ts && cursor?.id) {
          params.set('cursorTs', String(cursor.ts));
          params.set('cursorId', String(cursor.id));
        }
        const snapshotRes = await authenticatedFetch(`/api/location/fetchAll?${params.toString()}`);
        if (!snapshotRes.ok) throw new Error('Failed to load tracking snapshot');
        const data = await snapshotRes.json();
        if (includeRoutes) {
          trackingRoutes.value = Array.isArray(data?.routes) ? data.routes : [];
          lastRoutesFetchAt = Date.now();
        }
        const nextPassive = Array.isArray(data?.passive_locations) ? data.passive_locations : [];
        mergePassiveLocations(nextPassive);
        if (!serverPoints.length && Array.isArray(data?.points) && data.points.length)
          serverPoints = data.points;
        cursor =
          data?.passiveCursor &&
          Number(data.passiveCursor.ts) > 0 &&
          Number(data.passiveCursor.id) > 0
            ? { ts: Number(data.passiveCursor.ts), id: Number(data.passiveCursor.id) }
            : null;
        page += 1;
        if (page >= MAX_PASSIVE_PAGES && cursor) {
          hitCap = true;
          break;
        }
      } while (cursor);
      if (!hitCap) break;
    }

    const passiveNormalized = normalizePassivePoints(passiveLocations.value);
    if (serverPoints.length) {
      const activeNormalized = serverPoints
        .map((row) => ({
          id: row?.id,
          routeId: Number(row?.routeId ?? row?.route_id),
          lat: Number(row?.lat),
          lng: Number(row?.lng),
          timestamp: Number(row?.timestamp || 0)
        }))
        .filter(
          (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp)
        );
      const merged = new Map();
      for (const p of passiveNormalized)
        merged.set(p.id != null ? `passive-${p.id}` : `pts-${p.lat}-${p.lng}-${p.timestamp}`, p);
      for (const p of activeNormalized)
        merged.set(p.id != null ? `active-${p.id}` : `pts-${p.lat}-${p.lng}-${p.timestamp}`, p);
      trackingPoints.value = Array.from(merged.values());
    } else {
      trackingPoints.value = passiveNormalized;
    }

    if (
      selectedRouteId.value &&
      !trackingRoutes.value.some((r) => Number(r.id) === Number(selectedRouteId.value))
    )
      selectedRouteId.value = null;
    if (currentPage.value === 'map') {
      await nextTick();
      await renderMap();
      syncMapViewport();
    }
  } catch (err) {
    console.error(err);
  }
}

async function fetchVisitedPlacesData() {
  visitedPlacesLoading.value = true;
  visitedPlacesError.value = '';
  try {
    const now = Date.now();
    const fromMs = now - 14 * 24 * 60 * 60 * 1000;
    const timelineParams = new URLSearchParams({
      fromMs: String(fromMs),
      toMs: String(now),
      limit: '200'
    });
    // if (selectedDeviceId.value) timelineParams.set('deviceId', selectedDeviceId.value);
    const [placesRes, timelineRes] = await Promise.all([
      authenticatedFetch('/api/location/places?limit=24'),
      authenticatedFetch(`/api/location/timeline?${timelineParams.toString()}`)
    ]);
    if (!placesRes.ok) throw new Error('Failed to load visited places');
    if (!timelineRes.ok) throw new Error('Failed to load visited timeline');
    const [placesData, timelineData] = await Promise.all([placesRes.json(), timelineRes.json()]);
    visitedPlaces.value = Array.isArray(placesData?.places)
      ? placesData.places.map(normalizeVisitedPlace).filter((place) => Number.isFinite(place.id))
      : [];
    visitedTimelineSegments.value = Array.isArray(timelineData?.segments)
      ? timelineData.segments
          .map(normalizeVisitedTimelineSegment)
          .filter((segment) => Number.isFinite(Number(segment.startMs)))
      : [];
  } catch (err) {
    visitedPlaces.value = [];
    visitedTimelineSegments.value = [];
    visitedPlacesError.value = err instanceof Error ? err.message : 'Failed to load visited places';
    console.error(err);
  } finally {
    visitedPlacesLoading.value = false;
  }
}

function fmtEventTs(ts) {
  const n = Number(ts || 0);
  if (!n) return '-';
  return new Date(n).toLocaleString();
}

function parseEventPayloadSummary(payload) {
  if (!payload) return '';
  try {
    const obj = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!obj || typeof obj !== 'object') return '';
    return [
      obj.reason ? `reason:${String(obj.reason)}` : '',
      obj.error ? `error:${String(obj.error).slice(0, 80)}` : ''
    ]
      .filter(Boolean)
      .join(' · ');
  } catch {
    return '';
  }
}

function toast(text, type = 'info') {
  message.value = { text, type };
  setTimeout(() => (message.value = null), 4000);
}

async function fetchAll() {
  loading.value = true;
  try {
    const [bundlesRes, channelsRes, historyRes, apksRes] = await Promise.all([
      authenticatedFetch('/api/ota/admin/bundles')
        .then((r) => r.json())
        .catch(() => ({ bundles: [] })),
      authenticatedFetch('/api/ota/admin/channels')
        .then((r) => r.json())
        .catch(() => ({ channels: {} })),
      authenticatedFetch('/api/ota/admin/history')
        .then((r) => r.json())
        .catch(() => ({ history: [] })),
      authenticatedFetch('/api/ota/admin/apks')
        .then((r) => r.json())
        .catch(() => ({ apks: [] }))
    ]);
    bundles.value = bundlesRes.bundles || bundlesRes.objects || [];
    Object.assign(channels, channelsRes.channels || {});
    history.value = historyRes.history || [];
    apks.value = apksRes.apks || [];
    const onMap = currentPage.value === 'map';
    await fetchTrackingSnapshot({
      forceRoutes: true,
      includePassive: onMap,
      includeLive: onMap,
      includeEvents: onMap
    });
    if (currentPage.value === 'dashboard') await fetchVisitedPlacesData();
    await finalizeCurrentPageAfterDataLoad();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Failed to load data', 'error');
  } finally {
    loading.value = false;
  }
}

function handleFileSelect(event, type) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (type === 'ota') uploadFile.value = file;
  if (type === 'apk') apkFile.value = file;
}

function handleDrop(event, type) {
  dragOver.value = false;
  dragOverApk.value = false;
  const file = event.dataTransfer.files?.[0];
  if (!file) return;
  if (type === 'ota') {
    if (!file.name.endsWith('.zip')) {
      toast('Please upload a ZIP file', 'error');
      return;
    }
    uploadFile.value = file;
  } else if (type === 'apk') {
    if (!file.name.endsWith('.apk')) {
      toast('Please upload an APK file', 'error');
      return;
    }
    apkFile.value = file;
  }
}

function clearUpload() {
  versionInput.value = '';
  uploadFile.value = null;
}
function clearApkUpload() {
  apkVersionInput.value = '';
  apkFile.value = null;
}

async function handleUpload() {
  if (!uploadFile.value) return toast('Please select a file', 'error');
  if (!versionInput.value) return toast('Please enter a version', 'error');
  const fd = new FormData();
  fd.append('file', uploadFile.value);
  fd.append('version', versionInput.value);
  fd.append('channel', selectedChannel.value);
  uploading.value = true;
  try {
    const res = await authenticatedFetch('/api/ota/admin/ota/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Upload failed');
    toast(`Uploaded ${data.manifest.version}`, 'success');
    clearUpload();
    await fetchAll();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Upload error', 'error');
  } finally {
    uploading.value = false;
  }
}

async function handleApkUpload() {
  if (!apkFile.value) return toast('Please select an APK file', 'error');
  if (!apkVersionInput.value) return toast('Please enter a version', 'error');
  const fd = new FormData();
  fd.append('file', apkFile.value);
  fd.append('version', apkVersionInput.value);
  apkUploading.value = true;
  try {
    const res = await authenticatedFetch('/api/ota/admin/apk/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Upload failed');
    toast(`Uploaded APK ${data.uploaded.version}`, 'success');
    clearApkUpload();
    await fetchAll();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Upload error', 'error');
  } finally {
    apkUploading.value = false;
  }
}

async function handleDeleteBundle(key) {
  if (!confirm(`Delete bundle ${key}?`)) return;
  try {
    const res = await authenticatedFetch('/api/ota/admin/bundle', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Delete failed');
    toast('Bundle deleted', 'success');
    await fetchAll();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Delete error', 'error');
  }
}

async function handleRollback(channel, version) {
  if (!confirm(`Set channel '${channel}' active version to '${version}'?`)) return;
  try {
    const entry = history.value.find((h) => h.channel === channel && h.version === version);
    if (!entry) throw new Error('History entry not found');
    const manifest = {
      version: entry.version,
      key: entry.filename,
      url: `${location.origin}/api/ota/bundle/${entry.filename}`,
      updated: entry.uploaded_at
    };
    const res = await authenticatedFetch(`/api/ota/admin/manifest/${channel}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(manifest)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Rollback failed');
    toast('Rollback applied', 'success');
    await fetchAll();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Rollback error', 'error');
  }
}

async function handleDeleteHistory(id, channel, version, filename) {
  if (
    !confirm(`Delete history ${channel}:${version}? This will also delete the bundle ${filename}.`)
  )
    return;
  try {
    const res = await authenticatedFetch(`/api/ota/admin/ota/updates/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Delete history failed');
    toast('History and bundle deleted', 'success');
    await fetchAll();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Delete history error', 'error');
  }
}

async function handleDeleteApk(id, filename) {
  if (!confirm(`Delete APK ${filename}?`)) return;
  try {
    const res = await authenticatedFetch(`/api/ota/admin/apk/apks/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Delete failed');
    toast('APK deleted', 'success');
    await fetchAll();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Delete error', 'error');
  }
}

async function handleDeleteSelectedHistory() {
  if (
    !selectedHistory.value.length ||
    !confirm(`Delete ${selectedHistory.value.length} selected history entries?`)
  )
    return;
  try {
    const res = await authenticatedFetch('/api/ota/admin/ota/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedHistory.value })
    });
    if (!res.ok) throw new Error('Bulk delete failed');
    toast(`Deleted ${selectedHistory.value.length} entries`, 'success');
    selectedHistory.value = [];
    await fetchAll();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function handleDeleteSelectedApk() {
  if (!selectedApks.value.length || !confirm(`Delete ${selectedApks.value.length} selected APKs?`))
    return;
  try {
    const res = await authenticatedFetch('/api/ota/admin/apk/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedApks.value })
    });
    if (!res.ok) throw new Error('Bulk delete failed');
    toast(`Deleted ${selectedApks.value.length} APKs`, 'success');
    selectedApks.value = [];
    await fetchAll();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function handleDeleteSelectedBundles() {
  if (
    !selectedBundles.value.length ||
    !confirm(`Delete ${selectedBundles.value.length} selected bundles?`)
  )
    return;
  try {
    const res = await authenticatedFetch('/api/ota/admin/bundles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: selectedBundles.value })
    });
    if (!res.ok) throw new Error('Bulk delete failed');
    toast(`Deleted ${selectedBundles.value.length} bundles`, 'success');
    selectedBundles.value = [];
    await fetchAll();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function openDayTimelineMap(day) {
  const ids = Array.isArray(day?.routeIds) ? day.routeIds : [];
  if (!ids.length) return;
  await loadLeaflet();
  dayTimelineMapOpen.value = true;
  dayTimelineMapLabel.value = `Timeline ${day.label}`;
  dayTimelineMapMeta.value = `${ids.length} routes • ${Number(day.totalPoints || 0)} points`;
  selectedDaySegments.value = [];
  await ensureTimelineRoutePoints(ids);
  await nextTick();
  const routePoints = ids
    .flatMap((rid) => {
      const cached = routePointsById.value.get(Number(rid));
      if (cached && cached.length) return cached;
      return trackingPoints.value.filter((p) => Number(p.routeId) === Number(rid));
    })
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  selectedDaySegments.value = buildDayTripSegments(routePoints, timelinePlaceAnchors.value);
  await renderSelectedDaySegmentMaps();
}

function closeDayTimelineMap() {
  dayTimelineMapOpen.value = false;
  dayTimelineMapLabel.value = '';
  dayTimelineMapMeta.value = '';
  selectedDaySegments.value = [];
  for (const map of daySegmentMiniMaps.value.values()) map.remove();
  daySegmentMiniMaps.value.clear();
  daySegmentMapRefs.value.clear();
}

function setDaySegmentMapRef(el, id) {
  if (el) daySegmentMapRefs.value.set(id, el);
}
function setDashboardTimelineMapRef(el, id) {
  if (el) dashboardTimelineMapRefs.value.set(id, el);
  else dashboardTimelineMapRefs.value.delete(id);
}

function clearDashboardTimelineMiniMaps() {
  for (const map of dashboardTimelineMiniMaps.value.values()) map.remove();
  dashboardTimelineMiniMaps.value.clear();
  dashboardTimelineMapRefs.value.clear();
}

async function renderDashboardTimelineMiniMaps() {
  if (currentPage.value !== 'dashboard') return;
  await loadLeaflet();
  await nextTick();
  if (!mapLib) return;
  const L = mapLib;
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
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(mini);
    const coords = (Array.isArray(row.points) ? row.points : [])
      .map((p) => [Number(p.lat), Number(p.lng)])
      .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
    if (coords.length >= 2) {
      L.polyline(coords, { color: '#38bdf8', weight: 4, opacity: 0.9 }).addTo(mini);
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
      mini.fitBounds(L.latLngBounds(coords), { padding: [12, 12] });
    } else {
      mini.setView([14.5995, 120.9842], 12);
    }
    dashboardTimelineMiniMaps.value.set(row.id, mini);
  }
}

async function renderSelectedDaySegmentMaps() {
  await nextTick();
  if (!mapLib) return;
  const L = mapLib;
  const palette = ['#f59e0b', '#38bdf8', '#22c55e', '#f472b6', '#a78bfa', '#fb7185', '#14b8a6'];
  for (let i = 0; i < selectedDaySegments.value.length; i++) {
    const seg = selectedDaySegments.value[i];
    const container = daySegmentMapRefs.value.get(seg.id);
    if (!container) continue;
    if (daySegmentMiniMaps.value.has(seg.id)) {
      daySegmentMiniMaps.value.get(seg.id).remove();
      daySegmentMiniMaps.value.delete(seg.id);
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
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(mini);
    const coords = seg.points.map((p) => [Number(p.lat), Number(p.lng)]);
    const color = palette[i % palette.length];
    L.polyline(coords, { color, weight: 4, opacity: 0.9 }).addTo(mini);
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
      fillColor: '#f97316',
      fillOpacity: 1,
      weight: 1.5
    }).addTo(mini);
    mini.fitBounds(L.latLngBounds(coords), { padding: [14, 14] });
    daySegmentMiniMaps.value.set(seg.id, mini);
  }
}

async function openDayTimelineFromDashboard(day) {
  goToPage('map');
  await nextTick();
  await openDayTimelineMap(day);
}

const adminAppContext = {
  auth: {
    handleLogin,
    loggingIn,
    loginError,
    password,
    username
  },
  dashboard: {
    activeHistoryTab,
    activeUploadTab,
    apkFile,
    apkUploading,
    apkVersionInput,
    apks,
    bundles,
    channelOptions,
    channels,
    clearApkUpload,
    clearUpload,
    dashboardTimelineActiveDay,
    dashboardTimelineRows,
    dashboardTimelineStats,
    dragOver,
    dragOverApk,
    fetchAll,
    handleApkUpload,
    handleDeleteApk,
    handleDeleteBundle,
    handleDeleteHistory,
    handleDeleteSelectedApk,
    handleDeleteSelectedBundles,
    handleDeleteSelectedHistory,
    handleDrop,
    handleFileSelect,
    handleRollback,
    handleUpload,
    history,
    openDayTimelineFromDashboard,
    passiveDayTimeline,
    selectDashboardTimelineDay,
    selectedApks,
    selectedBundles,
    selectedChannel,
    selectedHistory,
    setDashboardTimelineMapRef,
    uploadFile,
    uploading,
    versionInput,
    visitedPlacesError,
    visitedPlacesLoading,
    visitedTimelineActiveDay,
    visitedTimelineDayKey,
    visitedTimelineDays,
    visitedTimelineRows,
    visitedTimelineSegments,
    visitedTimelineStats,
    visitedTopPlaces
  },
  feedback: {
    message
  },
  logs: {
    apiLogsMethodFilter,
    apiLogsPathFilter,
    apiLogsSourceFilter,
    apiLogsStatusFilter,
    backendApiLogs,
    fetchApiAccessLogs
  },
  map: {
    activeRouteCount,
    currentStaySummary,
    displayedRouteSummaries,
    fitMapToData,
    focusDevice,
    formatRouteWindowLabel,
    lastSyncedPoint,
    latestLocationLabel,
    liveDevices,
    liveWindowMinutes,
    mapAutoRefreshEnabled,
    mapAutoRefreshMs,
    openDayTimelineMap,
    passiveDayTimeline,
    passiveRouteCount,
    refreshTrackingNow,
    routeDisplayLabel,
    routeFilter,
    routeListMode,
    routeSummaries,
    selectedDeviceId,
    selectedRouteId,
    selectedRoutePoints,
    selectedRoutePointsLoading,
    setMapContainer,
    showLiveDevices,
    showPassiveDots,
    trackingPoints
  },
  shell: {
    currentPage,
    goToPage,
    handleLogout
  },
  timeline: {
    closeDayTimelineMap,
    dayTimelineMapLabel,
    dayTimelineMapMeta,
    dayTimelineMapOpen,
    selectedDaySegments,
    setDaySegmentMapRef
  }
}

provideAdminAppContext(adminAppContext)

onMounted(async () => {
  const authenticated = await verifyToken();
  if (!authenticated) return;
  await fetchAll();
});

onUnmounted(() => {
  closeDayTimelineMap();
  clearDashboardTimelineMiniMaps();
  stopMapAutoRefresh();
});
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Space+Grotesk:wght@400;500;700&display=swap');
:root {
  --iku-bg: #090a0c;
  --iku-panel: #111418;
  --iku-panel-soft: #161a20;
  --iku-border: #2a2f37;
  --iku-accent: #f97316;
}
.iku-shell {
  font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
  background:
    radial-gradient(900px 300px at 12% 0%, rgba(249, 115, 22, 0.18), transparent 55%),
    radial-gradient(700px 320px at 88% 0%, rgba(14, 165, 233, 0.12), transparent 60%), var(--iku-bg);
  color: #e6eaf0;
}
.iku-grid-bg {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 24px 24px;
}
.iku-header {
  background: rgba(17, 20, 24, 0.85) !important;
  backdrop-filter: blur(12px);
  border-color: var(--iku-border) !important;
}
.iku-card {
  background: linear-gradient(180deg, rgba(22, 26, 32, 0.92), rgba(17, 20, 24, 0.96)) !important;
  border-color: var(--iku-border) !important;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
}
.iku-shell .font-mono {
  font-family: 'JetBrains Mono', monospace !important;
}
.iku-shell .bg-white,
.iku-shell .bg-slate-50,
.iku-shell .bg-slate-100 {
  background-color: transparent !important;
}
.iku-shell .text-slate-900,
.iku-shell .text-slate-800,
.iku-shell .text-slate-700 {
  color: #e6eaf0 !important;
}
.iku-shell .text-slate-600,
.iku-shell .text-slate-500,
.iku-shell .text-slate-400 {
  color: #9da7b5 !important;
}
.iku-shell .border-slate-300,
.iku-shell .border-slate-200,
.iku-shell .border-slate-100 {
  border-color: var(--iku-border) !important;
}
.iku-shell .bg-indigo-600,
.iku-shell .hover\:bg-indigo-700:hover {
  background-color: var(--iku-accent) !important;
}
.iku-shell .text-indigo-600,
.iku-shell .hover\:text-indigo-600:hover {
  color: var(--iku-accent) !important;
}
.iku-shell .focus\:ring-indigo-500:focus {
  --tw-ring-color: rgba(249, 115, 22, 0.55) !important;
}
</style>
