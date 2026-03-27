<template>
  <div class="flex gap-3">
    <div>
      <div
        class="relative min-h-[200px] overflow-hidden rounded-[1rem] bg-[#1a1c1e] text-white shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(255,255,255,0.05)] backdrop-blur-xl"
      ></div>
    </div>
    <div
      class="relative min-h-[200px] overflow-hidden rounded-[1rem] bg-[#1a1c1e] text-white shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(255,255,255,0.05)] backdrop-blur-xl"
    ></div>
  </div>
</template>

<script setup lang="ts">
import '~/assets/styles/home-commute-hero.scss';

import { useHomeCommuteHero } from '~/composables/home/useHomeCommuteHero';

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
</script>
