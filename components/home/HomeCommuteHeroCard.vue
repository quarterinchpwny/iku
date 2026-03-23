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
  statusLabel,
  totalLabel,
  trafficRatioLabel,
  travelLabel,
  waitLabel
} = useHomeCommuteHero();
</script>

<template>
  <article
    class="relative min-h-[160px] overflow-hidden rounded-[1.25rem] bg-[#0f172a] text-white shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
  >
    <!-- Error state -->
    <div
      v-if="error && !isLoading"
      class="relative grid min-h-[160px] place-content-center justify-items-center gap-3 p-6 text-center font-bold"
      style="z-index: 9999; position: relative"
    >
      <div>{{ error }}</div>
      <button
        class="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold"
        @click="refreshCommute"
      >
        Retry
      </button>
    </div>

    <!-- Main -->
    <div v-else class="relative h-full min-h-60">
      <div
        class="absolute bottom-0 right-0 top-0"
        style="width: 100%; z-index: 0; isolation: isolate"
      >
        <HomeTripMap :featured="true" :fill="true" :frameless="true" :points="mapPoints" />
      </div>

      <!-- DARK FADE: right-to-left so map blends into dark left panel -->
      <!-- <div
        class="pointer-events-none absolute inset-0"
        style="
          z-index: 9998;
          background: linear-gradient(
            to right,
            rgba(15, 23, 42, 1) 0%,
            rgba(15, 23, 42, 1) 35%,
            rgba(15, 23, 42, 0.85) 40%,
            rgba(15, 23, 42, 0) 60%
          );
        "
      ></div> -->

      <!-- LEFT CONTENT -->
      <div
        class="absolute bottom-0 left-0 top-0 flex w-full flex-col justify-between p-4"
        style="z-index: 9999"
      >
        <div class="text-xs">
          {{ statusLabel }}
        </div>

        <div class="grid grid-cols-2">
          <div>
            <div class="flex flex-col">
              <div>
                <p class="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-400">
                  Total Time To Destination:
                </p>
                <p
                  class="text-[clamp(1.8rem,6vw,2.6rem)] font-extrabold leading-tight tracking-tight text-orange-400"
                >
                  {{ durationLabel }}
                </p>
              </div>
              <div>
                <p class="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-400">
                  ETA
                </p>
                <p
                  class="text-[clamp(1.4rem,5vw,2rem)] font-bold leading-tight tracking-tight text-white"
                >
                  {{ etaLabel }}
                </p>
              </div>
            </div>
          </div>
          <div class="flex items-end justify-end">
            <!-- <p
              class="mt-5 text-right text-[0.5rem] font-semibold uppercase tracking-wide text-slate-400"
            >
              {{ routeParts.title }}
            </p> -->
            <div class="grid grid-cols-3 gap-2 p-2">
              <div class="flex flex-col rounded-lg border p-3">
                <div class="text-xs">Wait:</div>
                <div class="text-sm">{{ waitLabel }}</div>
              </div>
              <div class="flex flex-col rounded-lg border p-3">
                <div class="text-xs">Travel:</div>
                <div class="text-sm">{{ travelLabel }}</div>
              </div>
              <div class="flex flex-col rounded-lg border p-3">
                <div class="text-xs">Total:</div>
                <div class="text-sm">{{ totalLabel }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
