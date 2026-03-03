import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { BackgroundGeolocation } from '@capgo/background-geolocation';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { CapacitorPedometer } from '@capgo/capacitor-pedometer';
import { db } from '@/db/index.js';
import { ActivityRecognition } from '@/src/plugins/activityRecognition';

type Geofence = {
  id: number;
  remoteId?: number;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  enabled: boolean;
  lastState: 'inside' | 'outside';
  lastTransitionAt: number | null;
  accountKey?: string;
  deviceId?: string;
  createdAt: number;
  updatedAt: number;
};

export const useGeolocationStore = defineStore('geolocation', () => {
  // --- State ---
  const currentPosition = ref<{ lat: number; lng: number } | null>(null);
  const isRecording = ref(false); // Strava-like active recording
  const isPassiveTracking = ref(false); // Life360-like always-on
  const activeRouteId = ref<number | null>(null);
  const speed = ref(0);
  const distance = ref(0);
  const pathCoords = ref<any[]>([]);
  
  // Stats
  const stepCount = ref(0);
  const pedometerDistance = ref(0);
  
  const lastPassiveLogTime = ref(0);
  const PASSIVE_LOG_INTERVAL = 60000; // 1 minute
  const PASSIVE_ROUTE_BREAK_MS = 45 * 60 * 1000; // moving routes can bridge short network/off gaps
  const PASSIVE_MAX_ROUTE_DURATION_MS = 4 * 60 * 60 * 1000; // cap moving route length
  const PASSIVE_STATIONARY_REUSE_RADIUS_M = 100; // <=100m drift is still "same area"
  const PASSIVE_STATIONARY_EXIT_RADIUS_M = 180; // hysteresis threshold to declare departure
  const PASSIVE_STATIONARY_REUSE_GAP_MS = 6 * 60 * 60 * 1000; // tolerate sparse idle updates
  const PASSIVE_STATIONARY_MAX_ROUTE_DURATION_MS = 24 * 60 * 60 * 1000; // cap long idle route at 24h
  const PASSIVE_STATIONARY_DWELL_MS = 20 * 60 * 1000; // require dwell before splitting on departure
  const ACTIVITY_LOG_MIN_INTERVAL_MS = 15_000;
  const PASSIVE_TRACKING_ENABLED_KEY = 'qipz_passive_tracking_enabled';
  const ACTIVITY_LOCATION_NOTIFICATION_KEY = 'qipz_activity_location_notify_enabled';
  const passiveRouteId = ref<number | null>(null);
  const passiveRouteStartedAt = ref(0);
  const lastPassivePointTime = ref(0);
  const lastPassiveActivityType = ref<string | null>(null);
  const lastPassiveLat = ref<number | null>(null);
  const lastPassiveLng = ref<number | null>(null);
  const lastActivityLogTime = ref(0);
  let cachedDeviceId: string | null = null;
  let lastActivePoint: { lat: number; lng: number; timestamp: number } | null = null;
  let notificationSeq = 0;

  // Auto-segment settingsalidade_smooth_dark
  const AUTO_PAUSE_SPEED_THRESHOLD = 1.0; // km/h

  const geofences = ref<Geofence[]>([]);
  const isAtHome = ref(false);
  const DEFAULT_HOME_ZONE = { lat: 14.5764, lng: 121.0851, radius: 100 };
  const GEOFENCE_MIN_RADIUS = 25;
  const GEOFENCE_MAX_RADIUS = 5000;
  const GEOFENCE_EXIT_BUFFER_M = 20;
  const geofencesLoaded = ref(false);

  let pedometerListener: any = null;

  function getAccountKey(): string | null {
    if (!import.meta.client) return null;
    const key = String(localStorage.getItem('auth_account_key') || '').trim();
    return key || null;
  }

  function clampGeofenceRadius(value: unknown): number {
    const radius = Number(value);
    if (!Number.isFinite(radius)) return DEFAULT_HOME_ZONE.radius;
    return Math.max(GEOFENCE_MIN_RADIUS, Math.min(GEOFENCE_MAX_RADIUS, Math.round(radius)));
  }

  function normalizeGeofenceRow(row: any): Geofence | null {
    const id = Number(row?.id);
    const lat = Number(row?.lat);
    const lng = Number(row?.lng);
    if (!Number.isFinite(id) || id <= 0) return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const radius = clampGeofenceRadius(row?.radius);
    const now = Date.now();
    const name = String(row?.name || '').trim() || `Geofence ${id}`;
    const state = String(row?.lastState || '').toLowerCase() === 'inside' ? 'inside' : 'outside';
    const remoteId = Number(row?.remoteId);
    const rawTransition = Number(row?.lastTransitionAt);
    const rawCreated = Number(row?.createdAt ?? row?.created_at);
    const rawUpdated = Number(row?.updatedAt ?? row?.updated_at);

    return {
      id,
      remoteId: Number.isFinite(remoteId) && remoteId > 0 ? remoteId : undefined,
      name,
      lat,
      lng,
      radius,
      enabled: row?.enabled !== false && Number(row?.enabled) !== 0,
      lastState: state,
      lastTransitionAt: Number.isFinite(rawTransition) && rawTransition > 0 ? rawTransition : null,
      accountKey: typeof row?.accountKey === 'string' ? row.accountKey : (typeof row?.account_key === 'string' ? row.account_key : undefined),
      deviceId: typeof row?.deviceId === 'string' ? row.deviceId : (typeof row?.device_id === 'string' ? row.device_id : undefined),
      createdAt: Number.isFinite(rawCreated) && rawCreated > 0 ? rawCreated : now,
      updatedAt: Number.isFinite(rawUpdated) && rawUpdated > 0 ? rawUpdated : now
    };
  }

  const homeLocation = computed(() => {
    const home = geofences.value.find((f) => f.enabled && /home/i.test(f.name));
    if (home) return { lat: home.lat, lng: home.lng, radius: home.radius };
    const firstEnabled = geofences.value.find((f) => f.enabled);
    if (firstEnabled) return { lat: firstEnabled.lat, lng: firstEnabled.lng, radius: firstEnabled.radius };
    return DEFAULT_HOME_ZONE;
  });

  async function loadGeofences() {
    const rows = await db.geofences.toArray();
    geofences.value = rows
      .map((row: any) => normalizeGeofenceRow(row))
      .filter((row: Geofence | null): row is Geofence => row !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    geofencesLoaded.value = true;
    await syncGeofencesToNativePlugin();
  }

  async function ensureGeofencesLoaded() {
    if (geofencesLoaded.value) return;
    await loadGeofences();
  }

  async function createGeofence(input: {
    name: string;
    lat: number;
    lng: number;
    radius: number;
    enabled?: boolean;
  }): Promise<Geofence | null> {
    const accountKey = getAccountKey();
    const deviceId = await getDeviceId();
    const now = Date.now();
    const payload = {
      name: String(input?.name || '').trim() || 'Untitled Geofence',
      lat: Number(input?.lat),
      lng: Number(input?.lng),
      radius: clampGeofenceRadius(input?.radius),
      enabled: input?.enabled !== false,
      lastState: 'outside',
      lastTransitionAt: null,
      accountKey: accountKey || undefined,
      deviceId: deviceId || undefined,
      createdAt: now,
      updatedAt: now
    };
    if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lng)) return null;
    const id = await db.geofences.add(payload);
    await loadGeofences();
    return geofences.value.find((item) => item.id === Number(id)) || null;
  }

  async function updateGeofence(
    id: number,
    updates: Partial<Pick<Geofence, 'name' | 'lat' | 'lng' | 'radius' | 'enabled' | 'lastState' | 'lastTransitionAt'>>
  ) {
    const current = await db.geofences.get(id);
    if (!current) return;
    const next: any = { updatedAt: Date.now() };
    if (updates.name !== undefined) next.name = String(updates.name || '').trim() || String(current.name || 'Untitled Geofence');
    if (updates.lat !== undefined) {
      const lat = Number(updates.lat);
      if (Number.isFinite(lat)) next.lat = lat;
    }
    if (updates.lng !== undefined) {
      const lng = Number(updates.lng);
      if (Number.isFinite(lng)) next.lng = lng;
    }
    if (updates.radius !== undefined) next.radius = clampGeofenceRadius(updates.radius);
    if (updates.enabled !== undefined) next.enabled = !!updates.enabled;
    if (updates.lastState !== undefined) next.lastState = updates.lastState === 'inside' ? 'inside' : 'outside';
    if (updates.lastTransitionAt !== undefined) {
      next.lastTransitionAt = Number.isFinite(Number(updates.lastTransitionAt))
        ? Number(updates.lastTransitionAt)
        : null;
    }
    await db.geofences.update(id, next);
    await loadGeofences();
  }

  async function removeGeofence(id: number) {
    await db.geofences.delete(id);
    await loadGeofences();
  }

  async function syncGeofencesToNativePlugin() {
    if (!import.meta.client) return;
    if (!Capacitor.isNativePlatform()) return;
    if (!Capacitor.isPluginAvailable('qipz-activity')) return;
    try {
      await ActivityRecognition.setGeofences({
        geofences: geofences.value.map((item) => ({
          id: String(item.remoteId || item.id),
          name: item.name,
          lat: Number(item.lat),
          lng: Number(item.lng),
          radius: Number(item.radius),
          enabled: !!item.enabled,
          lastState: item.lastState,
          lastTransitionAt: item.lastTransitionAt || undefined
        }))
      });
    } catch (err) {
      console.warn('[GeoStore] Failed to sync geofences to native plugin:', err);
    }
  }

  async function getDeviceId(): Promise<string | null> {
    if (cachedDeviceId) return cachedDeviceId;
    try {
      const id = await Device.getId();
      const value = String(id?.identifier || '').trim();
      cachedDeviceId = value || null;
      return cachedDeviceId;
    } catch (_err) {
      return null;
    }
  }

  // --- Actions ---
  function syncPassiveTrackingState() {
    if (!import.meta.client) return;
    isPassiveTracking.value = localStorage.getItem(PASSIVE_TRACKING_ENABLED_KEY) === '1';
  }

  async function initializePassiveTracking() {
    if (isPassiveTracking.value) return;
    try {
      // Request both location and notification permissions
      await LocalNotifications.requestPermissions();
      const perm = await Geolocation.requestPermissions();
      if (perm.location !== 'granted') {
        alert("Location permission is required for tracking.");
        return;
      }

      console.log('Starting background geolocation...');
      
      // On Android, battery optimizations can kill the service even if it's foreground.
      // We can't automatically disable it, but we can warn the user.
      const info = await Device.getInfo();
      if (info.platform === 'android') {
        console.log("Check 'Don't kill my app!' settings for better persistence.");
      }

      await BackgroundGeolocation.start(
        {
          backgroundMessage: "IKU is active and protecting you.",
          backgroundTitle: "Live Shield Active",
          requestPermissions: true,
          stale: false,
          distanceFilter: 0, // Track every move
          fastestInterval: 3000, // 3 seconds
          interval: 5000 // 5 seconds
        },
        (location, error) => {
          if (error) {
            console.error("Background error:", error);
            if (error.code === "NOT_AUTHORIZED") {
              if (window.confirm("Background location access is required. Please set location permission to 'Allow all the time' in settings.")) {
                BackgroundGeolocation.openSettings();
              }
            }
            return;
          }
          const lat = location?.latitude;
          const lng = location?.longitude;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            console.warn('Background callback missing coordinates:', location);
            return;
          }
          console.log('New background location:', lat, lng);
          handleNewLocation(lat, lng, location?.speed || 0);
        }
      );

      isPassiveTracking.value = true;
      if (import.meta.client) {
        localStorage.setItem(PASSIVE_TRACKING_ENABLED_KEY, '1');
      }
      console.log('Passive tracking started');
    } catch (err) { 
      console.error("Failed to start background tracking:", err); 
      alert("Error starting background tracking: " + err);
    }
  }

  async function stopPassiveTracking() {
    try {
      await BackgroundGeolocation.stop();
      isPassiveTracking.value = false;
      if (import.meta.client) {
        localStorage.removeItem(PASSIVE_TRACKING_ENABLED_KEY);
      }
      passiveRouteId.value = null;
      passiveRouteStartedAt.value = 0;
      lastPassivePointTime.value = 0;
      lastPassiveActivityType.value = null;
      lastPassiveLat.value = null;
      lastPassiveLng.value = null;
      console.log('Passive tracking stopped');
    } catch (err) {
      console.error("Failed to stop background tracking:", err);
    }
  }

  async function handleNewLocation(
    lat: number,
    lng: number,
    velocityMS: number,
    forcePassiveLog = false,
    reason: 'background' | 'activity' = 'background',
    activityType: string | null = null,
    activityConfidence: number | null = null
  ) {
    const now = Date.now();
    console.log(`[GeoStore] Location Update: ${lat}, ${lng} at ${new Date(now).toLocaleTimeString()}`);
    currentPosition.value = { lat, lng };
    const velocityKMH = velocityMS * 3.6;
    speed.value = velocityKMH;

    // Life360: Passive Log
    if (forcePassiveLog || (now - lastPassiveLogTime.value > PASSIVE_LOG_INTERVAL)) {
      const accountKey = getAccountKey();
      const deviceId = await getDeviceId();
      const routeId = await ensurePassiveRoute(now, accountKey, deviceId, activityType, lat, lng);
      await db.passive_locations.add({
        lat,
        lng,
        timestamp: now,
        accountKey: accountKey || undefined,
        deviceId: deviceId || undefined,
        reason,
        activityType: activityType || undefined,
        activityConfidence: Number.isFinite(activityConfidence)
          ? Number(activityConfidence)
          : undefined
      });
      await db.points.add({
        routeId,
        lat,
        lng,
        timestamp: now,
        source: 'PASSIVE',
        accountKey: accountKey || undefined,
        deviceId: deviceId || undefined
      });
      lastPassiveLogTime.value = now;
      lastPassivePointTime.value = now;
      lastPassiveActivityType.value = activityType ? String(activityType).toUpperCase() : null;
      lastPassiveLat.value = lat;
      lastPassiveLng.value = lng;
    }

    // Geofence
    await checkGeofences(lat, lng);

    // Strava: Active Recording
    if (isRecording.value && activeRouteId.value) {
      if (velocityKMH > AUTO_PAUSE_SPEED_THRESHOLD) {
        const accountKey = getAccountKey();
        const deviceId = await getDeviceId();
        await db.points.add({
          routeId: activeRouteId.value,
          lat,
          lng,
          timestamp: now,
          source: 'ACTIVE',
          accountKey: accountKey || undefined,
          deviceId: deviceId || undefined
        });
        pathCoords.value.push({ lat, lng });
      }
    }
  }

  async function ensurePassiveRoute(
    now: number,
    accountKey: string | null,
    deviceId: string | null,
    activityType: string | null,
    lat: number,
    lng: number
  ): Promise<number> {
    const normalizedType = activityType ? String(activityType).toUpperCase() : null;
    const movingTypes = new Set(['WALKING', 'RUNNING', 'DRIVING']);
    const movingByType = normalizedType !== null && movingTypes.has(normalizedType);
    const prevMovingByType =
      lastPassiveActivityType.value !== null && movingTypes.has(String(lastPassiveActivityType.value).toUpperCase());
    const hasPrevCoords = Number.isFinite(lastPassiveLat.value) && Number.isFinite(lastPassiveLng.value);
    const movedMeters = hasPrevCoords
      ? haversine(
          { lat: Number(lastPassiveLat.value), lng: Number(lastPassiveLng.value) },
          { lat, lng }
        )
      : Number.POSITIVE_INFINITY;
    const movingByDistance = hasPrevCoords && movedMeters >= PASSIVE_STATIONARY_EXIT_RADIUS_M;
    const isMovingNow = movingByType || movingByDistance;
    const wasMovingBefore = prevMovingByType;
    const routeAgeMs =
      passiveRouteStartedAt.value > 0 ? Math.max(0, now - passiveRouteStartedAt.value) : 0;
    const departedAfterDwell =
      hasPrevCoords &&
      !wasMovingBefore &&
      routeAgeMs >= PASSIVE_STATIONARY_DWELL_MS &&
      isMovingNow &&
      movedMeters >= PASSIVE_STATIONARY_EXIT_RADIUS_M;
    const stationaryLike =
      hasPrevCoords &&
      movedMeters <= PASSIVE_STATIONARY_REUSE_RADIUS_M &&
      !isMovingNow &&
      !wasMovingBefore;
    const maxGap = stationaryLike ? PASSIVE_STATIONARY_REUSE_GAP_MS : PASSIVE_ROUTE_BREAK_MS;
    const maxDuration = stationaryLike
      ? PASSIVE_STATIONARY_MAX_ROUTE_DURATION_MS
      : PASSIVE_MAX_ROUTE_DURATION_MS;
    const splitByGap = !passiveRouteId.value || (now - lastPassivePointTime.value) > maxGap;
    const splitByDuration = passiveRouteStartedAt.value > 0 && (now - passiveRouteStartedAt.value) > maxDuration;
    const shouldSplit = splitByGap || splitByDuration || departedAfterDwell;

    if (shouldSplit) {
      if (passiveRouteId.value) {
        await db.routes.update(passiveRouteId.value, { endedAt: lastPassivePointTime.value || now });
      }
      passiveRouteId.value = await db.routes.add({
        timestamp: now,
        source: 'PASSIVE',
        accountKey: accountKey || undefined,
        deviceId: deviceId || undefined,
        startedAt: now
      });
      passiveRouteStartedAt.value = now;
    }
    return passiveRouteId.value;
  }

  async function checkGeofences(lat: number, lng: number) {
    await ensureGeofencesLoaded();
    if (!geofences.value.length) {
      isAtHome.value = false;
      return;
    }

    const now = Date.now();
    const transitionUpdates: Array<{ id: number; state: 'inside' | 'outside'; name: string }> = [];
    let insideAny = false;
    let insideAnyHome = false;
    let hasNamedHome = false;

    for (const geofence of geofences.value) {
      if (!geofence.enabled) {
        continue;
      }
      const d = haversine({ lat, lng }, geofence);
      const wasInside = geofence.lastState === 'inside';
      const nextInside = wasInside
        ? d <= geofence.radius + GEOFENCE_EXIT_BUFFER_M
        : d <= geofence.radius;
      const isHomeNamed = /home/i.test(geofence.name);
      hasNamedHome = hasNamedHome || isHomeNamed;
      insideAny = insideAny || nextInside;
      if (isHomeNamed && nextInside) insideAnyHome = true;

      if (nextInside !== wasInside) {
        transitionUpdates.push({
          id: geofence.id,
          state: nextInside ? 'inside' : 'outside',
          name: geofence.name
        });
      }
    }

    for (const update of transitionUpdates) {
      await db.geofences.update(update.id, {
        lastState: update.state,
        lastTransitionAt: now,
        updatedAt: now
      });
      await notify('Geofence', `${update.state === 'inside' ? 'Entered' : 'Exited'} ${update.name}`);
    }
    if (transitionUpdates.length) await loadGeofences();
    isAtHome.value = hasNamedHome ? insideAnyHome : insideAny;
  }

  async function notify(title: string, body: string) {
    // LocalNotifications ID must fit in signed Java int.
    const now = Date.now() % 2_000_000_000;
    notificationSeq = (notificationSeq + 1) % 1000;
    const id = Math.trunc(now + notificationSeq);
    await LocalNotifications.schedule({ notifications: [{ title, body, id }] });
  }

  async function startActiveRecording() {
    await Geolocation.requestPermissions();
    const now = Date.now();
    const accountKey = getAccountKey();
    const deviceId = await getDeviceId();
    const id = await db.routes.add({
      timestamp: now,
      source: 'ACTIVE',
      accountKey: accountKey || undefined,
      deviceId: deviceId || undefined,
      startedAt: now
    });
    activeRouteId.value = id;
    isRecording.value = true;
    distance.value = 0;
    stepCount.value = 0;
    pedometerDistance.value = 0;
    pathCoords.value = [];
    lastActivePoint = null;
    await startPedometer();
  }

  async function stopActiveRecording() {
    const routeId = activeRouteId.value;
    const now = Date.now();
    if (routeId) {
      await db.routes.update(routeId, { endedAt: now });
    }
    isRecording.value = false;
    activeRouteId.value = null;
    lastActivePoint = null;
    await stopPedometer();
  }

  async function ingestActiveLocation(lat: number, lng: number, speedMS = 0) {
    if (!isRecording.value || !activeRouteId.value) return;
    const now = Date.now();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    currentPosition.value = { lat, lng };
    const accountKey = getAccountKey();
    const deviceId = await getDeviceId();

    const point = { lat, lng, timestamp: now };
    if (lastActivePoint) {
      const d = haversine(lastActivePoint, point);
      distance.value += d / 1000;
      const dt = Math.max(1, (now - lastActivePoint.timestamp) / 1000);
      const computedSpeed = (d / dt) * 3.6;
      speed.value = Number.isFinite(speedMS) && speedMS > 0 ? speedMS * 3.6 : computedSpeed;
    } else {
      speed.value = Number.isFinite(speedMS) && speedMS > 0 ? speedMS * 3.6 : 0;
    }

    await db.points.add({
      routeId: activeRouteId.value,
      lat,
      lng,
      timestamp: now,
      source: 'ACTIVE',
      accountKey: accountKey || undefined,
      deviceId: deviceId || undefined
    });

    pathCoords.value.push({ lat, lng });
    lastActivePoint = point;
  }

  async function logActivityDetectionLocation(type = 'UNKNOWN', confidence = 0) {
    const now = Date.now();
    if ((now - lastActivityLogTime.value) < ACTIVITY_LOG_MIN_INTERVAL_MS) {
      return;
    }

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        maximumAge: 15_000,
        timeout: 10_000
      });
      const lat = position?.coords?.latitude;
      const lng = position?.coords?.longitude;
      const speedMS = Number(position?.coords?.speed || 0);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      await handleNewLocation(lat, lng, speedMS, true, 'activity', type, confidence);
      lastActivityLogTime.value = now;
      if (import.meta.client && localStorage.getItem(ACTIVITY_LOCATION_NOTIFICATION_KEY) === '1') {
        try {
          await notify(
            "Activity + Location",
            `${type} (${confidence}%) @ ${lat.toFixed(5)}, ${lng.toFixed(5)}`
          );
        } catch (notifyErr) {
          console.warn('[GeoStore] Activity logged but notification failed:', notifyErr);
        }
      }
      console.log(`[GeoStore] Activity-triggered location logged (${type}, confidence=${confidence})`);
    } catch (err) {
      console.error('[GeoStore] Failed to log location on activity detection:', err);
    }
  }

  async function startPedometer() {
    try {
      const available = await CapacitorPedometer.isAvailable();
      if (!available.stepCounting) return;
      await CapacitorPedometer.requestPermissions();
      pedometerListener = await CapacitorPedometer.addListener('measurement', (data: any) => {
        if (data.numberOfSteps !== undefined) stepCount.value = data.numberOfSteps;
        if (data.distance !== undefined) pedometerDistance.value = data.distance;
      });
      await CapacitorPedometer.startMeasurementUpdates();
    } catch (err) { console.error(err); }
  }

  async function stopPedometer() {
    try {
      await CapacitorPedometer.stopMeasurementUpdates();
      if (pedometerListener) { await pedometerListener.remove(); pedometerListener = null; }
    } catch (err) { console.error(err); }
  }

  function haversine(p1: any, p2: any): number {
    const R = 6371e3;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(p2.lat - p1.lat);
    const dLon = toRad(p2.lng - p1.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  if (import.meta.client) {
    void loadGeofences();
  }

  return {
    currentPosition, isRecording, isPassiveTracking, activeRouteId,
    speed, distance, stepCount, pedometerDistance, pathCoords, isAtHome, homeLocation, geofences,
    syncPassiveTrackingState,
    initializePassiveTracking, stopPassiveTracking,
    startActiveRecording, stopActiveRecording, logActivityDetectionLocation, ingestActiveLocation,
    loadGeofences, createGeofence, updateGeofence, removeGeofence
  };
});
