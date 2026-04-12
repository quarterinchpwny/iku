<template>
  <AuthShell
    title="Create account"
    description="Set up the account your device will keep in sync."
    :highlights="highlights"
    :details="details"
  >
    <template #headerAction>
      <NuxtLink
        to="/login"
        class="inline-flex items-center justify-center rounded-[1rem] border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-50"
      >
        Back to login
      </NuxtLink>
    </template>

    <div class="space-y-6">
      <div class="space-y-2">
        <h2 class="text-2xl font-semibold tracking-tight text-zinc-50">Create account</h2>
        <p class="text-sm leading-6 text-zinc-500">
          Pick credentials you can keep on the device you plan to carry.
        </p>
      </div>

      <form @submit.prevent="handleRegister" class="space-y-5">
        <div class="space-y-2">
          <label for="username" class="block text-sm font-medium text-zinc-300">Username</label>
          <input
            id="username"
            v-model="username"
            type="text"
            required
            autocomplete="username"
            class="block w-full rounded-[1rem] border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
          />
        </div>

        <div class="space-y-2">
          <label for="password" class="block text-sm font-medium text-zinc-300">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="new-password"
            class="block w-full rounded-[1rem] border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
          />
        </div>

        <div class="space-y-2">
          <label for="confirm-password" class="block text-sm font-medium text-zinc-300">
            Confirm password
          </label>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            required
            autocomplete="new-password"
            class="block w-full rounded-[1rem] border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
          />
        </div>

        <div
          v-if="error"
          class="rounded-[1rem] border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
        >
          {{ error }}
        </div>

        <div
          v-if="successMessage"
          class="rounded-[1rem] border border-emerald-900/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200"
        >
          {{ successMessage }}
        </div>

        <button
          type="submit"
          :disabled="isLoading"
          class="flex w-full items-center justify-center rounded-[1rem] bg-orange-500 px-4 py-3 text-sm font-medium text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ isLoading ? 'Creating account...' : 'Create account' }}
        </button>
      </form>

      <div class="rounded-[1rem] border border-zinc-800 bg-zinc-900/70 px-4 py-4 text-sm text-zinc-500">
        Already registered?
        <NuxtLink to="/login" class="font-medium text-orange-300 transition hover:text-orange-200">
          Log in here
        </NuxtLink>
      </div>
    </div>
  </AuthShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AuthShell from '~/components/auth/AuthShell.vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  layout: false
})

useHead({
  title: 'Register'
})

const authStore = useAuthStore()
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const error = ref<string | null>(null)
const successMessage = ref('')

const highlights = [
  {
    title: 'Single account',
    body: 'The app uses one identity to keep passive sync and route views aligned.'
  },
  {
    title: 'Quick setup path',
    body: 'Registration stays short so you can move straight into login and route setup.'
  },
  {
    title: 'Same app surface',
    body: 'This flow uses the same dark zinc and orange language as the rest of the app.'
  }
]

const details = [
  { label: 'Surface', value: 'Near-black background with zinc cards' },
  { label: 'Radius', value: '1rem across the auth flow' },
  { label: 'Next step', value: 'Log in after registration and start setup' }
]

async function handleRegister() {
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }

  isLoading.value = true
  error.value = null
  successMessage.value = ''

  try {
    await authStore.register(username.value, password.value)
    successMessage.value = 'Registration successful. You can log in now.'
    username.value = ''
    password.value = ''
    confirmPassword.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Registration failed.'
  } finally {
    isLoading.value = false
  }
}
</script>
