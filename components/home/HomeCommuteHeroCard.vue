<script setup lang="ts">
import '~/assets/styles/home-commute-hero.scss';

import HomeTripMap from '~/components/home/HomeTripMap.vue';
import { useHomeCommuteHero } from '~/composables/home/useHomeCommuteHero';

const {
  durationLabel,
  error,
  etaLabel,
  isLoading,
  mapPoints,
  refreshCommute,
  routeParts,
  statusLabel
} = useHomeCommuteHero();
</script>

<template>
  <article
    class="relative min-h-[160px] overflow-hidden rounded-[1.25rem] bg-[#0f172a] text-white shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
    <!-- Error state -->
    <div v-if="error && !isLoading"
      class="relative grid min-h-[160px] place-content-center justify-items-center gap-3 p-6 text-center font-bold"
      style="z-index: 9999; position: relative">
      <div>{{ error }}</div>
      <button class="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold" @click="refreshCommute">
        Retry
      </button>
    </div>

    <!-- Main -->
    <div v-else class="relative h-full min-h-[160px]">
      <div class="absolute bottom-0 right-0 top-0" style="width: 70%; z-index: 0; isolation: isolate">
        <HomeTripMap :featured="true" :fill="true" :frameless="true" :points="mapPoints" />
      </div>

      <!-- DARK FADE: right-to-left so map blends into dark left panel -->
      <div class="pointer-events-none absolute inset-0" style="
          z-index: 9998;
          background: linear-gradient(
            to right,
            rgba(15, 23, 42, 1) 0%,
            rgba(15, 23, 42, 1) 35%,
            rgba(15, 23, 42, 0.85) 40%,
            rgba(15, 23, 42, 0) 60%
          );
        "></div>

      <!-- LEFT CONTENT -->
      <div class="absolute bottom-0 left-0 top-0 flex w-full flex-col justify-between p-4" style="z-index: 9999">
     
        <div>
          <p class="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-400">
            Time To Destination:
          </p>
          <p class="text-[clamp(1.8rem,6vw,2.6rem)] font-extrabold leading-tight tracking-tight text-orange-400">
            {{ durationLabel }}
          </p>
        </div>

        <div class="grid grid-cols-7">
          <div class="col-span-4">
            <p class="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-400">ETA</p>
            <p class="text-[clamp(1.4rem,5vw,2rem)] font-bold leading-tight tracking-tight text-white">
              {{ etaLabel }}
            </p>
          </div>
          <div class="col-span-3 flex items-end justify-end ">
  <p class="text-[0.5rem] font-semibold uppercase tracking-wide text-slate-400 text-right mt-5 ">
    {{ routeParts.title }}
  </p>
</div>
        </div>
      </div>
    </div>
  </article>
</template>
