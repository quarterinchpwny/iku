<template>
  <div class="flex min-h-screen w-full flex-col pb-16">
    <div ref="mapContainer" class="h-[80%] w-full" />

    <!-- UI Overlay -->
    <div class="absolute left-4 top-4 z-[9999] space-y-2 text-black">
      <div class="min-w-[200px] rounded bg-white/90 p-3 text-sm shadow">
        

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
      <p><strong>Rotation :</strong> {{ headingAlpha ?? 'N/A' }}</p>
      <p><strong>GPS Heading:</strong> {{ gpsHeading ?? 'N/A' }}</p>
      <p><strong>Used:</strong> {{ usedHeadingSource }}</p>
      <p>
        <strong>Motion Permission:</strong>
        {{ motionPermissionGranted ? 'Granted' : 'Denied/Unknown' }}
      </p>
      <hr class="my-2 border-gray-700" />
      <div class="h-full overflow-y-auto">
        <p v-for="(log, index) in testLogs" :key="index" class="text-xs">{{ log }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Geolocation } from '@capacitor/geolocation';
import { Motion } from '@capacitor/motion';
import { db } from '@/db/index.js';
import 'leaflet/dist/leaflet.css';

const mapContainer = ref(null);
const map = ref(null);
const polyline = ref(null);
const userMarker = ref(null);
const directionCone = ref(null);
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
  if (!import.meta.client) return;
  const L = await import('leaflet');

  map.value = L.map(mapContainer.value);
  L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png').addTo(
    map.value
  );

  const pos = await Geolocation.getCurrentPosition();
  const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
  map.value.setView(latlng, 17);

  userMarker.value = L.circleMarker(latlng, {
    radius: 8,
    color: 'blue',
    fillColor: '#3b82f6',
    fillOpacity: 0.9
  }).addTo(map.value);

  await startHeadingTracking();

  watchId = await Geolocation.watchPosition(
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
      minimumUpdateInterval: 1000
    },
    async (position) => {
      if (!position) return;
      const { latitude: lat, longitude: lon, heading: gpsH, speed: gpsSpeed } = position.coords;
      testLogs.value.push(`GPS: Lat=${lat.toFixed(4)}, Lon=${lon.toFixed(4)}, H=${gpsH?.toFixed(2) ?? 'N/A'}, S=${gpsSpeed?.toFixed(2) ?? 'N/A'}`);
      gpsHeading.value = gpsH;
      const latlng = L.latLng(lat, lon);

      userMarker.value?.setLatLng(latlng);
      map.value?.panTo(latlng);

      await updateHeadingCone(lat, lon);

      if (isTracking.value && routeId !== null) {
        const timestamp = Date.now();
        const newPoint = L.latLng(lat, lon);

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

        await db.points.add({ routeId, lat, lon, timestamp });
        lastPoint = { ...newPoint, timestamp };
      }
    }
  );

  historyRoutes.value = await db.routes.orderBy('timestamp').reverse().toArray();
});

onUnmounted(() => {
  if (watchId) Geolocation.clearWatch({ id: watchId });
  Motion.removeAllListeners();
});



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

  const coords = points.map((p) => L.latLng(p.lat, p.lon));

  polyline.value?.remove();
  polyline.value = L.polyline(coords, { color: 'purple' }).addTo(map.value);

  userMarker.value?.remove();
  userMarker.value = L.circleMarker(coords[coords.length - 1], {
    radius: 8,
    color: 'purple',
    fillColor: 'purple',
    fillOpacity: 0.8
  }).addTo(map.value);

  map.value.fitBounds(polyline.value.getBounds());
}

async function startHeadingTracking() {
  try {
    await Motion.addListener('orientation', (event) => {
      testLogs.value.push(event);
      if (typeof event.rotation?.alpha === 'number') {
        headingAlpha.value = event.rotation.alpha;
        testLogs.value.push(`Motion Alpha: ${headingAlpha.value.toFixed(2)}`);
      }
    });
  } catch (e) {
    console.warn('Motion listener failed:', e);
  }
}

async function updateHeadingCone(lat, lon) {
  const L = await import('leaflet');

  let angleDeg;
  if (headingAlpha.value != null) {
    usedHeadingSource.value = 'Motion';
    angleDeg = (360 - headingAlpha.value) % 360;
  } else if (gpsHeading.value != null && gpsHeading.value >= 0) {
    usedHeadingSource.value = 'GPS';
    angleDeg = gpsHeading.value;
  } else {
    usedHeadingSource.value = 'None';
    return;
  }

  const angle = angleDeg * (Math.PI / 180);

  const base = L.latLng(lat, lon);
  const forward = 0.0001;
  const side = 0.00005;

  const tip = L.latLng(base.lat + forward * Math.cos(angle), base.lng + forward * Math.sin(angle));
  const left = L.latLng(
    base.lat + side * Math.cos(angle - Math.PI / 2),
    base.lng + side * Math.sin(angle - Math.PI / 2)
  );
  const right = L.latLng(
    base.lat + side * Math.cos(angle + Math.PI / 2),
    base.lng + side * Math.sin(angle + Math.PI / 2)
  );

  const points = [left, tip, right];

  if (!directionCone.value) {
    directionCone.value = L.polygon(points, {
      color: 'orange',
      fillColor: 'orange',
      fillOpacity: 0.4,
      weight: 1
    }).addTo(map.value);
  } else {
    directionCone.value.setLatLngs(points);
  }
}
</script>
