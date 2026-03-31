<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="translate-y-3 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-3 opacity-0"
  >
    <div
      v-if="showPrompt"
      class="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex justify-center px-4"
    >
      <div
        class="pointer-events-auto w-full max-w-[28rem] rounded-[1rem] border border-zinc-800 bg-zinc-950 px-4 py-4 text-zinc-100 shadow-[0_16px_50px_rgba(0,0,0,0.45)]"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-white">Update ready</div>
            <div class="mt-1 text-sm leading-6 text-zinc-400">
              {{ versionLabel }}
            </div>
          </div>
          <button
            type="button"
            class="text-sm text-zinc-500 transition hover:text-zinc-300"
            @click="dismissPrompt"
          >
            Later
          </button>
        </div>

        <div v-if="error" class="mt-3 rounded-[1rem] border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {{ error }}
        </div>

        <div class="mt-4 flex gap-3">
          <NuxtLink
            to="/settings"
            class="inline-flex flex-1 items-center justify-center rounded-[1rem] border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-50"
          >
            Open settings
          </NuxtLink>
          <button
            type="button"
            :disabled="isUpdating"
            class="inline-flex flex-1 items-center justify-center rounded-[1rem] bg-orange-500 px-4 py-3 text-sm font-medium text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            @click="performUpdate"
          >
            {{ isUpdating ? 'Updating...' : 'Update now' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { Capacitor } from '@capacitor/core';
import { useOTAStore } from '~/stores/ota';

const otaStore = useOTAStore();
const { error, isUpdating, latestVersion, updateAvailable } = storeToRefs(otaStore);
const dismissedVersion = ref('');

const versionLabel = computed(() => {
  const version = String(latestVersion.value?.version || '').trim();
  if (!version) return 'A newer app bundle is available for this device.';
  return `Version ${version} is ready to install.`;
});

const showPrompt = computed(() => {
  const version = String(latestVersion.value?.version || '').trim();
  if (!Capacitor.isNativePlatform()) return false;
  if (!updateAvailable.value) return false;
  if (!version) return true;
  return dismissedVersion.value !== version;
});

watch(updateAvailable, (value) => {
  if (value) return;
  dismissedVersion.value = '';
});

function dismissPrompt() {
  dismissedVersion.value = String(latestVersion.value?.version || '').trim();
}
</script>
