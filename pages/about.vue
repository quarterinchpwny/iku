<template>
  <div class="h-screen w-full">
    <div ref="mapContainer" class="h-full w-full" />

    <!-- Controls -->
    <div class="absolute left-4 top-4 z-[9999] space-y-2 text-black">
      <div class="min-w-[200px] rounded bg-white/90 p-3 text-sm shadow">
        <div class="font-semibold text-green-600" v-if="isTracking">🟢 LIVE TRACKING</div>
        <p><strong>Speed:</strong> {{ speed.toFixed(2) }} km/h</p>
        <p><strong>Distance:</strong> {{ distance.toFixed(2) }} km</p>

        <!-- Buttons -->
        <div class="mt-2 flex flex-col space-y-1">
          <button
            v-if="!isTracking"
            @click="startTracking"
            class="rounded bg-blue-600 px-3 py-1 text-white"
          >
            Start Tracking
          </button>
          <button
            v-if="isTracking"
            @click="stopTracking"
            class="rounded bg-red-600 px-3 py-1 text-white"
          >
            Stop Tracking
          </button>

          <!-- History -->
          <select
            v-model="selectedRouteId"
            @change="loadRoute"
            class="mt-2 w-full rounded border p-1"
          >
            <option disabled value="">📜 Select History</option>
            <option v-for="r in historyRoutes" :key="r.id" :value="r.id">
              🕓 {{ new Date(r.timestamp).toLocaleString() }}
            </option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { Geolocation } from '@capacitor/geolocation';
import { db } from '@/db/index.js';
import 'leaflet/dist/leaflet.css';

const mapContainer = ref(null);
const map = ref(null);
const polyline = ref(null);
const userMarker = ref(null);

const pathCoords = ref([]);
const distance = ref(0);
const speed = ref(0);
const isTracking = ref(false);

let watchId = null;
let routeId = null;
let lastPoint = null;

// History
const historyRoutes = ref([]);
const selectedRouteId = ref('');

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
  if (!import.meta.client) return;
  const L = await import('leaflet');

  map.value = L.map(mapContainer.value).setView([0, 0], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map.value);

  const pos = await Geolocation.getCurrentPosition();
  const start = L.latLng(pos.coords.latitude, pos.coords.longitude);
  map.value.setView(start, 17);

  userMarker.value = L.circleMarker(start, {
    radius: 8,
    color: 'blue',
    fillColor: '#3b82f6',
    fillOpacity: 0.9
  }).addTo(map.value);

  // Load history list
  historyRoutes.value = await db.routes.orderBy('timestamp').reverse().toArray();
});

onUnmounted(() => {
  if (watchId) Geolocation.clearWatch({ id: watchId });
});

async function startTracking() {
  const L = await import('leaflet');
  await Geolocation.requestPermissions();

  isTracking.value = true;
  routeId = await db.routes.add({ timestamp: Date.now() });
  distance.value = 0;
  speed.value = 0;
  pathCoords.value = [];
  lastPoint = null;

  watchId = await Geolocation.watchPosition({}, async (position, err) => {
    if (!position) return;
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const newPoint = L.latLng(lat, lon);
    const timestamp = Date.now();

    pathCoords.value.push(newPoint);

    if (!polyline.value) {
      polyline.value = L.polyline(pathCoords.value, { color: 'blue' }).addTo(map.value);
    } else {
      polyline.value.setLatLngs(pathCoords.value);
    }

    if (!userMarker.value) {
      userMarker.value = L.circleMarker(newPoint, {
        radius: 8,
        color: 'blue',
        fillColor: '#3b82f6',
        fillOpacity: 0.9
      }).addTo(map.value);
    } else {
      userMarker.value.setLatLng(newPoint);
    }

    map.value.panTo(newPoint);

    await db.points.add({ routeId, lat, lon, timestamp });

    if (lastPoint) {
      const d = haversine(lastPoint, newPoint);
      distance.value += d / 1000;
      const dt = (timestamp - lastPoint.timestamp) / 1000;
      if (dt > 0) speed.value = (d / dt) * 3.6;
    }

    lastPoint = { ...newPoint, timestamp };
  });
}

async function stopTracking() {
  if (watchId) {
    Geolocation.clearWatch({ id: watchId });
    watchId = null;
  }

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

  const coords = points.map((p) => L.latLng(p.lat, p.lon));

  // Clear previous path
  if (polyline.value) polyline.value.remove();
  if (userMarker.value) userMarker.value.remove();

  polyline.value = L.polyline(coords, { color: 'purple' }).addTo(map.value);
  map.value.fitBounds(polyline.value.getBounds());
}
</script>
