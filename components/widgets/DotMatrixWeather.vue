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
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m`
    );
    const data = await response.json();
    const weather = data.current_weather;
    weatherText.value = `Temp: ${weather.temperature} C  Wind: ${weather.windspeed} km/h`;
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