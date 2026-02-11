<template>
  <div class="relative flex h-[calc(100vh-4rem)] w-full flex-col md:h-screen overflow-hidden">
    <!-- MAP CONTAINER -->
    <div ref="mapContainer" class="absolute inset-0 h-full w-full z-0" />

    <!-- MAP LOADING OVERLAY -->
    <transition name="fade-overlay">
      <div v-if="mapLoading" class="absolute inset-0 z-50 flex flex-col items-center justify-center"
        style="background: #0a0a0a;">
        <div class="map-loader-ring mb-4"></div>
        <span class="font-mono text-xs uppercase tracking-widest text-orange-500 animate-pulse">
          Initializing Map...
        </span>
      </div>
    </transition>

    <!-- ═══════════════════════════════════════════════════════════════
         ROUTE SEARCH MODAL
    ═══════════════════════════════════════════════════════════════ -->
    <transition name="modal-fade">
      <div v-if="showRouteModal" class="absolute inset-0 z-[10000] flex items-end justify-center pb-6 px-4"
        style="background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);" @click.self="showRouteModal = false">
        <div class="route-modal w-full max-w-md" role="dialog" aria-modal="true" aria-label="Route Search">
          <!-- Modal Header -->
          <div class="modal-header flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="modal-tag">ROUTE_PLANNER</span>
              <span class="modal-tag-dim">ORS v2</span>
            </div>
            <button class="modal-close-btn" @click="showRouteModal = false" aria-label="Close modal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <!-- Origin Field -->
          <div class="search-field-group mb-3">
            <label class="field-label">
              <span class="field-dot bg-emerald-400"></span>
              ORIGIN
            </label>
            <div class="search-input-wrap">
              <input v-model="originQuery" type="text" placeholder="Search starting point..." class="search-input"
                @input="debouncedSearchOrigin" @focus="activeField = 'origin'" autocomplete="off" spellcheck="false" />
              <button v-if="originQuery" class="clear-btn" @click="clearOrigin" aria-label="Clear origin">✕</button>
            </div>

            <!-- Origin Result Chip (selected) -->
            <div v-if="selectedOrigin" class="result-chip mt-2">
              <span class="result-chip-dot bg-emerald-400"></span>
              <span class="result-chip-text">{{ selectedOrigin.label }}</span>
              <button class="result-chip-clear" @click="clearOrigin">✕</button>
            </div>

            <!-- Origin Suggestions Dropdown -->
            <transition name="dropdown-slide">
              <ul v-if="activeField === 'origin' && originSuggestions.length" class="suggestions-list mt-1">
                <li v-for="(s, i) in originSuggestions" :key="i" class="suggestion-item"
                  @mousedown.prevent="selectOrigin(s)">
                  <svg class="suggestion-icon" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="6" r="3" stroke="currentColor" stroke-width="1.2" />
                    <path d="M8 16C8 16 2 10.5 2 6a6 6 0 0112 0C14 10.5 8 16 8 16z" stroke="currentColor"
                      stroke-width="1.2" fill="none" />
                  </svg>
                  <div class="suggestion-text">
                    <span class="suggestion-name">{{ s.name }}</span>
                    <span class="suggestion-region">{{ s.region }}</span>
                  </div>
                </li>
                <li v-if="originLoading" class="suggestion-loading">
                  <span class="loading-dot"></span> Searching...
                </li>
              </ul>
            </transition>
          </div>

          <!-- Swap Button -->
          <div class="flex justify-center my-2">
            <button class="swap-btn" @click="swapLocations" title="Swap origin and destination">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M5 3L2 6M2 6L5 9M2 6H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                  stroke-linejoin="round" />
                <path d="M13 9L16 12M16 12L13 15M16 12H5" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <!-- Destination Field -->
          <div class="search-field-group mb-4">
            <label class="field-label">
              <span class="field-dot bg-orange-400"></span>
              DESTINATION
            </label>
            <div class="search-input-wrap">
              <input v-model="destQuery" type="text" placeholder="Search destination..." class="search-input"
                @input="debouncedSearchDest" @focus="activeField = 'dest'" autocomplete="off" spellcheck="false" />
              <button v-if="destQuery" class="clear-btn" @click="clearDest" aria-label="Clear destination">✕</button>
            </div>

            <!-- Dest Result Chip (selected) -->
            <div v-if="selectedDest" class="result-chip mt-2">
              <span class="result-chip-dot bg-orange-400"></span>
              <span class="result-chip-text">{{ selectedDest.label }}</span>
              <button class="result-chip-clear" @click="clearDest">✕</button>
            </div>

            <!-- Destination Suggestions Dropdown -->
            <transition name="dropdown-slide">
              <ul v-if="activeField === 'dest' && destSuggestions.length" class="suggestions-list mt-1">
                <li v-for="(s, i) in destSuggestions" :key="i" class="suggestion-item"
                  @mousedown.prevent="selectDest(s)">
                  <svg class="suggestion-icon" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="6" r="3" stroke="currentColor" stroke-width="1.2" />
                    <path d="M8 16C8 16 2 10.5 2 6a6 6 0 0112 0C14 10.5 8 16 8 16z" stroke="currentColor"
                      stroke-width="1.2" fill="none" />
                  </svg>
                  <div class="suggestion-text">
                    <span class="suggestion-name">{{ s.name }}</span>
                    <span class="suggestion-region">{{ s.region }}</span>
                  </div>
                </li>
                <li v-if="destLoading" class="suggestion-loading">
                  <span class="loading-dot"></span> Searching...
                </li>
              </ul>
            </transition>
          </div>

          <!-- Profile selector -->
          <div class="profile-row mb-4">
            <button v-for="p in routeProfiles" :key="p.value" class="profile-btn"
              :class="{ 'profile-btn--active': selectedProfile === p.value }" @click="selectedProfile = p.value">
              <span class="profile-icon">{{ p.icon }}</span>
              <span class="profile-label">{{ p.label }}</span>
            </button>
          </div>

          <!-- Error -->
          <div v-if="routeError" class="route-error mb-3">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="shrink-0">
              <circle cx="7" cy="7" r="6" stroke="#ef4444" stroke-width="1.2" />
              <path d="M7 4v3M7 9.5v.5" stroke="#ef4444" stroke-width="1.2" stroke-linecap="round" />
            </svg>
            {{ routeError }}
          </div>

          <!-- Submit -->
          <button class="route-submit-btn" :disabled="!selectedOrigin || !selectedDest || routeLoading"
            @click="submitRoute">
            <span v-if="routeLoading" class="route-loading-ring"></span>
            <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
            <span>{{ routeLoading ? 'Calculating...' : 'Get Route' }}</span>
          </button>
        </div>
      </div>
    </transition>

    <!-- TACTICAL SITREP - Floating Overlay -->
    <div class="absolute left-4 right-4 top-4 z-20 p-4 backdrop-blur-md" style="
        background-color: rgba(0, 0, 0, 0.72);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      ">
      <div class="mb-2 flex items-start justify-between">
        <span class="text-xs font-bold uppercase tracking-widest text-orange-500">&gt; TACTICAL_SITREP.LOG
          {{ willExpand }}</span>
        <div class="flex items-center gap-2">
          <span v-if="isTracking" class="flex h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
          <span class="text-[10px] font-mono opacity-50 uppercase">{{ isTracking ? 'Recording' : 'Standby' }}</span>
        </div>
      </div>

      <div class="font-mono text-[10px] leading-relaxed text-white/80 space-y-1">
        <div class="flex justify-between border-b border-white/5 pb-1">
          <span class="text-white/40">STATUS:</span>
          <span :class="isTracking ? 'text-green-400' : 'text-zinc-500'">
            {{ isTracking ? 'ACTIVE_SCAN' : 'IDLE' }}
          </span>
        </div>

        <div v-if="isTracking" class="flex justify-between">
          <span class="text-white/40">ROUTE_ID:</span>
          <span class="text-cyan-400">{{ routeId }}</span>
        </div>

        <div v-if="currentPosition" class="flex justify-between">
          <span class="text-white/40">COORDS:</span>
          <span>{{ currentPosition.lat.toFixed(5) }}, {{ currentPosition.lng.toFixed(5) }}</span>
        </div>

        <div class="flex justify-between">
          <span class="text-white/40">HEADING:</span>
          <span :class="activeHeading !== null ? 'text-sky-400' : 'text-zinc-600'">
            {{ activeHeading !== null ? `${Math.round(activeHeading)}° (${usedHeadingSource})` : 'NO_SIGNAL' }}
          </span>
        </div>

        <div v-if="isTracking" class="flex justify-between">
          <span class="text-white/40">SPEED:</span>
          <span class="text-yellow-400">{{ speed.toFixed(1) }} km/h</span>
        </div>

        <div v-if="isTracking" class="flex justify-between">
          <span class="text-white/40">DIST:</span>
          <span class="text-emerald-400">{{ distance.toFixed(3) }} km</span>
        </div>

        <div v-if="isTracking" class="flex justify-between">
          <span class="text-white/40">POINTS:</span>
          <span class="text-blue-400">{{ pathCoords.length }}</span>
        </div>

        <div class="flex justify-between border-t border-white/5 pt-1 mt-1">
          <span class="text-white/40">STEPS:</span>
          <span :class="isTracking ? 'text-purple-400' : 'text-zinc-600'">
            {{ isTracking ? stepCount.toLocaleString() : 'UNAVAIL' }}
          </span>
        </div>

        <div v-if="isTracking" class="flex justify-between">
          <span class="text-white/40">STEP_DIST:</span>
          <span class="text-purple-300">{{ (pedometerDistance / 1000).toFixed(3) }} km</span>
        </div>

        <div class="pt-1 opacity-30">
          <span class="cursor-blink">_</span>
        </div>
      </div>
    </div>

    <!-- MOTION NAV -->
    <motion.div :initial="{ opacity: 0 }" :animate="{ opacity: 1 }"
      class="pointer-events-none absolute inset-0 z-[9999]">

      <!-- Panel (clipped, slides open) -->
      <motion.div :transition="{ duration: 0.6 }" :variants="expandVariants"
        :animate="willExpand ? 'expand' : 'notexpand'" class="motion-container">
        <motion.nav ref="containerRef" :initial="false" :animate="isOpen ? 'open' : 'closed'"
          :custom="dimensions.height" class="nav pointer-events-auto">

          <!-- Dark tactical background panel -->
          <motion.div class="background" :variants="sidebarVariants" />

          <!-- Scanline overlay (decorative) -->
          <div class="nav-scanlines" />

          <!-- Expand-mode close button (top-left) -->
          <button class="hidden-toggle" @click="willExpand = !willExpand" v-if="willExpand">
            <svg width="20" height="20" viewBox="0 0 23 23">
              <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round"
                :variants="{ closed: { d: 'M 2 2.5 L 20 2.5' }, open: { d: 'M 3 16.5 L 17 2.5' } }" />
              <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round"
                d="M 2 9.423 L 20 9.423" :variants="{ closed: { opacity: 1 }, open: { opacity: 0 } }"
                :transition="{ duration: 0.1 }" />
              <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round"
                :variants="{ closed: { d: 'M 2 16.346 L 20 16.346' }, open: { d: 'M 3 2.5 L 17 16.346' } }" />
            </svg>
          </button>

          <!-- Nav content -->
          <motion.div class="absolute w-full" :variants="navVariants">
            <motion.div :variants="itemVariants" style="background-color:rgba(0, 0, 0, 0.72)">

              <!-- Panel header -->
              <div class="nav-panel-header mb-4 px-4 pt-5 pb-16 w-full">
                <span class="nav-panel-title">&gt; CTRL_PANEL </span>
                <span class="nav-panel-dot" :class="isTracking ? 'nav-panel-dot--active' : ''"></span>
              </div>

              <div class="flex flex-col gap-2">

                <!-- Track buttons -->
                <button v-if="!isTracking" class="nav-btn nav-btn--primary" @click="startTracking">
                  <span class="nav-btn-icon">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <polygon points="2,1 11,6 2,11" />
                    </svg>
                  </span>
                  <span class="nav-btn-label">START_ACTIVITY</span>
                </button>
                <button v-if="isTracking" class="nav-btn nav-btn--danger" @click="stopTracking">
                  <span class="nav-btn-icon">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
                      <rect x="1" y="1" width="9" height="9" rx="1" />
                    </svg>
                  </span>
                  <span class="nav-btn-label">STOP_ACTIVITY</span>
                </button>

                <!-- Route button -->
                <button class="nav-btn nav-btn--route" @click="openRouteModal">
                  <span class="nav-btn-icon">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"
                      stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="3" cy="3" r="1.5" />
                      <circle cx="11" cy="11" r="1.5" />
                      <path d="M3 4.5C3 7 5 7 7 7s4 0 4 2.5" />
                    </svg>
                  </span>
                  <span class="nav-btn-label">PLAN_ROUTE</span>
                </button>

                <!-- Divider -->
                <div class="nav-divider">
                  <span class="nav-divider-label">HISTORY</span>
                </div>

                <!-- History select -->
                <div class="nav-select-wrap">
                  <svg class="nav-select-icon" width="12" height="12" viewBox="0 0 12 12" fill="none"
                    stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
                    <circle cx="6" cy="6" r="4.5" />
                    <path d="M6 3.5V6l1.5 1.5" />
                  </svg>
                  <select v-model="selectedRouteId" class="nav-select" @change="loadRoute">
                    <option disabled value="">SELECT_LOG</option>
                    <option v-for="r in historyRoutes" :key="r.id" :value="r.id">
                      {{ new Date(r.timestamp).toLocaleString() }}
                    </option>
                  </select>
                  <svg class="nav-select-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none"
                    stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                    <path d="M2 3.5L5 6.5L8 3.5" />
                  </svg>
                </div>

                <!-- Compass button -->
                <button class="nav-btn nav-btn--utility" @click="requestOrientationPermission">
                  <span class="nav-btn-icon">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"
                      stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="7" cy="7" r="5.5" />
                      <path d="M7 3.5V5M7 9v1.5M3.5 7H5M9 7h1.5" />
                      <circle cx="7" cy="7" r="1" fill="currentColor" />
                    </svg>
                  </span>
                  <span class="nav-btn-label">ENABLE_COMPASS</span>
                </button>

              </div>
            </motion.div>
          </motion.div>

        </motion.nav>
      </motion.div>

      <!-- Toggle orb — lives OUTSIDE the clipped panel so it's always visible -->
      <button v-if="!willExpand" class="toggle-container pointer-events-auto " @click="toggle" aria-label="Toggle nav">
        <div class="toggle-orb">
          <svg width="20" height="20" viewBox="0 0 23 23">
            <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round"
              :animate="isOpen ? 'open' : 'closed'"
              :variants="{ closed: { d: 'M 2 2.5 L 20 2.5' }, open: { d: 'M 3 16.5 L 17 2.5' } }" />
            <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round"
              d="M 2 9.423 L 20 9.423" :animate="isOpen ? 'open' : 'closed'"
              :variants="{ closed: { opacity: 1 }, open: { opacity: 0 } }" :transition="{ duration: 0.1 }" />
            <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round"
              :animate="isOpen ? 'open' : 'closed'"
              :variants="{ closed: { d: 'M 2 16.346 L 20 16.346' }, open: { d: 'M 3 2.5 L 17 16.346' } }" />
          </svg>
          <div class="toggle-orb-ring"></div>
        </div>
      </button>

    </motion.div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { Geolocation } from '@capacitor/geolocation';
import { CapacitorPedometer } from '@capgo/capacitor-pedometer';
import { db } from '@/db/index.js';
import 'leaflet/dist/leaflet.css';
import { animate } from 'motion-v';
import { motion, useDomRef, type MotionProps } from 'motion-v';
import { syncDownFromCloudflare } from '~/db';

const config = useRuntimeConfig();

let L: any = null;
let animationMarker: any = null;

const mapContainer = ref<HTMLElement | null>(null);
const map = ref<any>(null);
const polyline = ref<any>(null);
const userMarker = ref<any>(null);
const markerIconElement = ref<HTMLElement | null>(null);
const mapLoading = ref(true);

const pathCoords = ref<any[]>([]);
const distance = ref(0);
const speed = ref(0);
const isTracking = ref(false);

const headingAlpha = ref<number | null>(null);
const gpsHeading = ref<number | null>(null);
const smoothedHeading = ref<number | null>(null);
const usedHeadingSource = ref('None');
const currentPosition = ref<{ lat: number; lng: number } | null>(null);

const activeHeading = computed<number | null>(() => {
  if (headingAlpha.value !== null) {
    usedHeadingSource.value = 'Compass';
    return (360 - headingAlpha.value) % 360;
  }
  if (gpsHeading.value !== null && gpsHeading.value >= 0) {
    usedHeadingSource.value = 'GPS';
    return gpsHeading.value;
  }
  usedHeadingSource.value = 'None';
  return null;
});

const stepCount = ref(0);
const pedometerDistance = ref(0);
let pedometerListener: any = null;

const historyRoutes = ref<any[]>([]);
const selectedRouteId = ref('');

let watchId: any = null;
let routeId: number | null = null;
let lastPoint: any = null;
const interval = ref<number>(0);
const MIN_MOVEMENT_METERS = 0.3;

const isOpen = ref(false);
const containerRef = useDomRef();
const dimensions = ref({ width: 0, height: 0 });
const willExpand = ref(false);

const toggle = () => { isOpen.value = !isOpen.value; };

// ─── Route Search Modal State ─────────────────────────────────────────────────
const showRouteModal = ref(false);
const activeField = ref<'origin' | 'dest' | null>(null);

const originQuery = ref('');
const destQuery = ref('');
const originSuggestions = ref<any[]>([]);
const destSuggestions = ref<any[]>([]);
const originLoading = ref(false);
const destLoading = ref(false);
const selectedOrigin = ref<any>(null);
const selectedDest = ref<any>(null);
const routeLoading = ref(false);
const routeError = ref('');
const selectedProfile = ref('foot-walking');

const routeProfiles = [
  { value: 'foot-walking', icon: '🚶', label: 'Walk' },
  { value: 'cycling-regular', icon: '🚴', label: 'Bike' },
  { value: 'driving-car', icon: '🚗', label: 'Drive' },
];

function openRouteModal() {
  showRouteModal.value = true;
  routeError.value = '';
  // Pre-fill origin from current position
  if (currentPosition.value && !selectedOrigin.value) {
    selectedOrigin.value = {
      label: `${currentPosition.value.lat.toFixed(5)}, ${currentPosition.value.lng.toFixed(5)}`,
      name: 'Current Location',
      region: 'GPS',
      lat: currentPosition.value.lat,
      lng: currentPosition.value.lng,
    };
    originQuery.value = selectedOrigin.value.name;
  }
}

function clearOrigin() {
  originQuery.value = '';
  selectedOrigin.value = null;
  originSuggestions.value = [];
}

function clearDest() {
  destQuery.value = '';
  selectedDest.value = null;
  destSuggestions.value = [];
}

function swapLocations() {
  const tmpSelected = selectedOrigin.value;
  const tmpQuery = originQuery.value;
  selectedOrigin.value = selectedDest.value;
  originQuery.value = destQuery.value;
  selectedDest.value = tmpSelected;
  destQuery.value = tmpQuery;
}

// ─── ORS Geocoding ────────────────────────────────────────────────────────────
let originDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let destDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSearchOrigin() {
  selectedOrigin.value = null;
  if (originDebounceTimer) clearTimeout(originDebounceTimer);
  if (!originQuery.value.trim()) { originSuggestions.value = []; return; }
  originDebounceTimer = setTimeout(() => searchLocation(originQuery.value, 'origin'), 380);
}

function debouncedSearchDest() {
  selectedDest.value = null;
  if (destDebounceTimer) clearTimeout(destDebounceTimer);
  if (!destQuery.value.trim()) { destSuggestions.value = []; return; }
  destDebounceTimer = setTimeout(() => searchLocation(destQuery.value, 'dest'), 380);
}

async function searchLocation(query: string, field: 'origin' | 'dest') {
  if (field === 'origin') originLoading.value = true;
  else destLoading.value = true;

  try {
    // Bias results toward current position if available
    let focusParam = '';
    if (currentPosition.value) {
      focusParam = `&focus.point.lon=${currentPosition.value.lng}&focus.point.lat=${currentPosition.value.lat}`;
    }

    const url = `https://api.openrouteservice.org/geocode/search?api_key=${config.public.orsKey}&text=${encodeURIComponent(query)}&size=5${focusParam}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' }
    });

    if (!res.ok) throw new Error(`Geocode error: ${res.status}`);
    const data = await res.json();

    const results = (data.features || []).map((f: any) => ({
      label: f.properties.label || f.properties.name,
      name: f.properties.name || f.properties.label,
      region: [f.properties.county, f.properties.country].filter(Boolean).join(', '),
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }));

    if (field === 'origin') originSuggestions.value = results;
    else destSuggestions.value = results;
  } catch (err) {
    console.error('Geocode failed:', err);
    if (field === 'origin') originSuggestions.value = [];
    else destSuggestions.value = [];
  } finally {
    if (field === 'origin') originLoading.value = false;
    else destLoading.value = false;
  }
}

function selectOrigin(s: any) {
  selectedOrigin.value = s;
  originQuery.value = s.name;
  originSuggestions.value = [];
  activeField.value = null;
}

function selectDest(s: any) {
  selectedDest.value = s;
  destQuery.value = s.name;
  destSuggestions.value = [];
  activeField.value = null;
}

async function submitRoute() {
  if (!selectedOrigin.value || !selectedDest.value) return;
  routeError.value = '';
  routeLoading.value = true;

  try {
    await drawORSRoute(
      selectedOrigin.value.lat,
      selectedOrigin.value.lng,
      selectedDest.value.lat,
      selectedDest.value.lng
    );
    showRouteModal.value = false;
  } catch (err: any) {
    routeError.value = err?.message || 'Failed to calculate route. Please try again.';
  } finally {
    routeLoading.value = false;
  }
}

// ─── Motion / nav variants ────────────────────────────────────────────────────
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
    clipPath: `circle(${height * 2 + 200}px at 100% 100%)`,
    transition: { type: 'spring', stiffness: 20, restDelta: 2 }
  }),
  closed: {
    clipPath: 'circle(0px at 100% 100%)',
    transition: { type: 'spring', stiffness: 400, damping: 40 }
  }
};
const expandVariants: MotionProps['variants'] = {
  expand: {
    height: '100vh', width: '100vw', top: 0, left: 0,
    bottom: '0', right: '0', borderRadius: '0px',
    transition: { duration: 0.2 }
  },
  notexpand: {
    height: '420px', width: '280px', bottom: '176px', right: '0',
    top: 'auto', left: 'auto', borderRadius: '14px 0 0 14px',
    transition: { duration: 0.3, ease: 'easeIn' }
  }
};

// ─── Pedometer ───────────────────────────────────────────────────────────────
async function startPedometer() {
  try {
    const available = await CapacitorPedometer.isAvailable();
    if (!available.stepCounting) { console.warn('⚠️ Step counting not available'); return; }
    const permission = await CapacitorPedometer.requestPermissions();
    if (permission.activityRecognition !== 'granted') { console.warn('⚠️ Pedometer permission denied'); return; }
    stepCount.value = 0;
    pedometerDistance.value = 0;
    pedometerListener = await CapacitorPedometer.addListener('measurement', (data: any) => {
      if (data.numberOfSteps !== undefined) stepCount.value = data.numberOfSteps;
      if (data.distance !== undefined) pedometerDistance.value = data.distance;
    });
    await CapacitorPedometer.startMeasurementUpdates();
  } catch (err) { console.error('❌ Pedometer start failed:', err); }
}

async function stopPedometer() {
  try {
    await CapacitorPedometer.stopMeasurementUpdates();
    if (pedometerListener) { await pedometerListener.remove(); pedometerListener = null; }
  } catch (err) { console.error('❌ Pedometer stop failed:', err); }
}

// ─── Heading smoothing ────────────────────────────────────────────────────────
function normalizeAngle(angle: number): number {
  let n = angle % 360;
  if (n < 0) n += 360;
  return n;
}
function shortestAngleDifference(from: number, to: number): number {
  const diff = normalizeAngle(to - from);
  return diff > 180 ? diff - 360 : diff;
}
function interpolateHeading(current: number, target: number, alpha: number): number {
  return normalizeAngle(current + shortestAngleDifference(current, target) * alpha);
}

let headingSmoothingRAF: number | null = null;
function startHeadingSmoothing() {
  let lastTime = performance.now();
  const smoothStep = () => {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    const target = headingAlpha.value !== null ? headingAlpha.value
      : (gpsHeading.value !== null && gpsHeading.value >= 0 ? gpsHeading.value : null);
    if (target !== null) {
      smoothedHeading.value = smoothedHeading.value === null
        ? target
        : interpolateHeading(smoothedHeading.value, target, Math.min(dt * 3, 1));
    }
    updateHeadingCone();
    headingSmoothingRAF = requestAnimationFrame(smoothStep);
  };
  headingSmoothingRAF = requestAnimationFrame(smoothStep);
}
function stopHeadingSmoothing() {
  if (headingSmoothingRAF !== null) { cancelAnimationFrame(headingSmoothingRAF); headingSmoothingRAF = null; }
}

// ─── Device orientation ───────────────────────────────────────────────────────
async function requestOrientationPermission() {
  if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
    try {
      const state = await (DeviceOrientationEvent as any).requestPermission();
      if (state === 'granted') setupDeviceOrientationListener();
    } catch (err) { console.error(err); }
  } else {
    setupDeviceOrientationListener();
  }
}
function setupDeviceOrientationListener() {
  const handler = (event: DeviceOrientationEvent) => {
    if (event.alpha !== null) headingAlpha.value = event.alpha;
  };
  window.addEventListener('deviceorientation', handler, true);
  return () => window.removeEventListener('deviceorientation', handler, true);
}

// ─── User marker ─────────────────────────────────────────────────────────────
function buildUserMarkerHTML(): string {
  const cx = 60, cy = 60, r = 52;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(240));
  const y1 = cy + r * Math.sin(toRad(240));
  const x2 = cx + r * Math.cos(toRad(300));
  const y2 = cy + r * Math.sin(toRad(300));
  return `
    <div class="loc-marker-root">
      <div class="loc-accuracy-ring"></div>
      <svg class="loc-fan-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="fanGrad" cx="50%" cy="100%" r="100%" fx="50%" fy="100%">
            <stop offset="0%"   stop-color="#2196F3" stop-opacity="0.75"/>
            <stop offset="60%"  stop-color="#2196F3" stop-opacity="0.30"/>
            <stop offset="100%" stop-color="#2196F3" stop-opacity="0.00"/>
          </radialGradient>
        </defs>
        <path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z"
          fill="url(#fanGrad)" stroke="none"/>
      </svg>
      <div class="loc-dot"><div class="loc-dot-inner"></div></div>
    </div>`;
}

function createUserMarker(latlng: any) {
  const icon = L.divIcon({ className: '', html: buildUserMarkerHTML(), iconSize: [120, 120], iconAnchor: [60, 60] });
  userMarker.value = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(map.value);
  setTimeout(() => {
    if (userMarker.value?._icon) { markerIconElement.value = userMarker.value._icon; updateHeadingCone(); }
  }, 100);
}

function updateHeadingCone() {
  if (!markerIconElement.value) {
    if (userMarker.value?._icon) markerIconElement.value = userMarker.value._icon;
    else return;
  }
  const fan = markerIconElement.value.querySelector('.loc-fan-svg') as SVGElement | null;
  if (!fan) return;
  if (smoothedHeading.value !== null) {
    fan.style.display = 'block';
    fan.style.transform = `rotate(${smoothedHeading.value}deg)`;
    fan.style.opacity = '1';
  } else {
    fan.style.display = 'block';
    fan.style.transform = 'rotate(0deg)';
    fan.style.opacity = '0.3';
  }
}

// ─── Map init ─────────────────────────────────────────────────────────────────
async function initMap(latlng: any) {
  map.value = L.map(mapContainer.value, {
    zoomControl: false, attributionControl: false, fadeAnimation: true, zoomAnimation: true
  });
  const tileLayer = L.tileLayer(
    'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png',
    { maxZoom: 19, detectRetina: true }
  );
  tileLayer.addTo(map.value);
  map.value.setView(latlng, 17);
  tileLayer.on('tileload', () => { mapLoading.value = false; });
  setTimeout(() => { mapLoading.value = false; }, 2000);
}

// ─── ORS Route drawing ────────────────────────────────────────────────────────
async function drawORSRoute(startLat: number, startLng: number, endLat: number, endLng: number) {
  const res = await fetch(`https://api.openrouteservice.org/v2/directions/${selectedProfile.value}/geojson`, {
    method: 'POST',
    headers: {
      Authorization: config.public.orsKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ coordinates: [[startLng, startLat], [endLng, endLat]] })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ORS error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const routeCoords = data.features[0].geometry.coordinates.map(([lng, lat]: number[]) => L.latLng(lat, lng));

  if (polyline?.value) polyline.value.remove();
  polyline.value = L.polyline(routeCoords, {
    color: 'orange', weight: 4, dashArray: '8 8', dashOffset: '0'
  }).addTo(map.value);

  map.value.fitBounds(polyline.value.getBounds());

  const pathEl = polyline.value._path;
  animate(pathEl, { strokeDashoffset: [-16] }, { duration: 1.5, repeat: Infinity, easing: 'linear' });

  addAnimatedMarker(routeCoords[0]);
  animateMarkerAlong(routeCoords);
}

function addAnimatedMarker(startLatLng: any) {
  const icon = L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(251,146,60,0.3);animation:markerPulse 1.8s ease-out infinite;"></div>
        <div style="width:10px;height:10px;border-radius:50%;background:#f97316;border:2px solid #fff;box-shadow:0 0 6px rgba(249,115,22,0.7);z-index:10;"></div>
      </div>`,
    iconSize: [20, 20], iconAnchor: [10, 10]
  });
  if (animationMarker) animationMarker.remove();
  animationMarker = L.marker(startLatLng, { icon }).addTo(map.value);
}

function animateMarkerAlong(coords: any[]) {
  if (!animationMarker) return;
  const steps = coords.length;
  animate(0, steps - 1, {
    duration: 10, easing: 'linear',
    onUpdate(latest: number) {
      const index = Math.floor(latest);
      const nextIndex = Math.min(index + 1, steps - 1);
      const t = latest - index;
      const p1 = coords[index], p2 = coords[nextIndex];
      animationMarker.setLatLng([p1.lat + (p2.lat - p1.lat) * t, p1.lng + (p2.lng - p1.lng) * t]);
    }
  });
}

// ─── Haversine / position handling ───────────────────────────────────────────
function haversine(p1: any, p2: any): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(p2.lat - p1.lat);
  const dLon = toRad(p2.lng - p1.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function handlePositionUpdate(lat: number, lng: number, gpsH: number | null) {
  if (!L || lat === undefined || lng === undefined) return;
  gpsHeading.value = gpsH ?? null;
  currentPosition.value = { lat, lng };
  const latlng = L.latLng(lat, lng);
  if (userMarker.value) userMarker.value.setLatLng(latlng);
  if (map.value) map.value.panTo(latlng, { animate: true, duration: 0.5 });

  if (isTracking.value && routeId !== null) {
    const timestamp = Date.now();
    const newPoint = { lat, lng, timestamp };
    if (lastPoint) {
      const d = haversine(lastPoint, newPoint);
      if (d < MIN_MOVEMENT_METERS) return;
      distance.value += d / 1000;
      const dt = (timestamp - lastPoint.timestamp) / 1000;
      if (dt > 0) speed.value = (d / dt) * 3.6;
    }
    pathCoords.value.push(L.latLng(lat, lng));
    if (!polyline.value) {
      polyline.value = L.polyline(pathCoords.value, { color: '#3b82f6', weight: 4 }).addTo(map.value);
    } else {
      polyline.value.setLatLngs(pathCoords.value);
    }
    db.points.add({ routeId, lat, lng, timestamp });
    lastPoint = newPoint;
  }
}

// ─── Tracking ─────────────────────────────────────────────────────────────────
async function startTracking() {
  await Geolocation.requestPermissions();
  isTracking.value = true;
  routeId = await db.routes.add({ timestamp: Date.now() });
  distance.value = 0; speed.value = 0; pathCoords.value = []; lastPoint = null;
  await startPedometer();
}
async function stopTracking() {
  isTracking.value = false; speed.value = 0;
  await stopPedometer();
  historyRoutes.value = await db.routes.orderBy('timestamp').reverse().toArray();
}

async function loadRoute() {
  if (!selectedRouteId.value || !L) return;
  const points = await db.points.where('routeId').equals(Number(selectedRouteId.value)).sortBy('timestamp');
  if (!points.length) return;
  const coords = points.map((p: any) => L.latLng(p.lat, p.lng));
  if (polyline.value) polyline.value.remove();
  polyline.value = L.polyline(coords, { color: '#a855f7', weight: 3 }).addTo(map.value);
  if (userMarker.value) {
    userMarker.value.setLatLng(coords[coords.length - 1]);
    currentPosition.value = { lat: coords[coords.length - 1].lat, lng: coords[coords.length - 1].lng };
  }
  map.value.fitBounds(polyline.value.getBounds(), { padding: [40, 40] });
}

watch(isOpen, (value) => { if (!value) willExpand.value = false; });

let removeOrientationListener: (() => void) | null = null;
let syncIntervalId: number | null = null;

onMounted(async () => {
  if (containerRef.value) {
    dimensions.value.width = containerRef.value.offsetWidth;
    dimensions.value.height = containerRef.value.offsetHeight;
  }

  startHeadingSmoothing();

  const mapInitPromise = (async () => {
    if (!import.meta.client) return;
    L = await import('leaflet');
    let latlng: any;
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
      latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
      currentPosition.value = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (pos.coords.heading !== null && pos.coords.heading !== undefined) gpsHeading.value = pos.coords.heading;
    } catch (err) {
      console.warn('⚠️ Capacitor Geolocation failed, falling back.', err);
      latlng = await new Promise((resolve) => {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              currentPosition.value = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              if (pos.coords.heading !== null) gpsHeading.value = pos.coords.heading;
              resolve(L.latLng(pos.coords.latitude, pos.coords.longitude));
            },
            () => { currentPosition.value = { lat: 14.5995, lng: 120.9842 }; resolve(L.latLng(14.5995, 120.9842)); },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        } else {
          currentPosition.value = { lat: 14.5995, lng: 120.9842 };
          resolve(L.latLng(14.5995, 120.9842));
        }
      });
    }
    await initMap(latlng);
    createUserMarker(latlng);
    updateHeadingCone();
  })();

  await syncDownFromCloudflare();
  historyRoutes.value = await db.routes.orderBy('timestamp').reverse().toArray();
  syncIntervalId = setInterval(async () => {
    await syncDownFromCloudflare();
    historyRoutes.value = await db.routes.orderBy('timestamp').reverse().toArray();
  }, 60000) as unknown as number;

  await mapInitPromise;
  removeOrientationListener = setupDeviceOrientationListener();

  try {
    watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, minimumUpdateInterval: 500 },
      (position) => {
        if (!position) return;
        handlePositionUpdate(position.coords.latitude, position.coords.longitude, position.coords.heading);
      }
    );
  } catch (err) {
    console.warn('⚠️ Capacitor watchPosition failed, falling back.', err);
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => handlePositionUpdate(pos.coords.latitude, pos.coords.longitude, pos.coords.heading),
        (error) => console.warn('⚠️ Browser watchPosition failed.', error),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    }
  }

  historyRoutes.value = await db.routes.orderBy('timestamp').reverse().toArray();
});

onUnmounted(async () => {
  stopHeadingSmoothing();
  if (syncIntervalId !== null) clearInterval(syncIntervalId);
  if (watchId) {
    if (typeof watchId === 'string') await Geolocation.clearWatch({ id: watchId });
    else if (typeof watchId === 'number') navigator.geolocation.clearWatch(watchId);
  }
  await stopPedometer();
  if (removeOrientationListener) removeOrientationListener();
  if (animationMarker) animationMarker.remove();
  if (polyline.value) polyline.value.remove();
  if (userMarker.value) userMarker.value.remove();
  if (map.value) map.value.remove();
});
</script>

<style scoped>
/* ── Base transitions ── */
.fade-overlay-enter-active,
.fade-overlay-leave-active {
  transition: opacity 0.6s ease;
}

.fade-overlay-enter-from,
.fade-overlay-leave-to {
  opacity: 0;
}

.modal-fade-enter-active {
  transition: opacity 0.2s ease;
}

.modal-fade-leave-active {
  transition: opacity 0.15s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.dropdown-slide-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-slide-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.dropdown-slide-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.dropdown-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Map loader ── */
.map-loader-ring {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(255, 100, 0, 0.15);
  border-top-color: #f97316;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ═══════════════════════════════════════════════════════
   ROUTE SEARCH MODAL
═══════════════════════════════════════════════════════ */
.route-modal {
  background: #0f0f10;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 18px;
  padding: 20px;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.04),
    0 24px 64px rgba(0, 0, 0, 0.8),
    0 0 80px rgba(249, 115, 22, 0.04);
  /* Slide up from bottom */
  animation: modalSlideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1) both;
}

@keyframes modalSlideUp {
  from {
    transform: translateY(24px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 12px;
}

.modal-tag {
  font-family: monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  font-weight: 700;
  text-transform: uppercase;
  color: #f97316;
  background: rgba(249, 115, 22, 0.1);
  border: 1px solid rgba(249, 115, 22, 0.2);
  border-radius: 4px;
  padding: 2px 7px;
}

.modal-tag-dim {
  font-family: monospace;
  font-size: 9px;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 4px;
  padding: 2px 6px;
}

.modal-close-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.modal-close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
}

/* ── Fields ── */
.search-field-group {
  position: relative;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.3);
  margin-bottom: 6px;
}

.field-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.search-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 10px 36px 10px 12px;
  font-size: 14px;
  color: #fff;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  font-family: -apple-system, system-ui, sans-serif;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.2);
}

.search-input:focus {
  border-color: rgba(249, 115, 22, 0.5);
  background: rgba(255, 255, 255, 0.06);
}

.clear-btn {
  position: absolute;
  right: 10px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: color 0.1s;
  line-height: 1;
}

.clear-btn:hover {
  color: rgba(255, 255, 255, 0.7);
}

/* ── Result chip ── */
.result-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 6px 10px;
}

.result-chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.result-chip-text {
  flex: 1;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: -apple-system, system-ui, sans-serif;
}

.result-chip-clear {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.25);
  font-size: 10px;
  cursor: pointer;
  padding: 0 2px;
  transition: color 0.1s;
}

.result-chip-clear:hover {
  color: rgba(255, 255, 255, 0.6);
}

/* ── Suggestions dropdown ── */
.suggestions-list {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 100;
  background: #1a1a1c;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
  list-style: none;
  margin: 0;
  padding: 4px 0;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  cursor: pointer;
  transition: background 0.1s;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover {
  background: rgba(249, 115, 22, 0.08);
}

.suggestion-item:active {
  background: rgba(249, 115, 22, 0.13);
}

.suggestion-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.3);
}

.suggestion-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.suggestion-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: -apple-system, system-ui, sans-serif;
}

.suggestion-region {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  font-family: monospace;
  letter-spacing: 0.03em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  font-family: monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 0.05em;
}

.loading-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f97316;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 0.3;
  }

  50% {
    opacity: 1;
  }
}

/* ── Swap button ── */
.swap-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  flex-shrink: 0;
}

.swap-btn:hover {
  background: rgba(249, 115, 22, 0.1);
  border-color: rgba(249, 115, 22, 0.3);
  color: #f97316;
}

/* ── Profile selector ── */
.profile-row {
  display: flex;
  gap: 8px;
}

.profile-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.profile-btn:hover {
  background: rgba(255, 255, 255, 0.07);
}

.profile-btn--active {
  border-color: rgba(249, 115, 22, 0.5);
  background: rgba(249, 115, 22, 0.08);
}

.profile-icon {
  font-size: 18px;
  line-height: 1;
}

.profile-label {
  font-family: monospace;
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
}

.profile-btn--active .profile-label {
  color: #f97316;
}

/* ── Error ── */
.route-error {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 11px;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.07);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  padding: 8px 10px;
  font-family: monospace;
  line-height: 1.4;
}

/* ── Submit button ── */
.route-submit-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #f97316, #ea580c);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 16px rgba(249, 115, 22, 0.3);
}

.route-submit-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.route-submit-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.route-submit-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  box-shadow: none;
}

.route-loading-ring {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

/* ── Location marker (global) ── */
:global(.loc-marker-root) {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:global(.loc-accuracy-ring) {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(33, 150, 243, 0.18) 0%, rgba(33, 150, 243, 0.10) 55%, rgba(33, 150, 243, 0.00) 100%);
  box-shadow: 0 0 0 1px rgba(33, 150, 243, 0.20);
  pointer-events: none;
}

:global(.loc-fan-svg) {
  position: absolute;
  inset: 0;
  width: 120px;
  height: 120px;
  pointer-events: none;
  transform-origin: 50% 50%;
  filter: blur(1.5px);
  display: block;
  opacity: 1;
}

:global(.loc-dot) {
  position: relative;
  z-index: 10;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35), 0 0 0 2px #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

:global(.loc-dot-inner) {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #2196F3;
  box-shadow: 0 0 6px rgba(33, 150, 243, 0.7);
}

@keyframes markerPulse {
  0% {
    transform: scale(0.6);
    opacity: 0.5;
  }

  70% {
    transform: scale(2.0);
    opacity: 0;
  }

  100% {
    transform: scale(2.0);
    opacity: 0;
  }
}

/* ── Motion nav ── */
.motion-container {
  position: absolute;
  max-width: 100%;
  overflow: hidden;
  /* bottom: 110px; */
  right: 0;
  top: auto;
  left: auto;
}

.nav {
  width: 280px;
  position: relative;
}

/* Dark tactical panel - Aligned with SITREP overlay */
.background {
  background-color: rgba(10, 10, 12, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-right: none;
  border-radius: 16px 0 0 16px;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 100%;
  box-shadow:
    -8px 0 32px rgba(0, 0, 0, 0.6),
    inset 1px 1px 0 rgba(255, 255, 255, 0.03);
}

/* Scanlines overlay (decorative) */
.nav-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  border-radius: 16px 0 0 16px;
  background-image: repeating-linear-gradient(0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.1) 2px,
      rgba(0, 0, 0, 0.1) 4px);
  opacity: 0.4;
}

/* Panel header */
.nav-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 12px;
  position: relative;
  z-index: 2;
}

.nav-panel-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #f97316;
  text-shadow: 0 0 8px rgba(249, 115, 22, 0.3);
}

.nav-panel-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.nav-panel-dot--active {
  background: #ef4444;
  box-shadow: 0 0 8px #ef4444;
  animation: dotPulse 1.5s ease-in-out infinite;
}

@keyframes dotPulse {

  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

/* Nav buttons */
.nav-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
  transition: all 0.2s cubic-bezier(0.23, 1, 0.32, 1);
  position: relative;
  z-index: 2;
  overflow: hidden;
}

.nav-btn::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 0;
  background: currentColor;
  transition: height 0.2s ease;
}

.nav-btn:hover::before {
  height: 60%;
}

.nav-btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  flex-shrink: 0;
}

/* Primary (start) */
.nav-btn--primary {
  color: #22d3ee;
  border-color: rgba(34, 211, 238, 0.15);
}

.nav-btn--primary:hover {
  background: rgba(34, 211, 238, 0.08);
  border-color: rgba(34, 211, 238, 0.4);
  color: #fff;
  box-shadow: 0 0 15px rgba(34, 211, 238, 0.1);
}

/* Danger (stop) */
.nav-btn--danger {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.15);
}

.nav-btn--danger:hover {
  background: rgba(248, 113, 113, 0.08);
  border-color: rgba(248, 113, 113, 0.4);
  color: #fff;
}

/* Route — orange accent */
.nav-btn--route {
  color: #fb923c;
  border-color: rgba(251, 146, 60, 0.15);
}

.nav-btn--route:hover {
  background: rgba(251, 146, 60, 0.08);
  border-color: rgba(251, 146, 60, 0.4);
  color: #fff;
}

/* Utility — muted */
.nav-btn--utility {
  color: rgba(255, 255, 255, 0.4);
}

.nav-btn--utility:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
}

/* Divider */
.nav-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0 4px;
  position: relative;
  z-index: 2;
}

.nav-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.1), transparent);
}

.nav-divider-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.2em;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.2);
}

/* History select */
.nav-select-wrap {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 0 12px;
  z-index: 2;
  transition: all 0.2s ease;
}

.nav-select-wrap:hover {
  border-color: rgba(249, 115, 22, 0.3);
  background: rgba(0, 0, 0, 0.3);
}

.nav-select-icon {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.2);
}

.nav-select {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.05em;
  padding: 11px 8px;
  cursor: pointer;
  appearance: none;
}

.nav-select-chevron {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.15);
}

/* Toggle orb button */
.toggle-container {
  outline: none;
  border: none;
  cursor: pointer;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: transparent;
  padding: 0;
  position: absolute;
  bottom: 120px;
  right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.toggle-orb {
  position: relative;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: #0a0a0c;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle-container:hover .toggle-orb {
  border-color: rgba(249, 115, 22, 0.5);
  transform: translateY(-2px);
  box-shadow:
    0 12px 28px rgba(0, 0, 0, 0.6),
    0 0 20px rgba(249, 115, 22, 0.15);
}

.toggle-orb-ring {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 1px solid rgba(249, 115, 22, 0.15);
  animation: orbRingPulse 3s ease-in-out infinite;
  pointer-events: none;
}

@keyframes orbRingPulse {

  0%,
  100% {
    opacity: 0.4;
    transform: scale(1);
  }

  50% {
    opacity: 0.1;
    transform: scale(1.15);
  }
}

.hidden-toggle {
  outline: none;
  border: none;
  cursor: pointer;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 10;
  transition: all 0.2s ease;
}

.hidden-toggle:hover {
  background: rgba(249, 115, 22, 0.1);
  border-color: rgba(249, 115, 22, 0.3);
}

.cursor-blink {
  animation: blink 1.2s step-end infinite;
}

@keyframes blink {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}
</style>