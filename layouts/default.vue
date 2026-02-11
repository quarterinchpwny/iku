<template>
  <div class="pt-safe relative min-h-screen bg-gray-50 ">


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
