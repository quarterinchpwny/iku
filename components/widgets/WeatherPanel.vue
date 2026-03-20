<script setup lang="ts">
import WeatherDailyStrip from './weather/WeatherDailyStrip.vue';
import WeatherHeroCard from './weather/WeatherHeroCard.vue';
import WeatherPanelLoading from './weather/WeatherPanelLoading.vue';

import { useWeatherPanel } from './weather/useWeatherPanel';

const {
  currentCondition,
  currentTemperature,
  dayLabel,
  error,
  feelsLike,
  fetchWeather,
  forecastDays,
  heroCityLabel,
  humidity,
  isLoading,
  precipitation,
  sunriseLabel,
  sunsetLabel,
  updatedLabel,
  uvIndex,
  weatherData,
  windSpeed
} = useWeatherPanel();
</script>

<template>
  <section class="weather-panel">
    <div v-if="error" class="weather-panel__error">
      {{ error }}
    </div>

    <WeatherPanelLoading v-else-if="isLoading || !weatherData" />

    <div v-else class="weather-panel__content">
      <div class="weather-panel__header">
        <div>
          <div class="weather-panel__eyebrow">Weather</div>
          <div class="weather-panel__title">{{ heroCityLabel }}</div>
          <div class="weather-panel__subtitle">{{ updatedLabel }}</div>
        </div>
        <button class="weather-panel__refresh" @click="fetchWeather">Refresh</button>
      </div>

      <div class="weather-panel__main-grid">
        <WeatherHeroCard
          :city-label="heroCityLabel"
          :day-label="dayLabel"
          :condition-label="currentCondition.label"
          :condition-icon="currentCondition.icon"
          :accent="currentCondition.accent"
          :glow="currentCondition.glow"
          :temperature="currentTemperature"
          :feels-like="feelsLike"
          :humidity="humidity"
          :precipitation="precipitation"
          :wind-speed="windSpeed"
          :uv-index="uvIndex"
          :sunrise-label="sunriseLabel"
          :sunset-label="sunsetLabel"
        />

        <WeatherDailyStrip :days="forecastDays" />
      </div>
    </div>
  </section>
</template>

<style scoped src="./weather/weather-panel.css"></style>
