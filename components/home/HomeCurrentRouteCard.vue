<script setup lang="ts">
import { useHomeCurrentRoute } from '~/composables/home/useHomeCurrentRoute';

const { error, hasRoute, isLoading, refreshRoute, route } = useHomeCurrentRoute();
</script>

<template>
  <article
    class="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_12%_15%,rgba(96,165,250,0.16),transparent_30%),linear-gradient(180deg,rgba(10,14,22,0.98),rgba(6,9,16,1))] p-5 text-slate-50 shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
  >
    <div class="relative flex flex-col items-start justify-between gap-4 sm:flex-row">
      <div>
        <div class="text-[0.82rem] font-bold uppercase tracking-[0.08em] text-slate-400/90">Route</div>
        <h2 class="mt-1 text-[clamp(1.5rem,3vw,2.25rem)] leading-[0.98] tracking-[-0.06em]">
          {{ route?.routeLabel || 'Current route travelled' }}
        </h2>
      </div>

      <button
        type="button"
        class="rounded-full border border-slate-400/30 bg-white/5 px-4 py-2.5 text-[0.8rem] font-bold text-slate-200/90"
        @click="refreshRoute"
      >
        {{ isLoading ? 'Refreshing...' : 'Refresh' }}
      </button>
    </div>

    <div v-if="error && !isLoading" class="relative mt-4 text-[0.95rem] font-semibold text-slate-400/90">{{ error }}</div>
    <div v-else-if="!hasRoute && !isLoading" class="relative mt-4 text-[0.95rem] font-semibold text-slate-400/90">
      No route recorded yet.
    </div>
    <template v-else-if="route">
      <div class="relative mt-4">
        <div class="text-[clamp(2.8rem,8vw,4.5rem)] font-bold leading-[0.9] tracking-[-0.1em]">{{ route.distanceLabel }}</div>
        <div class="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[0.92rem] font-semibold text-slate-400/90">
          <span>{{ route.statusLabel }}</span>
          <span>{{ route.timeWindowLabel }}</span>
        </div>
      </div>

      <div class="relative mt-4 overflow-hidden rounded-[1.45rem] border border-sky-300/20 bg-[linear-gradient(180deg,rgba(15,23,42,0.7),rgba(15,23,42,0.26)),radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.08),transparent_60%)] p-[0.85rem]">
        <svg viewBox="0 0 100 56" preserveAspectRatio="none" class="block h-[140px] w-full">
          <path
            v-if="route.path"
            :d="route.path"
            class="fill-none stroke-sky-400"
            style="stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round;"
            pathLength="1"
          />
        </svg>
      </div>

      <div class="relative mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-[1.2rem] border border-slate-400/15 bg-white/5 p-[0.85rem]">
          <div class="text-[0.78rem] font-bold text-slate-400/90">Duration</div>
          <div class="mt-1 text-[0.96rem] font-bold leading-[1.25]">{{ route.durationLabel }}</div>
        </div>
        <div class="rounded-[1.2rem] border border-slate-400/15 bg-white/5 p-[0.85rem]">
          <div class="text-[0.78rem] font-bold text-slate-400/90">Last fix</div>
          <div class="mt-1 text-[0.96rem] font-bold leading-[1.25]">{{ route.lastFixLabel }}</div>
        </div>
        <div class="rounded-[1.2rem] border border-slate-400/15 bg-white/5 p-[0.85rem]">
          <div class="text-[0.78rem] font-bold text-slate-400/90">Samples</div>
          <div class="mt-1 text-[0.96rem] font-bold leading-[1.25]">{{ route.pointCountLabel }}</div>
        </div>
        <div class="rounded-[1.2rem] border border-slate-400/15 bg-white/5 p-[0.85rem]">
          <div class="text-[0.78rem] font-bold text-slate-400/90">Source</div>
          <div class="mt-1 text-[0.96rem] font-bold leading-[1.25]">{{ route.providerLabel }}</div>
        </div>
      </div>
    </template>
  </article>
</template>
