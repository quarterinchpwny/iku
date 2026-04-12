<template>
  <section class="min-h-screen px-4 pb-[6.5rem] pt-4 font-['Instrument_Sans',system-ui,sans-serif]">
    <div class="mx-auto grid w-full max-w-[1080px] gap-4">
      <div class="my-3 flex justify-between">
        <div class="flex flex-col">
          <span class="text-sm">{{ welcomeBackText }}</span>
          <span class="text-3xl font-semibold leading-none">
            {{ helloText }} {{ user?.username ?? 'buddy' }}
          </span>
        </div>
        <IkuLogoMark class="w-16" />
      </div>

      <HomeCommuteHeroCard class="min-w-0" :commute="commute" :weather="weather" />
      <HomeTrafficHeatmapHeroCard class="min-w-0" :commute="commute" />
      <HomeWeatherBentoCard class="min-w-0" :weather="weather" />

      <!-- <HomeTodayBentoGrid
        class="min-w-0"
        :commute="commute"
        :dashboard="dashboard"
        :weather="weather"
      /> -->
    </div>
  </section>
</template>

<script setup lang="ts">
import HomeCommuteHeroCard from '~/components/home/HomeCommuteHeroCard.vue';
import HomeTodayBentoGrid from '~/components/home/HomeTodayBentoGrid.vue';
import HomeWeatherBentoCard from '~/components/home/HomeWeatherBentoCard.vue';
import HomeTrafficHeatmapHeroCard from '~/components/home/HomeTrafficHeatmapHeroCard.vue';
import { useHomeCommuteHero } from '~/composables/home/useHomeCommuteHero';
import { useHomeDashboard } from '~/composables/home/useHomeDashboard';
import { useHomeWeatherBento } from '~/composables/home/useHomeWeatherBento';
import { useAuthStore } from '~/stores/auth';

const { user } = useAuthStore();
const commute = useHomeCommuteHero();
const dashboard = useHomeDashboard();
const weather = useHomeWeatherBento();

const welcomeBackOptions = [
  'Welcome back!',
  'Good to see you again!',
  'Hey, welcome back!',
  'Nice to have you back!',
  'Back again, nice!'
];

const welcomeBackText = useState('home-dashboard-welcome-back-text', () => {
  const randomIndex = Math.floor(Math.random() * welcomeBackOptions.length);
  return welcomeBackOptions[randomIndex];
});

const helloOptions = [
  'Hello',
  'Hey there,',
  'Look who it is,',
  'Ah yes,',
  'The legend,',
  'Freshly arrived,'
];

const helloText = useState('home-dashboard-hello-text', () => {
  const randomIndex = Math.floor(Math.random() * helloOptions.length);
  return helloOptions[randomIndex];
});
</script>
