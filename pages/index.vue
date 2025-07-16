<template>
  <div class="h-screen w-full">
    <div ref="mapContainer" class="h-full w-full" />

    <!-- UI Overlay -->
    <div class="absolute left-4 top-4 z-[9999] space-y-2 text-black">
      <div class="min-w-[200px] rounded bg-white/90 p-3 text-sm shadow">
        <div class="font-semibold text-blue-600">🧭 Compass Active</div>
        <p><strong>Heading:</strong> {{ heading.toFixed(1) }}°</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Motion } from '@capacitor/motion';
import { Geolocation } from '@capacitor/geolocation';
import 'leaflet/dist/leaflet.css';

const mapContainer = ref(null);
const map = ref(null);
const userMarker = ref(null);
const directionCone = ref(null);
const heading = ref(0);
const watchId = ref(null);

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

  // Realtime location update
  watchId.value = await Geolocation.watchPosition({ enableHighAccuracy: true }, (position) => {
    if (!position) return;
    const { latitude, longitude } = position.coords;
    const newLatLng = L.latLng(latitude, longitude);
    userMarker.value?.setLatLng(newLatLng);
    updateHeadingCone(latitude, longitude);
  });

  await enableMotionPermission();
  startHeadingListener();
});

onUnmounted(() => {
  if (watchId.value) Geolocation.clearWatch({ id: watchId.value });
  Motion.removeAllListeners();
});

// 🔐 Ask for motion permission in web/iOS
async function enableMotionPermission() {
  if (
    typeof DeviceMotionEvent !== 'undefined' &&
    typeof DeviceMotionEvent.requestPermission === 'function'
  ) {
    try {
      const result = await DeviceMotionEvent.requestPermission();
      if (result !== 'granted') {
        alert('Motion permission denied');
      }
    } catch (err) {
      console.warn('Permission error', err);
    }
  }
}

// 🧭 Listen to heading changes
async function startHeadingListener() {
  await Motion.addListener('orientation', (event) => {
    if (!event.rotation?.alpha) return;
    heading.value = event.rotation.alpha;
  });
}

// 🧭 Draw facing direction cone
async function updateHeadingCone(lat, lon) {
  if (!map.value) return;
  const L = await import('leaflet');

  const angle = ((360 - heading.value) % 360) * (Math.PI / 180);

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
