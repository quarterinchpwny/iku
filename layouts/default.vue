<template>
  <div class="pt-safe relative min-h-screen bg-gray-50 ">
    <div
      v-if="authStore.isAuthenticated && authStore.isOffline"
      class="fixed right-3 top-3 z-[60] rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
    >
      Offline Mode
    </div>

    <div class="">
      <slot />
    </div>

    <NavigationBottomNavBar class="fixed bottom-0 left-0 z-50 w-full" />
  </div>
</template>

<script setup>
import { useAuthStore } from '~/stores/auth';
const authStore = useAuthStore();
</script>

<style>
/* Tailwind plugin or custom class */
.pt-safe {
  padding-top: env(safe-area-inset-top);
}
</style>
