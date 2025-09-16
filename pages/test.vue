<template>
  <div class="flex h-screen w-full flex-col bg-black p-2">
    <DotMatrix :text="displayText" color="#ff7300ff" />

    <input v-model="displayText" />
    <div class="weather-text text-center">
      <span class="text-3xl"> Manila, Philippines </span>
    </div>
  </div>
</template>

<script setup>
import DotMatrix from '~/components/widgets/DotMatrix.vue';

const displayText = ref();
</script>

<style scoped>
.weather-text {
  font-family: 'Doto', sans-serif;
  font-optical-sizing: auto;
  font-variation-settings: 'ROND' 0;
  color: white;
}
</style>
