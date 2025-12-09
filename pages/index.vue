<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold">Welcome to Iku</h1>
    
    <div v-if="authStore.isAuthenticated" class="mt-4 rounded-lg bg-green-100 p-4 text-green-800">
      <p>You are logged in!</p>
      <p class="mt-2 text-sm">User ID: {{ authStore.user?.sub }}</p>
      <p class="text-sm">Role: {{ authStore.user?.role }}</p>
    </div>
    <div v-else class="mt-4 rounded-lg bg-blue-100 p-4 text-blue-800">
      <p>You are currently viewing the app as a guest. Please <NuxtLink to="/login" class="font-bold underline">login</NuxtLink> or <NuxtLink to="/register" class="font-bold underline">register</NuxtLink> to get started.</p>
    </div>

    <div class="mt-8">
      <h2 class="text-2xl font-semibold">App Pages</h2>
      <ul class="mt-2 list-inside list-disc space-y-2">
        <li><NuxtLink to="/map" class="text-indigo-600 hover:underline">Map Page</NuxtLink></li>
        <li><NuxtLink to="/community" class="text-indigo-600 hover:underline">Community Page</NuxtLink></li>
        <li><NuxtLink to="/projects" class="text-indigo-600 hover:underline">Projects Page</NuxtLink></li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '~/stores/auth';
const authStore = useAuthStore();
</script>