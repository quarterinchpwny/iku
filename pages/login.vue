<template>
  <div class="min-h-screen bg-[#0a0a0b] px-4 py-4 text-zinc-100">
    <div class="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[28rem] flex-col gap-4 pb-6">
      <!-- header -->
      <div class="flex items-center justify-between">
        <div
          class="iku-logo-mark flex items-center justify-center text-center text-3xl font-bold text-orange-600"
        >
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
      <div class="flex flex-1 flex-col justify-between gap-8 pt-6">
        <div class="flex flex-col gap-8">
          <div>
            <h1 class="mb-1.5 text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-zinc-50">
              Welcome back.
            </h1>
            <p class="text-sm text-slate-300">Pick up where you left off.</p>
          </div>

          <form class="mt-20 flex flex-col gap-4" @submit.prevent="handleLogin">
            <div class="flex flex-col gap-1.5">
              <label
                class="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-300"
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
                class="w-full rounded-[1rem] border border-zinc-800 bg-[#111113] px-4 py-3.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-orange-500"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <label
                  class="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-300"
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
                class="w-full rounded-[1rem] border border-zinc-800 bg-[#111113] px-4 py-3.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-orange-500"
              />
            </div>

            <div
              v-if="error"
              class="rounded-[1rem] border border-red-900/50 bg-red-950/40 px-4 py-3 text-xs text-red-400"
            >
              {{ error }}
            </div>

            <button
              type="submit"
              :disabled="isLoading"
              class="mt-10 w-full rounded-[0.5rem] bg-orange-500 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ isLoading ? 'Logging in...' : 'Log in' }}
            </button>
          </form>
        </div>

        <!-- bottom -->
        <div class="flex flex-col gap-4">
          <p class="text-center text-xs text-slate-300">
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

<style scoped>
.iku-logo-mark {
  position: relative;
  transform-origin: center;
  text-shadow: 0 0 0.45rem rgba(249, 115, 22, 0.08);
  animation:
    iku-logo-float 6s ease-in-out infinite,
    iku-logo-glow 6s ease-in-out infinite;
}

.iku-logo-mark::before {
  content: '';
  position: absolute;
  inset: -0.2rem -0.35rem;
  z-index: -1;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.12), transparent 68%);
  filter: blur(8px);
  opacity: 0.4;
  animation: iku-logo-aura 6s ease-in-out infinite;
}

@keyframes iku-logo-float {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }

  50% {
    transform: translate3d(0, -0.12rem, 0);
  }
}

@keyframes iku-logo-glow {
  0%,
  100% {
    text-shadow: 0 0 0.45rem rgba(249, 115, 22, 0.06);
  }

  50% {
    text-shadow: 0 0 0.7rem rgba(249, 115, 22, 0.14);
  }
}

@keyframes iku-logo-aura {
  0%,
  100% {
    transform: scale(0.96);
    opacity: 0.28;
  }

  50% {
    transform: scale(1.03);
    opacity: 0.42;
  }
}
</style>
