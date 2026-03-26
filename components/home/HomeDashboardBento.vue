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
        <div
          class="iku-logo-mark flex items-center justify-center text-center text-3xl font-bold text-orange-600"
        >
          行く!
        </div>
      </div>

      <HomeCommuteHeroCard class="min-w-0" />
      <HomeWeatherBentoCard class="min-w-0" />
    </div>
  </section>
</template>

<script setup lang="ts">
import HomeCommuteHeroCard from '~/components/home/HomeCommuteHeroCard.vue';
import HomeWeatherBentoCard from '~/components/home/HomeWeatherBentoCard.vue';

import { useAuthStore } from '~/stores/auth';

const { user } = useAuthStore();

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
  'Captain chaos,',
  'Freshly arrived,'
];

const helloText = useState('home-dashboard-hello-text', () => {
  const randomIndex = Math.floor(Math.random() * helloOptions.length);
  return helloOptions[randomIndex];
});
</script>

<style scoped>
.iku-logo-mark {
  position: relative;
  transform-origin: center;
  text-shadow: 0 0 0.45rem rgba(249, 115, 22, 0.08);
  animation:
    iku-logo-float 6s ease-in-out infinite,
    iku-logo-glow 6s ease-in-out infinite;
}

.iku-logo-mark::before {
  content: '';
  position: absolute;
  inset: -0.2rem -0.35rem;
  z-index: -1;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.12), transparent 68%);
  filter: blur(8px);
  opacity: 0.4;
  animation: iku-logo-aura 6s ease-in-out infinite;
}

@keyframes iku-logo-float {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }

  50% {
    transform: translate3d(0, -0.12rem, 0);
  }
}

@keyframes iku-logo-glow {
  0%,
  100% {
    text-shadow: 0 0 0.45rem rgba(249, 115, 22, 0.06);
  }

  50% {
    text-shadow: 0 0 0.7rem rgba(249, 115, 22, 0.14);
  }
}

@keyframes iku-logo-aura {
  0%,
  100% {
    transform: scale(0.96);
    opacity: 0.28;
  }

  50% {
    transform: scale(1.03);
    opacity: 0.42;
  }
}
</style>
