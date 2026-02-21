<template>
  <div class="flex h-screen w-full flex-col bg-black p-2">
    <!-- OTA Update Indicator -->
    <div
      v-if="otaStore.updateAvailable"
      class="mb-4 rounded-lg bg-blue-600 p-4 text-white shadow-lg"
    >
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-bold">Update Available!</h3>
          <p class="text-xs opacity-90">Version {{ otaStore.latestVersion?.version }} is ready.</p>
        </div>
        <button
          @click="otaStore.performUpdate()"
          :disabled="otaStore.isUpdating"
          class="rounded bg-white px-4 py-2 text-sm font-semibold text-blue-600 active:scale-95 disabled:opacity-50"
        >
          {{ otaStore.isUpdating ? 'Updating...' : 'Update Now' }}
        </button>
      </div>
    </div>

    <ThemeSwitcher />

    <!-- Passive Tracking Status Badge & Toggle -->
    <div class="mt-2 flex flex-col gap-2 px-2">
      <div
        class="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
      >
        <div class="flex items-center gap-3">
          <div class="relative flex h-3 w-3">
            <span
              :class="geoStore.isPassiveTracking ? 'bg-blue-500' : 'bg-zinc-600'"
              class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            ></span>
            <span
              :class="geoStore.isPassiveTracking ? 'bg-blue-500' : 'bg-zinc-600'"
              class="relative inline-flex h-3 w-3 rounded-full"
            ></span>
          </div>
          <div>
            <span class="block font-mono text-xs font-bold uppercase tracking-wider text-white">
              Shield Status
            </span>
            <span class="font-mono text-[10px] text-zinc-500">
              {{ geoStore.isPassiveTracking ? 'MOVEMENT_ACTIVE' : 'SYSTEM_STANDBY' }}
            </span>
          </div>
        </div>
        <button
          @click="toggleShield"
          :class="
            geoStore.isPassiveTracking
              ? 'bg-blue-600 hover:bg-blue-500'
              : 'bg-zinc-700 hover:bg-zinc-600'
          "
          class="rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-tighter text-white transition-all active:scale-95"
        >
          {{ geoStore.isPassiveTracking ? 'Deactivate' : 'Activate' }}
        </button>
      </div>

      <div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <div class="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-300">
          Plugin Test Controls
        </div>
        <div class="space-y-3">
          <div class="rounded border border-zinc-800 p-2">
            <div class="mb-2 flex items-center justify-between">
              <span class="font-mono text-[10px] text-zinc-300">Heartbeat Plugin</span>
              <span
                :class="heartbeatRunning ? 'text-emerald-400' : 'text-zinc-500'"
                class="font-mono text-[10px] font-bold uppercase"
              >
                {{ heartbeatRunning ? 'running' : 'not running' }}
              </span>
            </div>
            <div class="flex gap-2">
              <button
                @click="startHeartbeatPlugin"
                class="rounded bg-emerald-700 px-2 py-1 font-mono text-[10px] text-white"
              >
                Start
              </button>
              <button
                @click="stopHeartbeatPlugin"
                class="rounded bg-red-700 px-2 py-1 font-mono text-[10px] text-white"
              >
                Stop
              </button>
            </div>
          </div>

          <div class="rounded border border-zinc-800 p-2">
            <div class="mb-2 flex items-center justify-between">
              <span class="font-mono text-[10px] text-zinc-300">Activity Plugin</span>
              <span
                :class="activityRunning ? 'text-emerald-400' : 'text-zinc-500'"
                class="font-mono text-[10px] font-bold uppercase"
              >
                {{ activityRunning ? 'running' : 'not running' }}
              </span>
            </div>
            <div class="mb-2 grid grid-cols-2 gap-2 font-mono text-[9px] text-zinc-400">
              <div>Type: {{ activityType }}</div>
              <div>Confidence: {{ activityConfidence }}</div>
              <div class="col-span-2">Last event: {{ fmtTs(activityLastEventAt) }}</div>
              <div class="col-span-2">Debug: {{ activityDebugLabel || '-' }}</div>
              <div class="col-span-2">Event count: {{ activityEventCount }}</div>
              <div class="col-span-2 text-red-400">Error: {{ activityError || '-' }}</div>
            </div>
            <div class="flex gap-2">
              <button
                @click="startActivityPlugin"
                class="rounded bg-emerald-700 px-2 py-1 font-mono text-[10px] text-white"
              >
                Start
              </button>
              <button
                @click="stopActivityPlugin"
                class="rounded bg-red-700 px-2 py-1 font-mono text-[10px] text-white"
              >
                Stop
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="geoStore.isRecording"
        class="flex items-center gap-2 self-start rounded-full border border-red-900/30 bg-red-900/10 px-3 py-1"
      >
        <span class="h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
        <span class="font-mono text-[10px] font-bold uppercase tracking-wider text-red-400"
          >Recording Active</span
        >
      </div>
    </div>

    <WeatherWidget />

    <!-- Pedometer Widget -->
    <div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4 shadow-lg">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="rounded-full bg-orange-500/20 p-2">
            <Icon name="ph:steps-duotone" class="text-2xl text-orange-500" />
          </div>
          <div>
            <h3 class="text-sm font-bold uppercase tracking-wider text-zinc-400">Steps</h3>
            <p class="font-mono text-2xl text-white">{{ pedometerStore.steps }}</p>
          </div>
        </div>
        <button
          @click="handlePedometerToggle"
          class="rounded-full p-2 transition-all active:scale-95"
          :class="
            pedometerStore.isTracking
              ? 'bg-red-500/10 text-red-500'
              : 'bg-green-500/10 text-green-500'
          "
        >
          <Icon
            :name="pedometerStore.isTracking ? 'ph:stop-circle-bold' : 'ph:play-circle-bold'"
            class="text-3xl"
          />
        </button>
      </div>
      <p v-if="pedometerStore.error" class="mt-2 text-xs text-red-400">
        {{ pedometerStore.error }}
      </p>
    </div>
  </div>
</template>

<script setup>
import ThemeSwitcher from '~/components/ThemeSwitcher.vue';
import WeatherWidget from '~/components/widgets/WeatherWidget.vue';
import { useOTAStore } from '~/stores/ota';
import { usePedometerStore } from '~/stores/pedometer';
import { useGeolocationStore } from '~/stores/geolocation';
import { Capacitor } from '@capacitor/core';
import { Heartbeat } from '@/lib/heartbeat';
import { ActivityRecognition } from '@/src/plugins/activityRecognition';
import { requestActivityPermission } from '@/permissions';

const otaStore = useOTAStore();
const pedometerStore = usePedometerStore();
const geoStore = useGeolocationStore();
let heartbeatRefreshTimer = null;
let activityRefreshTimer = null;
let activityListener = null;
const activityRunning = ref(false);
const activityType = ref('UNKNOWN');
const activityConfidence = ref(0);
const activityLastEventAt = ref(0);
const activityError = ref('');
const activityDebugLabel = ref('');
const activityEventCount = ref(0);

function ensureNativePluginAvailable(pluginId, pluginLabel) {
  if (!Capacitor.isNativePlatform()) {
    throw new Error(`${pluginLabel} is native-only. Run this inside the Android/iOS app, not the browser.`);
  }
  if (!Capacitor.isPluginAvailable(pluginId)) {
    throw new Error(
      `${pluginLabel} is not registered on this build. Run "npx cap sync android", then rebuild/reinstall the app.`
    );
  }
}

async function startHeartbeatPlugin() {
  try {
    ensureNativePluginAvailable('qipz-heartbeat', 'qipz-heartbeat');
    await geoStore.startNativeHeartbeat(60);
    await geoStore.refreshHeartbeatDebug();
  } catch (err) {
    console.error('Failed to start heartbeat plugin:', err);
  }
}

async function stopHeartbeatPlugin() {
  try {
    ensureNativePluginAvailable('qipz-heartbeat', 'qipz-heartbeat');
    await Heartbeat.stop();
    await geoStore.syncPassiveTrackingState();
    await geoStore.refreshHeartbeatDebug();
  } catch (err) {
    console.error('Failed to stop heartbeat plugin:', err);
  }
}

async function startActivityPlugin() {
  try {
    activityError.value = '';
    ensureNativePluginAvailable('qipz-activity', 'qipz-activity');
    await requestActivityPermission();

    if (activityListener) {
      activityListener.remove();
      activityListener = null;
    }

    // Listen to walking/running events
    activityListener = await ActivityRecognition.addListener('activityChange', (event) => {
      console.log('Activity:', event.type, 'Confidence:', event.confidence);
      activityType.value = event.type;
      activityConfidence.value = event.confidence;
      activityLastEventAt.value = Date.now();
    });

    const pending = await ActivityRecognition.drainPendingEvents();
    if (pending?.events?.length) {
      const last = pending.events[pending.events.length - 1];
      activityType.value = last.type || 'UNKNOWN';
      activityConfidence.value = Number(last.confidence || 0);
      activityLastEventAt.value = Date.now();
    }

    await ActivityRecognition.start();
    await refreshActivityStatus();
  } catch (err) {
    activityRunning.value = false;
    activityError.value = String(err);
    console.error('Failed to start activity plugin:', err);
  }
}

async function stopActivityPlugin() {
  try {
    ensureNativePluginAvailable('qipz-activity', 'qipz-activity');
    if (activityListener) {
      activityListener.remove();
      activityListener = null;
    }
    await ActivityRecognition.stop();
    await refreshActivityStatus();
  } catch (err) {
    activityError.value = String(err);
    console.error('Failed to stop activity plugin:', err);
  }
}

async function refreshActivityStatus() {
  try {
    if (!Capacitor.isNativePlatform()) {
      activityRunning.value = false;
      activityError.value = 'Activity plugin is native-only (Android/iOS app).';
      return;
    }
    ensureNativePluginAvailable('qipz-activity', 'qipz-activity');
    const status = await ActivityRecognition.status();
    activityRunning.value = !!status.enabled;
    activityType.value = status.lastType || 'UNKNOWN';
    activityConfidence.value = Number(status.lastConfidence || 0);
    activityLastEventAt.value = Number(status.lastEventAt || 0);
    activityDebugLabel.value = status.lastDebugLabel || '';
    activityEventCount.value = Number(status.eventCount || 0);
    if (status.permissionError) {
      activityError.value = status.permissionError;
    } else if (status.lastError) {
      activityError.value = status.lastError;
    } else {
      activityError.value = '';
    }
  } catch (err) {
    activityRunning.value = false;
    activityError.value = String(err);
  }
}

async function toggleShield() {
  if (geoStore.isPassiveTracking) {
    await geoStore.stopPassiveTracking();
  } else {
    await geoStore.initializePassiveTracking();
  }
}

async function handlePedometerToggle() {
  try {
    if (pedometerStore.isTracking) {
      await pedometerStore.stopTracking();
    } else {
      await pedometerStore.startTracking();
    }
  } catch (err) {
    console.error('UI Pedometer Toggle Error:', err);
  }
}

function fmtTs(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
}

const heartbeatRunning = computed(() => {
  const status = geoStore.heartbeatDebug;
  if (!status?.enabled) return false;
  const lastServiceAt = status.lastServiceStartAt || 0;
  if (!lastServiceAt) return false;
  const intervalMinutes = Math.max(5, status.intervalMinutes || 60);
  const staleThresholdMs = intervalMinutes * 2 * 60 * 1000;
  return Date.now() - lastServiceAt <= staleThresholdMs;
});

onMounted(async () => {
  try {
    await pedometerStore.checkSupport();

    // Optionally fetch initial steps for today
    if (pedometerStore.isSupported) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaySteps = await pedometerStore.querySteps(today, new Date());
      pedometerStore.steps = todaySteps;
    }

    await geoStore.refreshHeartbeatDebug();
    await refreshActivityStatus();
    heartbeatRefreshTimer = setInterval(() => {
      geoStore.refreshHeartbeatDebug();
    }, 15000);
    activityRefreshTimer = setInterval(() => {
      refreshActivityStatus();
    }, 10000);
  } catch (err) {
    console.error('Pedometer initialization failed:', err);
  }
});

onUnmounted(() => {
  if (heartbeatRefreshTimer) {
    clearInterval(heartbeatRefreshTimer);
    heartbeatRefreshTimer = null;
  }
  if (activityListener) {
    activityListener.remove();
    activityListener = null;
  }
  if (activityRefreshTimer) {
    clearInterval(activityRefreshTimer);
    activityRefreshTimer = null;
  }
});
</script>
