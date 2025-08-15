<template>
  <div class="flex h-screen w-full flex-col bg-black p-2">
    <ThemeSwitcher />
    <WeatherWidget />
  </div>
</template>

<script setup>
import ThemeSwitcher from '~/components/ThemeSwitcher.vue';
import WeatherWidget from '~/components/widgets/WeatherWidget.vue';
</script>

