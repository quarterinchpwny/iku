<template>
  <div class="min-h-screen bg-[#0a0a0b] px-4 py-4 text-zinc-100">
    <div class="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[28rem] flex-col gap-4 pb-6">
      <!-- header -->
      <div class="flex items-center justify-between">
        <div class="text-[11px] font-semibold uppercase tracking-[0.12em] text-orange-500">
          行く!
        </div>
        <NuxtLink
          to="/onboarding"
          class="rounded-[10px] border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-200"
        >
          View onboarding
        </NuxtLink>
      </div>

      <!-- main -->
      <div class="flex flex-1 flex-col justify-between gap-8">
        <div class="flex flex-col gap-8">
          <div>
            <h1 class="mb-1.5 text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-zinc-50">
              Welcome<br />back.
            </h1>
            <p class="text-sm text-zinc-600">Load your route and commute view.</p>
          </div>

          <form class="flex flex-col gap-4" @submit.prevent="handleLogin">
            <div class="flex flex-col gap-1.5">
              <label
                class="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-600"
                for="username"
              >
                Username
              </label>
              <input
                id="username"
                v-model="username"
                type="text"
                required
                autocomplete="username"
                placeholder="qipz"
                class="w-full rounded-[14px] border border-zinc-800 bg-[#111113] px-4 py-3.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-orange-500"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <label
                  class="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-600"
                  for="password"
                >
                  Password
                </label>
                <button
                  type="button"
                  class="text-xs font-medium text-orange-500 transition hover:text-orange-400"
                >
                  Forgot?
                </button>
              </div>
              <input
                id="password"
                v-model="password"
                type="password"
                required
                autocomplete="current-password"
                placeholder="••••••••"
                class="w-full rounded-[14px] border border-zinc-800 bg-[#111113] px-4 py-3.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-orange-500"
              />
            </div>

            <div
              v-if="error"
              class="rounded-[14px] border border-red-900/50 bg-red-950/40 px-4 py-3 text-xs text-red-400"
            >
              {{ error }}
            </div>

            <button
              type="submit"
              :disabled="isLoading"
              class="w-full rounded-[14px] bg-orange-500 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ isLoading ? 'Logging in...' : 'Log in' }}
            </button>
          </form>

          <div class="flex items-center gap-3">
            <div class="h-px flex-1 bg-zinc-900" />
            <span class="text-xs text-zinc-700">or</span>
            <div class="h-px flex-1 bg-zinc-900" />
          </div>

          <button
            type="button"
            class="w-full rounded-[14px] border border-zinc-800 bg-zinc-950 px-4 py-3.5 text-sm font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
          >
            Continue with Google
          </button>
        </div>

        <!-- bottom -->
        <div class="flex flex-col gap-4">
          <div class="rounded-[14px] border border-zinc-800 bg-[#111113] px-4 py-4">
            <div v-for="item in highlights" :key="item" class="flex items-center gap-3 py-1">
              <div class="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orange-500" />
              <span class="text-xs text-zinc-500">{{ item }}</span>
            </div>
          </div>

          <p class="text-center text-xs text-zinc-600">
            New here?
            <NuxtLink
              to="/register"
              class="font-semibold text-orange-500 transition hover:text-orange-400"
            >
              Create an account
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

definePageMeta({ layout: false });
useHead({ title: 'Login' });

const authStore = useAuthStore();
const username = ref('');
const password = ref('');
const isLoading = ref(false);
const error = ref<string | null>(null);

const highlights = [
  'Routes stay selected on login',
  'History stays attached to your account',
  'Home loads your corridor instantly'
];

async function handleLogin() {
  isLoading.value = true;
  error.value = null;
  try {
    await authStore.login(username.value, password.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Login failed.';
  } finally {
    isLoading.value = false;
  }
}
</script>
