<template>
  <section class="min-h-screen px-4 pb-[6.5rem] pt-4 font-['Instrument_Sans',system-ui,sans-serif]">
    <div class="mx-auto grid w-full max-w-[1080px] gap-4">
      <HomeWeatherBentoCard class="min-w-0" />
      <HomeCommuteHeroCard class="min-w-0" />
    </div>
  </section>
</template>

<script setup lang="ts">
import HomeCommuteHeroCard from '~/components/home/HomeCommuteHeroCard.vue';
import HomeWeatherBentoCard from '~/components/home/HomeWeatherBentoCard.vue';
</script>
