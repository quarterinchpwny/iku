<template>
  <div class="relative flex h-[calc(100vh-4rem)] w-full flex-col md:h-screen overflow-hidden">
    <div ref="mapContainer" class="absolute inset-0 h-full w-full z-0" />

    <div class="absolute left-4 right-4 top-4 z-20 p-4 backdrop-blur-md" style="
        background-color: rgba(var(--bg-card-rgb, 0, 0, 0), 0.7);
        border: 1px solid var(--border-col);
        border-radius: var(--radius-main);
        box-shadow: var(--shadow-main);
      ">
      <div class="mb-2 flex items-start justify-between">
        <span class="text-xs font-bold uppercase" :style="{ color: 'var(--accent)' }">> TACTICAL_SITREP.LOG</span>
        <i class="ph ph-x cursor-pointer text-[var(--text-muted)]"></i>
      </div>
      <div class="font-mono text-xs leading-relaxed text-[var(--text-main)]">
        <span class="cursor-blink">_</span>
      </div>
    </div>
    <motion.div :initial="{ opacity: 0 }" :animate="{ opacity: 1 }"
      class="pointer-events-none absolute inset-0 z-[9999]">
      <motion.div :transition="{ duration: 0.6 }" :variants="expandVariants"
        :animate="willExpand ? 'expand' : 'notexpand'" class="motion-container">
        <motion.nav ref="containerRef" :initial="false" :animate="isOpen ? 'open' : 'closed'"
          :custom="dimensions.height" class="nav pointer-events-auto">
          <motion.div class="background" :variants="sidebarVariants" />
          <button class="hidden-toggle" @click="willExpand = !willExpand" v-if="willExpand">
            <svg width="23" height="23" viewBox="0 0 23 23">
              <motion.path fill="transparent" stroke-width="3" stroke="hsl(0, 0%, 18%)" stroke-linecap="round"
                :variants="{ closed: { d: 'M 2 2.5 L 20 2.5' }, open: { d: 'M 3 16.5 L 17 2.5' } }" />
              <motion.path fill="transparent" stroke-width="3" stroke="hsl(0, 0%, 18%)" stroke-linecap="round"
                d="M 2 9.423 L 20 9.423" :variants="{ closed: { opacity: 1 }, open: { opacity: 0 } }"
                :transition="{ duration: 0.1 }" />
              <motion.path fill="transparent" stroke-width="3" stroke="hsl(0, 0%, 18%)" stroke-linecap="round"
                :variants="{
                  closed: { d: 'M 2 16.346 L 20 16.346' },
                  open: { d: 'M 3 2.5 L 17 16.346' }
                }" />
            </svg>
          </button>

          <motion.div class="absolute w-full p-5" :variants="navVariants">
            <motion.div :variants="itemVariants">
              <div class="mt-2 flex flex-col space-y-1">
                <button v-if="!isTracking" class="rounded bg-blue-600 px-3 py-1 text-white" @click="startTracking">
                  Start Tracking
                </button>
                <button v-if="isTracking" class="rounded bg-red-600 px-3 py-1 text-white" @click="stopTracking">
                  Stop Tracking
                </button>
                <button @click="drawORSRoute(14.5764, 121.0851, 14.57, 121.095)">Get Route</button>

                <select v-model="selectedRouteId" class="mt-2 w-full rounded border p-1" @change="loadRoute">
                  <option disabled value="">📜 Select History</option>
                  <option v-for="r in historyRoutes" :key="r.id" :value="r.id">
                    🕓 {{ new Date(r.timestamp).toLocaleString() }}
                  </option>
                </select>
              </div>
            </motion.div>
          </motion.div>

          <!-- <motion.ul class="list" :variants="navVariants">
            <motion.li :variants="itemVariants">
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
                <button @click="drawORSRoute(14.5764, 121.0851, 14.57, 121.095)">Get Route</button>

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
            </motion.li>
            <template v-if="!willExpand && isOpen">
              <motion.li
                v-for="i in 5"
                :key="i - 1"
                class="list-item"
                :variants="itemVariants"
                :whilePress="{ scale: 0.95 }"
                :whileHover="{ scale: 1.1 }"
              >
                <div
                  class="icon-placeholder"
                  :style="{ border: `2px solid ${colors[i - 1]}` }"
                  @click="willExpand = !willExpand"
                />
                <div class="text-placeholder" :style="{ border: `2px solid ${colors[i - 1]}` }" />
              </motion.li>
            </template>
<template v-if="willExpand">
              <motion.div
                :initial="{ opacity: 0, scale: 0 }"
                :animate="{ opacity: 1, scale: 1 }"
                :transition="{
                  duration: 0.3,
                  scale: { type: 'spring', visualDuration: 0.4, bounce: 0.5 },
                  delay: 0.3
                }"
                class="ball"
              >
                balagbag
              </motion.div>
            </template>
</motion.ul> -->

          <button class="toggle-container" @click="toggle" v-if="!willExpand">
            <svg width="23" height="23" viewBox="0 0 23 23">
              <motion.path fill="transparent" stroke-width="3" stroke="hsl(0, 0%, 18%)" stroke-linecap="round"
                :variants="{ closed: { d: 'M 2 2.5 L 20 2.5' }, open: { d: 'M 3 16.5 L 17 2.5' } }" />
              <motion.path fill="transparent" stroke-width="3" stroke="hsl(0, 0%, 18%)" stroke-linecap="round"
                d="M 2 9.423 L 20 9.423" :variants="{ closed: { opacity: 1 }, open: { opacity: 0 } }"
                :transition="{ duration: 0.1 }" />
              <motion.path fill="transparent" stroke-width="3" stroke="hsl(0, 0%, 18%)" stroke-linecap="round"
                :variants="{
                  closed: { d: 'M 2 16.346 L 20 16.346' },
                  open: { d: 'M 3 2.5 L 17 16.346' }
                }" />
            </svg>
          </button>
        </motion.nav>
      </motion.div>
    </motion.div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Geolocation } from '@capacitor/geolocation';
import { Motion } from '@capacitor/motion';
import { db } from '@/db/index.js';
import 'leaflet/dist/leaflet.css';

import { animate } from 'motion-v';

import { syncDownFromCloudflare } from '~/db';

import { motion, useDomRef, type MotionProps } from 'motion-v';

const colors = ['#FF008C', '#D309E1', '#9C1AFF', '#7700FF', '#4400FF'];

const config = useRuntimeConfig();

let animationMarker = null; // Leaflet marker

const interval = ref(0);

const mapContainer = ref(null);
const map = ref(null);
const polyline = ref(null);
const userMarker = ref(null);

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
const isOpen = ref(false);
const containerRef = useDomRef();
const dimensions = ref({ width: 0, height: 0 });
const willExpand = ref(false);

const toggle = () => {
  isOpen.value = !isOpen.value;
};

const navVariants: MotionProps['variants'] = {
  open: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } },
  closed: { transition: { staggerChildren: 0.05, staggerDirection: -1 } }
};

const itemVariants = {
  open: { y: 0, opacity: 1, transition: { y: { stiffness: 1000, velocity: -100 } } },
  closed: { y: 50, opacity: 0, transition: { y: { stiffness: 1000 } } }
};

const sidebarVariants: MotionProps['variants'] = {
  open: (height: any = 1000) => ({
    clipPath: `circle(${height * 2 + 200}px at calc(100% - 40px) calc(100% - 40px))`,
    transition: { type: 'spring', stiffness: 20, restDelta: 2 }
  }),
  closed: {
    clipPath: 'circle(30px at calc(100% - 40px) calc(100% - 40px))',
    transition: { type: 'spring', stiffness: 400, damping: 40 }
  }
};

const expandVariants: MotionProps['variants'] = {
  expand: {
    height: '100vh',
    width: '100vw',
    top: 0,
    left: 0,
    bottom: '70px',
    right: '0',
    borderRadius: '0px',
    transition: { duration: 0.2 }
  },
  notexpand: {
    height: '400px',
    width: '500px',
    bottom: '70px',
    right: '0',
    top: 'auto',
    left: 'auto',
    borderRadius: '20px',
    transition: { duration: 0.3, ease: 'easeIn' }
  }
};
// Draw route and prepare marker
async function drawORSRoute(startLat, startLng, endLat, endLng) {
  toggle();
  console.log(isOpen.value);

  const res = await fetch('https://api.openrouteservice.org/v2/directions/foot-walking/geojson', {
    method: 'POST',
    headers: {
      Authorization: config.public.orsKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      coordinates: [
        [startLng, startLat],
        [endLng, endLat]
      ]
    })
  });

  const data = await res.json();
  const routeCoords = data.features[0].geometry.coordinates.map(([lng, lat]) => L.latLng(lat, lng));

  // remove old polyline
  if (polyline?.value) polyline.value.remove();

  // create an SVG layer polyline with dashed stroke
  polyline.value = L.polyline(routeCoords, {
    color: 'orange',
    weight: 4,
    dashArray: '8 8', // dashed pattern
    dashOffset: '0'
  }).addTo(map.value);

  map.value.fitBounds(polyline.value.getBounds());

  // Animate the dash offset (walking ants)
  const pathEl = polyline.value._path; // Leaflet's SVG path element
  animate(
    pathEl,
    { strokeDashoffset: [-16] },
    {
      duration: 1.5,
      repeat: Infinity,
      easing: 'linear'
    }
  );

  // drop animated marker at start
  addAnimatedMarker(routeCoords[0]);
  animateMarkerAlong(routeCoords);
}

// Add marker with inner div so we can rotate it
function addAnimatedMarker(startLatLng) {
  const icon = L.divIcon({
    html: `
      <!-- Main Indicator Dot -->
      <div class="w-4 h-4 rounded-full border-2 border-[var(--bg-main)] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 transition-colors" 
            style="background-color: var(--accent); box-shadow: 0 0 5px var(--accent)"></div>

      <!-- Pulse Ring (optional, but good for visibility) -->
      <div class="absolute w-full h-full opacity-30 animate-ping rounded-full top-0 left-0 transition-colors" style="background-color: var(--accent)"></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  if (animationMarker) animationMarker.remove();
  animationMarker = L.marker(startLatLng, { icon }).addTo(map.value);
}
function animateMarkerAlong(coords) {
  if (!animationMarker) return;

  const steps = coords.length;

  animate(0, steps - 1, {
    duration: 10,
    easing: 'linear',
    onUpdate(latest) {
      const index = Math.floor(latest);
      const nextIndex = Math.min(index + 1, steps - 1);
      const t = latest - index; // fractional between points

      const p1 = coords[index];
      const p2 = coords[nextIndex];

      // simple linear interpolation between p1 and p2
      const lat = p1.lat + (p2.lat - p1.lat) * t;
      const lng = p1.lng + (p2.lng - p1.lng) * t;

      animationMarker.setLatLng([lat, lng]);
    }
  });
}

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

watch(isOpen, (value) => {
  if (!value) willExpand.value = false;
});

onMounted(async () => {
  // Initial sync
  if (containerRef.value) {
    dimensions.value.width = containerRef.value.offsetWidth;
    dimensions.value.height = containerRef.value.offsetHeight;
  }
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

  map.value = L.map(mapContainer.value, {
    zoomControl: false,
    attributionControl: false
  });
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
      <!-- Main Indicator Dot -->
      <div class="w-4 h-4 rounded-full border-2 border-[var(--bg-main)] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 transition-colors" 
            style="background-color: var(--accent); box-shadow: 0 0 5px var(--accent)"></div>

      <!-- Pulse Ring (optional, but good for visibility) -->
      <div class="absolute w-full h-full opacity-30 animate-ping rounded-full top-0 left-0 transition-colors" style="background-color: var(--accent)"></div>
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
    console.warn('⚠️ Capacitor watchPosition failed, trying browser watchPosition.', err);

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

onUnmounted(() => {
  clearInterval(interval.value);
  if (watchId) Geolocation.clearWatch({ id: watchId });
  Motion.removeAllListeners();
});
</script>
<style scoped>
.custom-user-marker {
  /* Any styling for the overall marker container if needed */
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  /* Important for absolute positioning of children */
}

.user-dot {
  background-color: #3b82f6;
  border: 2px solid blue;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  z-index: 10;
  /* Ensure dot is above the cone's base */
  position: relative;
  /* To ensure z-index applies */
}

.direction-cone-icon {
  width: 0;
  height: 0;
  border-left: 15px solid transparent;
  /* Adjust size as needed */
  border-right: 15px solid transparent;
  /* Adjust size as needed */
  border-bottom: 30px solid rgba(59, 130, 246, 0.7);
  /* Blue color with opacity, matching the image */
  position: absolute;
  top: -30px;
  /* Adjust to position the tip correctly above the marker */
  left: 50%;
  /* Center horizontally */
  transform: translateX(-50%) rotate(0deg);
  /* Adjust transform to center and rotate */
  transform-origin: 50% 100%;
  /* Rotate around the bottom center of the triangle */
  z-index: 5;
  /* Ensure cone is behind the dot but above the map */
}

.leaflet-overlay-pane svg path.walking-ants {
  stroke: orange;
  stroke-width: 4;
  stroke-dasharray: 8 12;
}

/*motion*/
.motion-container {
  position: absolute;
  max-width: 100%;
  /* background-color: var(--accent); */
  overflow: hidden;
  bottom: 110px;
  right: 0;
  top: auto;
  left: auto;
}

.nav {
  width: 300px;
}

.background {
  background-color: #f5f5f5;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 100%;
}

.toggle-container,
.hidden-toggle {
  outline: none;
  border: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  cursor: pointer;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: transparent;
}

.toggle-container {
  position: absolute;
  bottom: 12px;
  right: 0;
}

.hidden-toggle {
  position: absolute;
  top: 0px;
  left: 20px;
}

.list {
  list-style: none;
  padding: 25px;
  margin: 0;
  position: absolute;
  width: 230px;
}

.list-item {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 20px;
  cursor: pointer;
}

.icon-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex: 40px 0;
  margin-right: 20px;
}

.text-placeholder {
  border-radius: 5px;
  width: 200px;
  height: 20px;
  flex: 1;
}

.ball {
  width: 100px;
  height: 100px;
  background-color: #8df0cc;
  border-radius: 50%;
}
</style>
