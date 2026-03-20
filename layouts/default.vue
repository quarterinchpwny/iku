<template>
  <div class="pt-safe relative min-h-screen overflow-hidden bg-[#05070b] text-zinc-100">
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute left-[-7rem] top-[-8rem] h-[22rem] w-[22rem] rounded-full bg-cyan-400/10 blur-[100px]"></div>
      <div class="absolute bottom-[-10rem] right-[-6rem] h-[24rem] w-[24rem] rounded-full bg-orange-500/10 blur-[110px]"></div>
    </div>
    <div
      v-if="authStore.isAuthenticated && authStore.isOffline"
      class="fixed right-3 top-3 z-[60] rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
    >
      Offline Mode
    </div>

    <div class="relative z-10">
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
.pt-safe {
  padding-top: env(safe-area-inset-top);
}
</style>
