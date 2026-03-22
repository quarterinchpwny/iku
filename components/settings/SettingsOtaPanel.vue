<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useOTAStore } from '~/stores/ota';

const otaStore = useOTAStore();
const {
  autoUpdateEnabled,
  currentVersion,
  error,
  isChecking,
  isUpdating,
  latestVersion,
  updateAvailable,
} = storeToRefs(otaStore);

const statusLabel = computed(() => {
  if (isChecking.value) {
    return 'checking';
  }
  if (isUpdating.value) {
    return 'updating';
  }
  if (error.value) {
    return 'error';
  }
  if (updateAvailable.value) {
    return 'update available';
  }
  if (latestVersion.value) {
    return 'up to date';
  }
  return 'not checked';
});

async function checkForUpdates() {
  await otaStore.initialize();
  await otaStore.checkUpdates();
}
</script>

<template>
  <div class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
    <div class="mb-2 flex items-center justify-between gap-2">
      <div class="font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
        OTA Updates
      </div>
      <div class="flex gap-2">
        <button
          :disabled="isChecking || isUpdating"
          class="rounded-md border border-zinc-700 px-2 py-1 font-mono text-[10px] uppercase text-zinc-200"
          @click="checkForUpdates"
        >
          {{ isChecking ? 'Checking' : 'Check for Update' }}
        </button>
        <button
          v-if="updateAvailable"
          :disabled="isChecking || isUpdating"
          class="rounded-md bg-emerald-600 px-2 py-1 font-mono text-[10px] font-bold uppercase text-white"
          @click="otaStore.performUpdate()"
        >
          {{ isUpdating ? 'Updating' : 'Update' }}
        </button>
      </div>
    </div>
    <div class="space-y-1 font-mono text-[10px] text-zinc-300">
      <div>Mode: {{ autoUpdateEnabled === null ? '-' : autoUpdateEnabled ? 'auto' : 'manual' }}</div>
      <div>Current version: {{ currentVersion || '-' }}</div>
      <div>Latest version: {{ latestVersion?.version || '-' }}</div>
      <div>Status: {{ statusLabel }}</div>
      <div v-if="error" class="text-red-400">Error: {{ error }}</div>
    </div>
  </div>
</template>
