<template>
  <section class="home-dashboard-bento">
    <div class="home-dashboard-bento__inner">
      <HomeWeatherBentoCard class="home-dashboard-bento__weather" />
      <HomeCurrentRouteCard class="home-dashboard-bento__route" />
    </div>
  </section>
</template>

<script setup lang="ts">
import HomeCurrentRouteCard from '~/components/home/HomeCurrentRouteCard.vue';
import HomeWeatherBentoCard from '~/components/home/HomeWeatherBentoCard.vue';
</script>

<style scoped src="./home-dashboard-bento.css"></style>
