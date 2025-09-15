<template>
  <div class="flex h-screen w-full flex-col">
    <div ref="mapContainer" class="h-[80%] w-full" />

    <!-- UI Overlay -->
    <div class="absolute left-4 top-4 z-[9999] space-y-2 text-black">
      <div class="min-w-[200px] rounded bg-white/90 p-3 text-sm shadow">
        <div v-if="!motionPermissionGranted">
          <button
            class="mb-2 rounded bg-yellow-600 px-3 py-1 text-white"
            @click="requestMotionPermission"
          >
            🧭 Request Motion Permission
          </button>
        </div>

        <div v-if="isTracking" class="font-semibold text-green-600">🟢 LIVE TRACKING</div>
        <p><strong>Speed:</strong> {{ speed.toFixed(2) }} km/h</p>
        <p><strong>Distance:</strong> {{ distance.toFixed(2) }} km</p>

        <div class="mt-2 flex flex-col space-y-1">
          <button
            v-if="!isTracking"
            class="rounded bg-blue-600 px-3 py-1 text-white"
            @click="startTracking"
          >
            Start Tracking
          </button>
          <button
            v-if="isTracking"
            class="rounded bg-red-600 px-3 py-1 text-white"
            @click="stopTracking"
          >
            Stop Tracking
          </button>

          <!-- Route History -->
          <select
            v-model="selectedRouteId"
            class="mt-2 w-full rounded border p-1"
            @change="loadRoute"
          >
            <option disabled value="">📜 Select History</option>
            <option v-for="r in historyRoutes" :key="r.id" :value="r.id">
              🕓 {{ new Date(r.timestamp).toLocaleString() }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Motion Log -->
    <div class="h-[20%] overflow-auto bg-black p-2 text-sm text-white">
      <div @click="testInsert()">TEST</div>
      <p><strong>Rotation :</strong> {{ headingAlpha ?? 'N/A' }}</p>
      <p><strong>GPS Heading:</strong> {{ gpsHeading ?? 'N/A' }}</p>
      <p><strong>Used:</strong> {{ usedHeadingSource }}</p>
      <p>
        <strong>Motion Permission:</strong>
        {{ motionPermissionGranted ? 'Granted' : 'Denied/Unknown' }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Geolocation } from '@capacitor/geolocation';
import { Motion } from '@capacitor/motion';
import { db } from '@/db/index.js';
import 'leaflet/dist/leaflet.css';

import { syncDownFromCloudflare } from '~/db';

const interval = ref(0);

const mapContainer = ref(null);
const map = ref(null);
const polyline = ref(null);
const userMarker = ref(null);
// Remove directionCone ref
const testLogs = ref([]);

const pathCoords = ref([]);
const distance = ref(0);
const speed = ref(0);
const isTracking = ref(false);

const headingAlpha = ref(null);
const gpsHeading = ref(null);
const usedHeadingSource = ref('');
const motionPermissionGranted = ref(false);

const historyRoutes = ref([]);
const selectedRouteId = ref('');

let watchId = null;
let routeId = null;
let lastPoint = null;

const MIN_MOVEMENT_METERS = 0.3;

function haversine(p1, p2) {
  const R = 6371e3;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(p2.lat - p1.lat);
  const dLon = toRad(p2.lng - p1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

onMounted(async () => {
  // Initial sync
  await syncDownFromCloudflare();
  console.log('✅ Local Dexie DB refreshed from Cloudflare');

  // Load routes into history
  historyRoutes.value = await db.routes.orderBy('timestamp').reverse().toArray();

  // Refresh every 60s
  interval.value = setInterval(async () => {
    await syncDownFromCloudflare();
    historyRoutes.value = await db.routes.orderBy('timestamp').reverse().toArray();
  }, 60000);

  if (!import.meta.client) return;
  const L = await import('leaflet');

  map.value = L.map(mapContainer.value);
  L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png').addTo(
    map.value
  );

  let latlng;

  // Try Capacitor first
  try {
    const pos = await Geolocation.getCurrentPosition();
    latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
  } catch (err) {
    console.warn('⚠️ Capacitor Geolocation failed, falling back to browser API.', err);

    // Try browser geolocation
    latlng = await new Promise((resolve) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(L.latLng(pos.coords.latitude, pos.coords.longitude)),
          (error) => {
            console.warn('⚠️ Browser geolocation failed, using default.', error);
            resolve(L.latLng(14.5995, 120.9842)); // Manila fallback
          }
        );
      } else {
        console.warn('⚠️ No geolocation available, using default.');
        resolve(L.latLng(14.5995, 120.9842));
      }
    });
  }

  map.value.setView(latlng, 17);

  // Custom icon for the user marker
  const userIcon = L.divIcon({
    className: 'custom-user-marker',
    html: `
      <div class="user-dot" style="background-color: #3b82f6; border: 2px solid blue; border-radius: 50%; width: 16px; height: 16px;"></div>
      <div class="direction-cone-icon" style="transform: rotate(0deg);"></div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  userMarker.value = L.marker(latlng, { icon: userIcon }).addTo(map.value);

  // Watch position: Capacitor → Browser → Fallback
  try {
    watchId = await Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
        minimumUpdateInterval: 500
      },
      (position) => {
        if (!position) return;
        handlePositionUpdate(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.heading
        );
      }
    );
  } catch (err) {
    console.warn('⚠️ Capacitor watchPosition failed, trying browser watchPosition.');

    if ('geolocation' in navigator) {
      navigator.geolocation.watchPosition(
        (pos) =>
          handlePositionUpdate(pos.coords.latitude, pos.coords.longitude, pos.coords.heading),
        (error) => console.warn('⚠️ Browser watchPosition failed.', error),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    }
  }

  historyRoutes.value = await db.routes.orderBy('timestamp').reverse().toArray();
});

function handlePositionUpdate(lat, lng, gpsH) {
  gpsHeading.value = gpsH ?? null;
  const latlng = L.latLng(lat, lng);

  userMarker.value?.setLatLng(latlng);
  map.value?.panTo(latlng);

  updateHeadingCone();

  if (isTracking.value && routeId !== null) {
    const timestamp = Date.now();
    const newPoint = L.latLng(lat, lng);

    if (lastPoint) {
      const d = haversine(lastPoint, newPoint);
      if (d < MIN_MOVEMENT_METERS) return;

      distance.value += d / 1000;
      const dt = (timestamp - lastPoint.timestamp) / 1000;
      if (dt > 0) speed.value = (d / dt) * 3.6;
    }

    pathCoords.value.push(newPoint);

    if (!polyline.value) {
      polyline.value = L.polyline(pathCoords.value, { color: 'blue' }).addTo(map.value);
    } else {
      polyline.value.setLatLngs(pathCoords.value);
    }

    db.points.add({ routeId, lat, lng, timestamp });
    lastPoint = { ...newPoint, timestamp };
  }
}

onUnmounted(() => {
  clearInterval(interval.value);
  if (watchId) Geolocation.clearWatch({ id: watchId });
  Motion.removeAllListeners();
});

async function requestMotionPermission() {
  try {
    await DeviceMotionEvent.requestPermission?.();
    motionPermissionGranted.value = true;
    console.log('Motion permission granted');
  } catch (err) {
    console.warn('Motion permission denied or not available', err);
    motionPermissionGranted.value = false;
  }
}

async function startTracking() {
  await Geolocation.requestPermissions();
  isTracking.value = true;
  routeId = await db.routes.add({ timestamp: Date.now() });
  distance.value = 0;
  speed.value = 0;
  pathCoords.value = [];
  lastPoint = null;
}

async function stopTracking() {
  isTracking.value = false;
  historyRoutes.value = await db.routes.orderBy('timestamp').reverse().toArray();
}

async function loadRoute() {
  if (!selectedRouteId.value) return;
  const L = await import('leaflet');

  const points = await db.points
    .where('routeId')
    .equals(Number(selectedRouteId.value))
    .sortBy('timestamp');

  if (!points.length) return;

  const coords = points.map((p) => L.latLng(p.lat, p.lng));

  polyline.value?.remove();
  polyline.value = L.polyline(coords, { color: 'purple' }).addTo(map.value);

  // When loading a route, display the marker at the end of the route
  // We can choose to hide the cone or keep it if we have heading data for that point
  userMarker.value?.setLatLng(coords[coords.length - 1]);
  // Optionally, reset or hide the cone if not live tracking
  updateHeadingCone(); // Call without angle to potentially hide or set to default

  map.value.fitBounds(polyline.value.getBounds());
}

async function startHeadingTracking() {
  try {
    await Motion.addListener('orientation', (event) => {
      testLogs.value.push(event);
      if (typeof event.rotation?.alpha === 'number') {
        headingAlpha.value = event.rotation.alpha;
        motionPermissionGranted.value = true;
        updateHeadingCone(); // Update cone on motion event
      }
    });
  } catch (e) {
    console.warn('Motion listener failed:', e);
  }
}

function updateHeadingCone() {
  let angleDeg;
  if (headingAlpha.value != null) {
    usedHeadingSource.value = 'Motion';
    angleDeg = (360 - headingAlpha.value) % 360; // Adjust for Leaflet's coordinate system if needed
  } else if (gpsHeading.value != null && gpsHeading.value >= 0) {
    usedHeadingSource.value = 'GPS';
    angleDeg = gpsHeading.value;
  } else {
    usedHeadingSource.value = 'None';
    // If no heading, you might want to hide the cone or set a default orientation
    const coneElement = userMarker.value?._icon?.querySelector('.direction-cone-icon');
    if (coneElement) {
      coneElement.style.display = 'none'; // Hide the cone
    }
    return;
  }

  const coneElement = userMarker.value?._icon?.querySelector('.direction-cone-icon');
  if (coneElement) {
    coneElement.style.display = 'block'; // Ensure it's visible
    coneElement.style.transform = `rotate(${angleDeg}deg)`;
  }
}

async function testInsert() {
  // 1. Create a new route locally
  const routeId = await db.routes.add({
    timestamp: new Date().toISOString()
  });

  console.log('Created local route:', routeId);

  // 2. Insert sample points (Pasig, Manila)
  const samplePoints = [
    { lat: 14.5764, lng: 121.0851 }, // Pasig City Hall
    { lat: 14.58, lng: 121.09 }, // Kapitolyo
    { lat: 14.57, lng: 121.095 } // Ortigas
  ];

  const pointsToInsert = samplePoints.map((p) => ({
    routeId,
    lat: p.lat,
    lng: p.lng,
    timestamp: Date.now()
  }));

  await db.points.bulkAdd(pointsToInsert);

  console.log('Inserted test points for route', routeId);
}
</script>
<style scoped>
/* In your Vue component's style block or a global CSS file */
.custom-user-marker {
  /* Any styling for the overall marker container if needed */
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative; /* Important for absolute positioning of children */
}

.user-dot {
  background-color: #3b82f6;
  border: 2px solid blue;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  z-index: 10; /* Ensure dot is above the cone's base */
  position: relative; /* To ensure z-index applies */
}

.direction-cone-icon {
  width: 0;
  height: 0;
  border-left: 15px solid transparent; /* Adjust size as needed */
  border-right: 15px solid transparent; /* Adjust size as needed */
  border-bottom: 30px solid rgba(59, 130, 246, 0.7); /* Blue color with opacity, matching the image */
  position: absolute;
  top: -30px; /* Adjust to position the tip correctly above the marker */
  left: 50%; /* Center horizontally */
  transform: translateX(-50%) rotate(0deg); /* Adjust transform to center and rotate */
  transform-origin: 50% 100%; /* Rotate around the bottom center of the triangle */
  z-index: 5; /* Ensure cone is behind the dot but above the map */
}
</style>
