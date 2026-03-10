<template>
  <div class="tracker-root">
    <div ref="mapContainer" class="map-layer" />

    <Transition name="fade">
      <div v-if="mapLoading" class="map-loading-overlay">
        <div class="loader-ring" />
        <span class="loader-label">INITIALIZING</span>
      </div>
    </Transition>

    <Transition name="slide-down">
      <TrackerTopBar v-if="!isTracking" :gps-accuracy="gpsAccuracy" :current-time="currentTime" />
    </Transition>

    <Transition name="slide-up">
      <TrackerHud
        v-if="isTracking"
        :is-paused="isPaused"
        :formatted-elapsed="formattedElapsed"
        :formatted-distance="formattedDistance"
        :formatted-pace="formattedPace"
        :current-speed="currentSpeed"
        :gps-accuracy="gpsAccuracy"
      />
    </Transition>

    <TrackerControls
      :is-tracking="isTracking"
      :is-paused="isPaused"
      :is-route-searching="isSearchingRoute"
      :route-error="routeError"
      :route-summary="routeSummary"
      @start="startTracking"
      @toggle-pause="togglePause"
      @stop="stopTracking"
      @recenter="recenterMap"
      @search-walking="searchWalkingRoute"
    />

    <TrackerSummaryModal
      :show="showSummary"
      :summary-date="summaryDate"
      :formatted-distance="formattedDistance"
      :formatted-elapsed="summaryElapsed"
      :formatted-pace="summaryPace"
      :avg-speed-mps="summary.avgSpeedMps"
      :total-points="summary.totalPoints"
      :avg-pace-seconds="summary.avgPaceSeconds"
      :splits="summary.splits"
      :is-saving="isFinalizing"
      @open-map="openSummaryMap"
      @close="showSummary = false"
      @discard="discardActivity"
      @save="saveAndClose"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Geolocation } from '@capacitor/geolocation';
import TrackerControls from '@/components/tracker/TrackerControls.vue';
import TrackerHud from '@/components/tracker/TrackerHud.vue';
import TrackerSummaryModal from '@/components/tracker/TrackerSummaryModal.vue';
import TrackerTopBar from '@/components/tracker/TrackerTopBar.vue';
import { formatElapsed, formatPaceSeconds } from '@/composables/tracker/geo';
import { useLeafletTrackerMap } from '@/composables/tracker/useLeafletTrackerMap';
import { useTrackSession } from '@/composables/tracker/useTrackSession';
import { useWalkingRouteSearch } from '@/composables/tracker/useWalkingRouteSearch';

const mapContainer = ref<HTMLElement | null>(null);
const showSummary = ref(false);
const currentTime = ref('');
const summaryDate = ref('');
let clockTimer: ReturnType<typeof setInterval> | null = null;
let capacitorWatchId: string | null = null;
let browserWatchId: number | null = null;

const {
  mapLoading,
  loadLeaflet,
  initMap,
  resetPolyline,
  recenterTo,
  updateCurrentPosition,
  appendTrackPoint,
  drawWalkingRoute,
  openSummaryMap,
  destroy,
} = useLeafletTrackerMap();

const {
  isTracking,
  isPaused,
  isFinalizing,
  gpsAccuracy,
  currentSpeed,
  trackPoints,
  formattedElapsed,
  formattedDistance,
  formattedPace,
  summary,
  startTracking: beginSession,
  stopTracking: endSession,
  togglePause,
  discardTrackingData,
  finalizeTrackingData,
  onPosition,
} = useTrackSession();

const {
  isSearchingRoute,
  routeError,
  routeSummary,
  findWalkingRoute,
  clearRouteFeedback,
} = useWalkingRouteSearch();

const summaryElapsed = computed(() => formatElapsed(summary.value.elapsedMs));
const summaryPace = computed(() => formatPaceSeconds(summary.value.avgPaceSeconds));

function updateClock() {
  currentTime.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function searchWalkingRoute(payload: { from: string; to: string }) {
  const result = await findWalkingRoute(payload.from, payload.to);
  drawWalkingRoute(result.path);
}

async function startTracking() {
  await Geolocation.requestPermissions();
  clearRouteFeedback();
  await beginSession();
  resetPolyline();
}

async function stopTracking() {
  await endSession();
  summaryDate.value = new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  showSummary.value = true;
}

async function discardActivity() {
  await discardTrackingData();
  showSummary.value = false;
}

async function saveAndClose() {
  await finalizeTrackingData();
  showSummary.value = false;
}

function recenterMap() {
  const last = trackPoints.value[trackPoints.value.length - 1];
  if (!last) return;
  recenterTo(last);
}

function processPosition(coords: GeolocationCoordinates, timestamp?: number) {
  updateCurrentPosition(coords.latitude, coords.longitude, coords.heading);
  const accepted = onPosition({
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy,
    speed: coords.speed,
    heading: coords.heading,
    altitude: coords.altitude,
    timestamp,
  });
  if (accepted) appendTrackPoint(accepted);
}

onMounted(async () => {
  updateClock();
  clockTimer = setInterval(updateClock, 10000);
  if (!import.meta.client) throw new Error('Map page requires client runtime');
  await loadLeaflet();
  if (!mapContainer.value) throw new Error('Map container unavailable');

  const initial = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
  const startLatLng: [number, number] = [initial.coords.latitude, initial.coords.longitude];
  gpsAccuracy.value = initial.coords.accuracy;
  initMap(mapContainer.value, startLatLng);

  capacitorWatchId = await Geolocation.watchPosition(
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, minimumUpdateInterval: 1000 },
    (position) => {
      if (!position) return;
      processPosition(position.coords, position.timestamp);
    },
  );

  if (!capacitorWatchId) {
    browserWatchId = navigator.geolocation.watchPosition(
      (position) => processPosition(position.coords, position.timestamp),
      () => { throw new Error('Browser geolocation watch failed'); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  }
});

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
  if (capacitorWatchId) Geolocation.clearWatch({ id: capacitorWatchId }).catch(() => {});
  if (browserWatchId !== null) navigator.geolocation.clearWatch(browserWatchId);
  destroy();
});
</script>

<style scoped src="~/assets/styles/map-tracker.css"></style>
