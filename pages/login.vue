<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-100">
    <div class="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
      <h1 class="mb-6 text-center text-3xl font-bold">123321312123123213123POTA</h1>
      <form @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label for="username" class="block text-sm font-medium text-gray-700">Username</label>
          <input v-model="username" id="username" type="text" required
            class="mt-1 block w-full rounded-md border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
        </div>
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700">Password</label>
          <input v-model="password" id="password" type="password" required
            class="mt-1 block w-full rounded-md border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
        </div>
        <div>
          <button type="submit" :disabled="isLoading"
            class="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50">
            {{ isLoading ? 'Logging in...' : 'Login' }}
          </button>
        </div>
        <p v-if="error" class="text-center text-sm text-red-600">{{ error }}</p>
      </form>
      <p class="mt-6 text-center text-sm">
        Don't have an account?
        <NuxtLink to="/register" class="font-medium text-indigo-600 hover:text-indigo-500">
          Register here
        </NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '~/stores/auth';

definePageMeta({
  layout: false, // Use a blank layout for the login page
});

const authStore = useAuthStore();
const username = ref('');
const password = ref('');
const isLoading = ref(false);
const error = ref(null);

async function handleLogin() {
  isLoading.value = true;
  error.value = null;
  try {
    await authStore.login(username.value, password.value);
  } catch (e) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
}
</script>
