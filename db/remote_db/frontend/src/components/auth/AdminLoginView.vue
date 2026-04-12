<template>
  <div
    class="iku-shell flex min-h-screen items-center justify-center p-6 font-sans text-slate-800"
  >
    <div class="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <div class="mb-6 flex justify-center">
        <div class="rounded-lg bg-indigo-600 p-2">
          <Radio class="text-white" :size="24" />
        </div>
      </div>
      <h1 class="mb-2 text-center text-xl font-bold text-slate-900">Admin Login</h1>
      <p class="mb-6 text-center text-sm text-slate-500">Sign in to manage OTA updates</p>
      <form @submit.prevent="handleLogin" class="space-y-5">
        <div>
          <label for="username" class="mb-1 block text-sm font-medium text-slate-700">Username</label>
          <input
            v-model="username"
            id="username"
            type="text"
            required
            class="block w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          />
        </div>
        <div>
          <label for="password" class="mb-1 block text-sm font-medium text-slate-700">Password</label>
          <input
            v-model="password"
            id="password"
            type="password"
            required
            class="block w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          />
        </div>
        <div>
          <button
            :disabled="loggingIn"
            class="flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ loggingIn ? 'Signing in...' : 'Sign In' }}
          </button>
        </div>
        <div v-if="loginError" class="flex items-start gap-2 rounded-md bg-red-50 p-3">
          <AlertCircle class="mt-0.5 text-red-600" :size="16" />
          <p class="text-sm text-red-600">{{ loginError }}</p>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { AlertCircle, Radio } from 'lucide-vue-next'
import { useAdminAppContext } from '../../composables/useAdminAppContext'

const { loginError, loggingIn, password, username, handleLogin } = useAdminAppContext().auth
</script>
