<template>
  <div class="flex h-screen w-full flex-col bg-black p-2">
    <ThemeSwitcher />
    <WeatherWidget />

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
const authStore = useAuthStore();
</script>
