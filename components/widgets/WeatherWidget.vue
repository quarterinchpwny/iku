<template>
  <div>
    <component :is="currentComponent"></component>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue';
import { storeToRefs } from 'pinia';
import { useThemeStore } from '~/stores/theme';

const themeStore = useThemeStore();
const { currentTheme } = storeToRefs(themeStore);

const currentComponent = computed(() => {
  const theme = currentTheme.value;
  if (theme === 'dot-matrix') {
    return defineAsyncComponent(() => import('./DotMatrixWeather.vue'));
  } else if (theme === 'classic') {
    return defineAsyncComponent(() => import('./ClassicWeather.vue'));
  }
  return null;
});
</script>
