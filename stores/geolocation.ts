import { defineStore } from 'pinia';
import { ref } from 'vue';
import { BackgroundGeolocation } from '@capgo/background-geolocation';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { CapacitorPedometer } from '@capgo/capacitor-pedometer';
import { db } from '@/db/index.js';
import { Heartbeat, type HeartbeatStatus } from '@/lib/heartbeat';

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
  const PASSIVE_FALLBACK_HEARTBEAT_MINUTES = 60;
  const PASSIVE_ROUTE_BREAK_MS = 30 * 60 * 1000; // 30 minutes
  const passiveRouteId = ref<number | null>(null);
  const lastPassivePointTime = ref(0);

  // Auto-segment settingsalidade_smooth_dark
  const AUTO_PAUSE_SPEED_THRESHOLD = 1.0; // km/h

  // Geofencing
  const homeLocation = ref({ lat: 14.5764, lng: 121.0851, radius: 100 });
  const isAtHome = ref(false);
  const heartbeatDebug = ref<HeartbeatStatus | null>(null);

  let pedometerListener: any = null;

  async function startNativeHeartbeat(intervalMinutes = PASSIVE_FALLBACK_HEARTBEAT_MINUTES) {
    
    if (!Capacitor.isNativePlatform()) return;

    try {
      heartbeatDebug.value = await Heartbeat.start({ intervalMinutes });
      isPassiveTracking.value = !!heartbeatDebug.value?.enabled;
      if (!heartbeatDebug.value?.exactAlarmGranted) {
        alert('Exact alarm permission is not granted; heartbeat may be less precise.');
      }
    } catch (err) {
      console.error('Failed to start native heartbeat:', err);
    }
  }

  async function stopNativeHeartbeat() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      heartbeatDebug.value = await Heartbeat.stop();
    } catch (err) {
      console.error('Failed to stop native heartbeat:', err);
    }
  }

  async function syncPassiveTrackingState() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const status = await Heartbeat.status();
      heartbeatDebug.value = status;
      isPassiveTracking.value = !!status.enabled;
    } catch (err) {
      console.error('Failed to read native heartbeat status:', err);
    }
  }

  async function refreshHeartbeatDebug() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      heartbeatDebug.value = await Heartbeat.status();
    } catch (err) {
      console.error('Failed to refresh heartbeat debug:', err);
    }
  }

  async function runHeartbeatNow() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      heartbeatDebug.value = await Heartbeat.runNow();
      setTimeout(refreshHeartbeatDebug, 1500);
    } catch (err) {
      console.error('Failed to run heartbeat now:', err);
    }
  }

  async function clearHeartbeatDebug() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      heartbeatDebug.value = await Heartbeat.clearDebug();
    } catch (err) {
      console.error('Failed to clear heartbeat debug:', err);
    }
  }

  async function requestExactAlarmPermission() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      heartbeatDebug.value = await Heartbeat.requestExactAlarmPermission();
      setTimeout(refreshHeartbeatDebug, 1500);
    } catch (err) {
      console.error('Failed to request exact alarm permission:', err);
    }
  }

  // --- Actions ---

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

      await startNativeHeartbeat(PASSIVE_FALLBACK_HEARTBEAT_MINUTES);
      isPassiveTracking.value = true;
      console.log('Passive tracking started');
    } catch (err) { 
      console.error("Failed to start background tracking:", err); 
      alert("Error starting background tracking: " + err);
    }
  }

  async function stopPassiveTracking() {
    try {
      await BackgroundGeolocation.stop();
      await stopNativeHeartbeat();
      isPassiveTracking.value = false;
      passiveRouteId.value = null;
      lastPassivePointTime.value = 0;
      console.log('Passive tracking stopped');
    } catch (err) {
      console.error("Failed to stop background tracking:", err);
    }
  }

  async function handleNewLocation(lat: number, lng: number, velocityMS: number) {
    const now = Date.now();
    console.log(`[GeoStore] Location Update: ${lat}, ${lng} at ${new Date(now).toLocaleTimeString()}`);
    currentPosition.value = { lat, lng };
    const velocityKMH = velocityMS * 3.6;
    speed.value = velocityKMH;

    // Life360: Passive Log
    if (now - lastPassiveLogTime.value > PASSIVE_LOG_INTERVAL) {
      const routeId = await ensurePassiveRoute(now);
      await db.passive_locations.add({ lat, lng, timestamp: now });
      await db.points.add({ routeId, lat, lng, timestamp: now });
      lastPassiveLogTime.value = now;
      lastPassivePointTime.value = now;
    }

    // Geofence
    await checkGeofences(lat, lng);

    // Strava: Active Recording
    if (isRecording.value && activeRouteId.value) {
      if (velocityKMH > AUTO_PAUSE_SPEED_THRESHOLD) {
        await db.points.add({ routeId: activeRouteId.value, lat, lng, timestamp: now });
        pathCoords.value.push({ lat, lng });
      }
    }
  }

  async function ensurePassiveRoute(now: number): Promise<number> {
    if (!passiveRouteId.value || (now - lastPassivePointTime.value) > PASSIVE_ROUTE_BREAK_MS) {
      passiveRouteId.value = await db.routes.add({ timestamp: now });
    }
    return passiveRouteId.value;
  }

  async function checkGeofences(lat: number, lng: number) {
    const d = haversine({ lat, lng }, homeLocation.value);
    const atHome = d <= homeLocation.value.radius;
    if (atHome && !isAtHome.value) {
      notify("Geofence", "Entered Home Zone");
      if (Capacitor.isNativePlatform()) {
        try {
          await Heartbeat.enqueueTransition({
            event: 'enter',
            description: 'home',
            lat,
            lng,
            accuracy: 0
          });
        } catch (err) {
          console.error('Failed to enqueue enter transition:', err);
        }
      }
    }
    if (!atHome && isAtHome.value) {
      notify("Geofence", "Left Home Zone");
      if (Capacitor.isNativePlatform()) {
        try {
          await Heartbeat.enqueueTransition({
            event: 'leave',
            description: 'home',
            lat,
            lng,
            accuracy: 0
          });
        } catch (err) {
          console.error('Failed to enqueue leave transition:', err);
        }
      }
    }
    isAtHome.value = atHome;
  }

  async function notify(title: string, body: string) {
    await LocalNotifications.schedule({ notifications: [{ title, body, id: Date.now() }] });
  }

  async function startActiveRecording() {
    await Geolocation.requestPermissions();
    const id = await db.routes.add({ timestamp: Date.now() });
    activeRouteId.value = id;
    isRecording.value = true;
    distance.value = 0;
    stepCount.value = 0;
    pedometerDistance.value = 0;
    pathCoords.value = [];
    await startPedometer();
  }

  async function stopActiveRecording() {
    isRecording.value = false;
    activeRouteId.value = null;
    await stopPedometer();
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

  return {
    currentPosition, isRecording, isPassiveTracking, activeRouteId,
    speed, distance, stepCount, pedometerDistance, pathCoords, isAtHome, heartbeatDebug,
    startNativeHeartbeat,
    initializePassiveTracking, stopPassiveTracking, syncPassiveTrackingState,
    refreshHeartbeatDebug, runHeartbeatNow, clearHeartbeatDebug, requestExactAlarmPermission,
    startActiveRecording, stopActiveRecording
  };
});
