<template>
  <div class="flex h-screen w-full flex-col bg-black p-2">
    <!-- OTA Update Indicator -->
    <div v-if="otaStore.updateAvailable" class="mb-4 rounded-lg bg-blue-600 p-4 text-white shadow-lg">
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
    <WeatherWidget />

    <!-- Pedometer Widget -->
    <div class="mt-4 rounded-lg bg-zinc-900 p-4 border border-zinc-800 shadow-lg">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="rounded-full bg-orange-500/20 p-2">
            <Icon name="ph:steps-duotone" class="text-2xl text-orange-500" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-zinc-400 uppercase tracking-wider">Daily Steps</h3>
            <p class="text-2xl font-mono text-white">{{ pedometerStore.steps }}</p>
          </div>
        </div>
        <button 
          @click="handlePedometerToggle"
          class="rounded-full p-2 transition-all active:scale-95"
          :class="pedometerStore.isTracking ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'"
        >
          <Icon :name="pedometerStore.isTracking ? 'ph:stop-circle-bold' : 'ph:play-circle-bold'" class="text-3xl" />
        </button>
      </div>
      <p v-if="pedometerStore.error" class="mt-2 text-xs text-red-400">{{ pedometerStore.error }}</p>
    </div>

    <div v-if="authStore.isAuthenticated" class="mt-4 rounded-lg bg-green-100 p-4 text-green-800">
      <p>You are logged in!</p>
      <p class="mt-2 text-sm">User ID: {{ authStore.user?.sub }}</p>
      <p class="text-sm">Role: {{ authStore.user?.role }}</p>
    </div>
  </div>
</template>

<script setup>
import ThemeSwitcher from '~/components/ThemeSwitcher.vue';
import WeatherWidget from '~/components/widgets/WeatherWidget.vue';
import { useAuthStore } from '~/stores/auth';
import { useOTAStore } from '~/stores/ota';
import { usePedometerStore } from '~/stores/pedometer';

const authStore = useAuthStore();
const otaStore = useOTAStore();
const pedometerStore = usePedometerStore();

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

onMounted(() => {
  pedometerStore.checkSupport();
});
</script>
