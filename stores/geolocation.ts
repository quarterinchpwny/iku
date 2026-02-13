import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { BackgroundGeolocation } from '@capgo/background-geolocation';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';
import { LocalNotifications } from '@capacitor/local-notifications';
import { CapacitorPedometer } from '@capgo/capacitor-pedometer';
import { db } from '@/db/index.js';

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

  // Auto-segment settings
  const AUTO_PAUSE_SPEED_THRESHOLD = 1.0; // km/h

  // Geofencing
  const homeLocation = ref({ lat: 14.5764, lng: 121.0851, radius: 100 });
  const isAtHome = ref(false);

  let pedometerListener: any = null;
  let watcherId: string | null = null;

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
          if (location) {
            console.log('New background location:', location.latitude, location.longitude);
            handleNewLocation(location.latitude, location.longitude, location.speed || 0);
          }
        }
      );
      
      isPassiveTracking.value = true;
      console.log('Passive tracking started');
    } catch (err) { 
      console.error("Failed to start background tracking:", err); 
      alert("Error starting background tracking: " + err);
    }
  }

  async function stopPassiveTracking() {
    if (!isPassiveTracking.value) return;
    try {
      await BackgroundGeolocation.stop();
      isPassiveTracking.value = false;
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
      await db.passive_locations.add({ lat, lng, timestamp: now });
      lastPassiveLogTime.value = now;
    }

    // Geofence
    checkGeofences(lat, lng);

    // Strava: Active Recording
    if (isRecording.value && activeRouteId.value) {
      if (velocityKMH > AUTO_PAUSE_SPEED_THRESHOLD) {
        await db.points.add({ routeId: activeRouteId.value, lat, lng, timestamp: now });
        pathCoords.value.push({ lat, lng });
      }
    }
  }

  function checkGeofences(lat: number, lng: number) {
    const d = haversine({ lat, lng }, homeLocation.value);
    const atHome = d <= homeLocation.value.radius;
    if (atHome && !isAtHome.value) notify("Geofence", "Entered Home Zone");
    if (!atHome && isAtHome.value) notify("Geofence", "Left Home Zone");
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
    speed, distance, stepCount, pedometerDistance, pathCoords, isAtHome,
    initializePassiveTracking, stopPassiveTracking, startActiveRecording, stopActiveRecording
  };
});
