<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Geolocation } from '@capacitor/geolocation';
import DotMatrix from './DotMatrix.vue';

const weatherText = ref('Loading...');

onMounted(async () => {
  try {
    const coordinates = await Geolocation.getCurrentPosition();
    const { latitude, longitude } = coordinates.coords;
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m`,
      // `https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&hourly=temperature_2m`
    );

    const data = await response.json();
    console.log(data)
    const weather = data.hourly;
    weatherText.value = `Temp: ${weather.temperature_2m[0]} C`;
  } catch (error) {
    console.error('Failed to fetch weather data:', error);
    weatherText.value = 'Error fetching weather';
  }
});
</script>

<template>
  <div>
    <DotMatrix :text="weatherText" />
  </div>
</template>