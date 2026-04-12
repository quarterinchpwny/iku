import { computed, ref } from 'vue';
import { TRACKER_LIMITS } from '@/composables/tracker/constants';
import { formatElapsed, formatPaceSeconds, haversineMeters } from '@/composables/tracker/geo';
import { useTrackPersistence } from '@/composables/tracker/useTrackPersistence';
import type { PositionFix, RouteSummary, Split, TrackPoint } from '@/composables/tracker/types';

function smoothCoordinate(previous: number, next: number): number {
  return previous + (next - previous) * TRACKER_LIMITS.coordinateSmoothingAlpha;
}

export function useTrackSession() {
  const isTracking = ref(false);
  const isPaused = ref(false);
  const isFinalizing = ref(false);
  const gpsAccuracy = ref(0);
  const currentSpeed = ref(0);
  const elapsedMs = ref(0);
  const movingMs = ref(0);
  const totalDistanceKm = ref(0);
  const totalPoints = ref(0);
  const trackPoints = ref<TrackPoint[]>([]);
  const splits = ref<Split[]>([]);

  const persistence = useTrackPersistence();
  let timer: ReturnType<typeof setInterval> | null = null;
  let timerLastTick = 0;
  let slowSince: number | null = null;
  let autoPausedBySystem = false;
  let splitDistanceAccumulator = 0;
  let splitStartMs = 0;
  let splitStartDistanceKm = 0;
  let smoothedLat: number | null = null;
  let smoothedLng: number | null = null;
  let trackingStartedAt: number | null = null;
  let trackingEndedAt: number | null = null;
  let finalizePromise: Promise<number | null> | null = null;

  const formattedElapsed = computed(() => formatElapsed(elapsedMs.value));
  const formattedDistance = computed(() => (totalDistanceKm.value < 10 ? totalDistanceKm.value.toFixed(2) : totalDistanceKm.value.toFixed(1)));
  const paceSeconds = computed(() => (totalDistanceKm.value < 0.01 || movingMs.value < 1000 ? 0 : (movingMs.value / 1000) / totalDistanceKm.value));
  const formattedPace = computed(() => formatPaceSeconds(paceSeconds.value));
  const summary = computed<RouteSummary>(() => {
    const avgSpeedMps = movingMs.value > 0 ? (totalDistanceKm.value * 1000) / (movingMs.value / 1000) : 0;
    return {
      elapsedMs: elapsedMs.value,
      movingMs: movingMs.value,
      distanceKm: totalDistanceKm.value,
      avgSpeedMps,
      avgPaceSeconds: paceSeconds.value,
      totalPoints: totalPoints.value,
      splits: [...splits.value],
    };
  });

  function startTimer() {
    timerLastTick = Date.now();
    timer = setInterval(() => {
      const now = Date.now();
      if (!isPaused.value) elapsedMs.value += now - timerLastTick;
      timerLastTick = now;
    }, 500);
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function calculateSmoothedSpeed(): number {
    const recent = trackPoints.value.slice(-TRACKER_LIMITS.speedSmoothWindow);
    if (recent.length < 2) return 0;
    let distance = 0;
    let seconds = 0;
    for (let index = 1; index < recent.length; index += 1) {
      const previous = recent[index - 1];
      const next = recent[index];
      const segmentDistance = haversineMeters(previous.lat, previous.lng, next.lat, next.lng);
      const segmentSeconds = (next.timestamp - previous.timestamp) / 1000;
      if (segmentSeconds <= 0) continue;
      distance += segmentDistance;
      seconds += segmentSeconds;
    }
    return seconds <= 0 ? 0 : distance / seconds;
  }

  async function startTracking() {
    const now = Date.now();
    isTracking.value = true;
    isPaused.value = false;
    elapsedMs.value = 0;
    movingMs.value = 0;
    totalDistanceKm.value = 0;
    totalPoints.value = 0;
    trackPoints.value = [];
    splits.value = [];
    currentSpeed.value = 0;
    slowSince = null;
    autoPausedBySystem = false;
    splitDistanceAccumulator = 0;
    splitStartMs = now;
    splitStartDistanceKm = 0;
    smoothedLat = null;
    smoothedLng = null;
    trackingStartedAt = now;
    trackingEndedAt = null;
    finalizePromise = null;
    isFinalizing.value = false;
    startTimer();
  }

  function togglePause() {
    isPaused.value = !isPaused.value;
    if (!isPaused.value) {
      timerLastTick = Date.now();
      slowSince = null;
      autoPausedBySystem = false;
    }
  }

  async function stopTracking() {
    stopTimer();
    trackingEndedAt = Date.now();
    isTracking.value = false;
    isPaused.value = false;
  }

  function discardTrackingData() {
    trackPoints.value = [];
    totalDistanceKm.value = 0;
    movingMs.value = 0;
    elapsedMs.value = 0;
    totalPoints.value = 0;
    splits.value = [];
    currentSpeed.value = 0;
    trackingStartedAt = null;
    trackingEndedAt = null;
    finalizePromise = null;
    isFinalizing.value = false;
  }

  async function finalizeTrackingData() {
    if (finalizePromise) return finalizePromise;
    const startedAt = trackingStartedAt ?? Date.now();
    const endedAt = trackingEndedAt ?? Date.now();
    isFinalizing.value = true;
    finalizePromise = persistence.saveCompletedTrack({
      startedAt,
      endedAt,
      distanceKm: totalDistanceKm.value,
      elapsedMs: elapsedMs.value,
      movingMs: movingMs.value,
      points: [...trackPoints.value],
    });
    try {
      return await finalizePromise;
    } finally {
      discardTrackingData();
    }
  }

  function onPosition(fix: PositionFix): TrackPoint | null {
    gpsAccuracy.value = fix.accuracy;
    if (!isTracking.value || isPaused.value || fix.accuracy > TRACKER_LIMITS.minAccuracyMeters) return null;

    const timestamp = fix.timestamp ?? Date.now();
    const prev = trackPoints.value[trackPoints.value.length - 1];
    smoothedLat = smoothedLat === null ? fix.lat : smoothCoordinate(smoothedLat, fix.lat);
    smoothedLng = smoothedLng === null ? fix.lng : smoothCoordinate(smoothedLng, fix.lng);

    if (!prev) {
      const firstPoint: TrackPoint = {
        lat: smoothedLat,
        lng: smoothedLng,
        timestamp,
        accuracy: fix.accuracy,
        speed: Math.max(0, fix.speed ?? 0),
        heading: fix.heading,
        altitude: fix.altitude,
      };
      trackPoints.value.push(firstPoint);
      totalPoints.value = 1;
      currentSpeed.value = 0;
      return firstPoint;
    }

    const dtMs = timestamp - prev.timestamp;
    if (dtMs < TRACKER_LIMITS.minPointIntervalMs) return null;
    const distanceMeters = haversineMeters(prev.lat, prev.lng, smoothedLat, smoothedLng);
    const dtSeconds = dtMs / 1000;
    const derivedSpeed = dtSeconds > 0 ? distanceMeters / dtSeconds : 0;
    if (derivedSpeed > TRACKER_LIMITS.maxDerivedSpeedMps || distanceMeters < TRACKER_LIMITS.minDisplacementMeters) return null;

    if (derivedSpeed < TRACKER_LIMITS.autoPauseSpeedMps) {
      if (slowSince === null) slowSince = timestamp;
      if (!autoPausedBySystem && slowSince !== null && timestamp - slowSince >= TRACKER_LIMITS.autoPauseDelayMs) {
        autoPausedBySystem = true;
        isPaused.value = true;
        return null;
      }
    } else {
      slowSince = null;
      if (autoPausedBySystem && isPaused.value) {
        autoPausedBySystem = false;
        isPaused.value = false;
        timerLastTick = timestamp;
      }
    }

    if (derivedSpeed >= TRACKER_LIMITS.minMovingSpeedMps) movingMs.value += dtMs;

    const point: TrackPoint = {
      lat: smoothedLat,
      lng: smoothedLng,
      timestamp,
      accuracy: fix.accuracy,
      speed: fix.speed ?? derivedSpeed,
      heading: fix.heading,
      altitude: fix.altitude,
    };

    const segmentKm = distanceMeters / 1000;
    totalDistanceKm.value += segmentKm;
    splitDistanceAccumulator += segmentKm;

    if (splitDistanceAccumulator >= TRACKER_LIMITS.splitDistanceKm) {
      const splitDurationMs = timestamp - splitStartMs;
      const splitDistanceKm = totalDistanceKm.value - splitStartDistanceKm;
      splits.value.push({
        km: splits.value.length + 1,
        paceSeconds: splitDistanceKm > 0 ? (splitDurationMs / 1000) / splitDistanceKm : 0,
        durationMs: splitDurationMs,
      });
      splitDistanceAccumulator -= TRACKER_LIMITS.splitDistanceKm;
      splitStartMs = timestamp;
      splitStartDistanceKm = totalDistanceKm.value;
    }

    trackPoints.value.push(point);
    totalPoints.value = trackPoints.value.length;
    currentSpeed.value = calculateSmoothedSpeed();
    return point;
  }

  return {
    isTracking,
    isPaused,
    isFinalizing,
    gpsAccuracy,
    currentSpeed,
    elapsedMs,
    movingMs,
    totalDistanceKm,
    totalPoints,
    trackPoints,
    splits,
    formattedElapsed,
    formattedDistance,
    formattedPace,
    paceSeconds,
    summary,
    startTracking,
    stopTracking,
    togglePause,
    discardTrackingData,
    finalizeTrackingData,
    onPosition,
  };
}
