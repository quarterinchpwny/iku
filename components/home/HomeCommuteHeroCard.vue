<script setup lang="ts">
import '~/assets/styles/home-commute-hero.scss';

import HomeTripMap from '~/components/home/HomeTripMap.vue';
import { useHomeCommuteHero } from '~/composables/home/useHomeCommuteHero';
import { useHomeWeatherBento } from '~/composables/home/useHomeWeatherBento';

const {
  durationLabel,
  error,
  etaLabel,
  isLoading,
  mapPoints,
  refreshCommute,
  routeParts,
  headlineLabel,
  predictionMessages,
  trafficLevel
} = useHomeCommuteHero();

const { temperatureLabel, currentCondition, isLoading: isWeatherLoading } = useHomeWeatherBento();
</script>

<template>
  <article
    class="relative min-h-[200px] overflow-hidden rounded-[1rem] bg-[#1a1c1e] text-white shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(255,255,255,0.05)] backdrop-blur-xl"
  >
    <!-- Error state -->
    <div
      v-if="error && !isLoading"
      class="relative grid min-h-[200px] place-content-center justify-items-center gap-3 p-6 text-center font-bold"
      style="z-index: 9999; position: relative"
    >
      <div class="text-slate-400">{{ error }}</div>
      <button
        class="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
        @click="refreshCommute"
      >
        Retry
      </button>
    </div>

    <!-- Main -->
    <div v-else class="relative h-full min-h-[260px]">
      <!-- Map Background -->
      <div class="absolute inset-0 opacity-100" style="z-index: 0; isolation: isolate">
        <HomeTripMap :featured="true" :fill="true" :frameless="true" :points="mapPoints" />
      </div>

      <!-- Gradient Overlay for readability -->
      <div
        class="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80"
        style="z-index: 1"
      ></div>

      <!-- Content Overlay -->
      <div class="absolute inset-0 flex flex-col justify-between p-5" style="z-index: 10">
        <!-- Top Row: Route & Weather -->
        <div class="flex items-start justify-between">
          <div class="flex flex-col gap-0.5">
            <p
              class="text-[0.65rem] font-black uppercase tracking-widest text-slate-300 opacity-80"
            >
              {{ routeParts.title }}
            </p>
            <h2 class="text-2xl font-bold tracking-tight text-white drop-shadow-md">
              {{ headlineLabel }}
            </h2>
          </div>
        </div>

        <!-- Bottom Row: Big Stats & Small Boxes -->
        <div class="flex items-end justify-between">
          <!-- Left: Primary Time Stats -->
          <div class="flex flex-col gap-2">
            <div>
              <p class="text-[0.5rem] font-black uppercase tracking-wider text-slate-400">
                TIME TO DESTINATION:
              </p>
              <p class="text-3xl font-black leading-none tracking-tighter text-orange-500">
                {{ durationLabel }}
              </p>
            </div>

            <p class="font-black leading-none tracking-tight text-white">ETA: {{ etaLabel }}</p>
          </div>
          <!-- Weather Widget -->
          <div v-if="!isWeatherLoading" class="flex flex-col items-end">
            <div class="flex items-center gap-1.5">
              <Icon :name="currentCondition.icon" class="text-2xl text-amber-400" />
              <span class="text-2xl font-bold">{{ temperatureLabel }}</span>
            </div>
            <span class="text-[0.7rem] font-bold text-slate-300 opacity-90">
              {{ currentCondition.label }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
