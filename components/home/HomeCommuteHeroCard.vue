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
  signalLabel,
  headlineLabel,
  waitLabel,
  travelLabel,
  trafficRatioLabel,
  signals
} = useHomeCommuteHero();

const { temperatureLabel, currentCondition, isLoading: isWeatherLoading } = useHomeWeatherBento();
</script>

<template>
  <article
    class="relative min-h-[200px] overflow-hidden rounded-[1.5rem] bg-[#1a1c1e] text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
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
      <div class="absolute inset-0 opacity-60" style="z-index: 0; isolation: isolate">
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
              {{ routeParts.title }} · LIVE
            </p>
            <h2 class="text-2xl font-bold tracking-tight text-white drop-shadow-md">
              {{ headlineLabel }}
            </h2>
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

        <!-- Bottom Row: Big Stats & Small Boxes -->
        <div class="flex items-end justify-between">
          <!-- Left: Primary Time Stats -->
          <div class="flex flex-col gap-2">
            <div>
              <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400">
                TIME TO DESTINATION:
              </p>
              <p class="text-xl font-black leading-none tracking-tighter text-[#f99d1c]">
                {{ durationLabel }}
              </p>
            </div>

            <p class="text-xl font-black leading-none tracking-tight text-white">
              ETA: {{ etaLabel }}
            </p>
          </div>

          <!-- Right: Detailed Metrics & Badges -->
          <div class="flex flex-col items-end gap-3">
            <!-- Metrics Grid -->
            <div class="flex gap-2">
              <div
                class="flex min-w-[70px] flex-col rounded-xl border border-white/10 bg-black/40 p-2 backdrop-blur-md"
              >
                <span class="text-[0.55rem] font-bold uppercase text-slate-400">Wait:</span>
                <span class="text-sm font-black text-[#f99d1c]">{{ waitLabel }}</span>
              </div>
              <div
                class="flex min-w-[70px] flex-col rounded-xl border border-white/10 bg-black/40 p-2 backdrop-blur-md"
              >
                <span class="text-[0.55rem] font-bold uppercase text-slate-400">Travel:</span>
                <span class="text-sm font-black text-[#f99d1c]">{{ travelLabel }}</span>
              </div>
              <div
                class="flex min-w-[70px] flex-col rounded-xl border border-white/10 bg-black/40 p-2 backdrop-blur-md"
              >
                <span class="text-[0.55rem] font-bold uppercase text-slate-400">Traffic:</span>
                <span class="text-sm font-black text-[#f99d1c]">{{ trafficRatioLabel }}</span>
              </div>
            </div>

            <!-- Status Badges -->
            <div class="flex flex-wrap justify-end gap-1.5">
              <span
                class="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[0.55rem] font-black uppercase tracking-tighter text-orange-400"
              >
                Moderate
              </span>
              <span
                class="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[0.55rem] font-black uppercase tracking-tighter text-blue-400"
              >
                Cached ORS
              </span>
              <span
                class="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[0.55rem] font-black uppercase tracking-tighter text-emerald-400"
              >
                Healthy Signal
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
