<template>
  <div class="pt-safe relative min-h-screen bg-gray-50 ">
    <!-- Auth-aware Header -->
    <!-- <header class="fixed left-0 top-0 z-40 w-full border-b bg-white/80 p-4 backdrop-blur-md">
      <div class="mx-auto flex max-w-5xl items-center justify-between">
        <NuxtLink to="/" class="text-xl font-bold">Iku App</NuxtLink>
        <nav class="flex items-center gap-4">
          <template v-if="authStore.isAuthenticated">
            <span class="text-sm text-gray-600">Welcome, {{ authStore.user?.sub || 'User' }}</span>
            <button
              @click="authStore.logout()"
              class="rounded-md bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600"
            >
              Logout
            </button>
          </template>
<template v-else>
            <NuxtLink to="/login" class="text-sm font-medium text-gray-600 hover:text-gray-900">Login</NuxtLink>
            <NuxtLink to="/register" class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">Register</NuxtLink>
          </template>
</nav>
</div>
</header> -->

    <div class="pb-16 ">
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
