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
          :class="
            geoStore.isPassiveTracking
              ? 'bg-blue-600 hover:bg-blue-500'
              : 'bg-zinc-700 hover:bg-zinc-600'
          "
          class="rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-tighter text-white transition-all active:scale-95"
          @click="toggleShield"
        >
          {{ geoStore.isPassiveTracking ? 'Deactivate' : 'Activate' }}
        </button>
      </div>

      <NuxtLink
        to="/settings"
        class="block rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-center font-mono text-[11px] uppercase tracking-wider text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-900/60"
      >
        Open Tracking Settings
      </NuxtLink>

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

const otaStore = useOTAStore();
const pedometerStore = usePedometerStore();
const geoStore = useGeolocationStore();

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
  } catch (err) {
    console.error('Pedometer initialization failed:', err);
  }
});
</script>
