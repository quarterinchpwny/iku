<template>
  <Transition
    enter-active-class="transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
    enter-from-class="translate-y-4 opacity-0 scale-95"
    enter-to-class="translate-y-0 opacity-100 scale-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100 scale-100"
    leave-to-class="translate-y-4 opacity-0 scale-95"
  >
    <div
      v-if="showPrompt"
      class="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex justify-center px-4"
    >
      <div
        class="pointer-events-auto w-full max-w-[28rem] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
      >
        <!-- Progress bar (visible while updating) -->
        <div class="h-0.5 w-full bg-zinc-800">
          <div
            class="h-full bg-orange-500 transition-all duration-300"
            :class="isUpdating ? 'w-full animate-pulse' : 'w-0'"
          />
        </div>

        <div class="px-4 py-4">
          <!-- Header row -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3">
              <!-- Icon -->
              <div
                class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500/10"
              >
                <svg
                  class="h-4 w-4 text-orange-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </div>
              <div>
                <div class="text-sm font-semibold text-white">Update ready</div>
                <div class="mt-0.5 text-sm leading-5 text-zinc-400">{{ versionLabel }}</div>
              </div>
            </div>

            <!-- Dismiss -->
            <button
              type="button"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
              aria-label="Dismiss"
              @click="dismissPrompt"
            >
              <svg
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Error state -->
          <div
            v-if="error"
            class="mt-3 flex items-start gap-2 rounded-xl border border-red-900/60 bg-red-950/30 px-3 py-2.5 text-sm text-red-300"
          >
            <svg
              class="mt-0.5 h-4 w-4 shrink-0 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <span>{{ error }}</span>
          </div>

          <!-- Actions -->
          <div class="mt-4 flex gap-2">
            <NuxtLink
              to="/settings"
              class="inline-flex flex-1 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-50"
            >
              Settings
            </NuxtLink>
            <button
              type="button"
              :disabled="isUpdating"
              class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-70"
              @click="otaStore.performUpdate()"
            >
              <svg v-if="isUpdating" class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              {{ isUpdating ? 'Updating…' : 'Update now' }}
            </button>
          </div>
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
  if (!version) return 'A newer bundle is available for this device.';
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
