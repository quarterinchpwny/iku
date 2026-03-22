<template>
  <section class="home-dashboard-bento">
    <div class="home-dashboard-bento__inner">
      <HomeWeatherBentoCard class="home-dashboard-bento__weather" />
      <HomeCommuteHeroCard class="home-dashboard-bento__commute" />

    </div>
  </section>
</template>

<script setup lang="ts">
import HomeCommuteHeroCard from '~/components/home/HomeCommuteHeroCard.vue';
import HomeWeatherBentoCard from '~/components/home/HomeWeatherBentoCard.vue';
</script>

<style scoped >
.home-dashboard-bento {
  min-height: 100vh;
  padding: 1rem 1rem 6.5rem;
  font-family: 'Instrument Sans', system-ui, sans-serif;
}

.home-dashboard-bento__inner {
  margin: 0 auto;
  display: grid;
  width: min(100%, 1080px);
  gap: 1rem;
}

.home-dashboard-bento__commute,
.home-dashboard-bento__weather,
.home-dashboard-bento__route {
  min-width: 0;
}

@media (min-width: 900px) {
  .home-dashboard-bento__inner {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
