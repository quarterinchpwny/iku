<template>
  <div class="iku-logo-mark inline-flex items-center justify-center">
    <img :src="logoSvg" :alt="alt" class="block h-auto w-full" />
  </div>
</template>

<script setup lang="ts">
import logoSvg from '~/assets/logo-svg.svg';

withDefaults(
  defineProps<{
    alt?: string;
  }>(),
  {
    alt: 'IKU'
  }
);
</script>

<style scoped>
.iku-logo-mark {
  position: relative;
  transform-origin: center;
  filter: drop-shadow(0 0 0.45rem rgba(249, 115, 22, 0.08));
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
    filter: drop-shadow(0 0 0.45rem rgba(249, 115, 22, 0.06));
  }

  50% {
    filter: drop-shadow(0 0 0.7rem rgba(249, 115, 22, 0.14));
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
