<script setup lang="ts">
import { useOTAStore } from '~/stores/ota';
import { useHomeWeatherBento } from '~/composables/home/useHomeWeatherBento';

const otaStore = useOTAStore();
const {
  cardStyle,
  currentCondition,
  dateLabel,
  error,
  hourlyItems,
  isLoading,
  locationLabel,
  refreshWeather,
  temperatureLabel
} = useHomeWeatherBento();
</script>

<template>
  <article class="home-weather-bento" :style="cardStyle">
    <div v-if="error && !isLoading" class="home-weather-bento__state">
      <div>{{ error }}</div>
      <button type="button" class="home-weather-bento__button" @click="refreshWeather">Retry</button>
    </div>

    <div v-else-if="isLoading" class="home-weather-bento__loading">
      <div class="home-weather-bento__loading-top"></div>
      <div class="home-weather-bento__loading-hero"></div>
      <div class="home-weather-bento__loading-hours"></div>
    </div>

    <template v-else>
      <div class="home-weather-bento__top">
        <div>
          <div class="home-weather-bento__location">{{ locationLabel || 'Current location' }}</div>
          <div class="home-weather-bento__condition">{{ currentCondition.label }}</div>
        </div>

        <div class="home-weather-bento__actions">
          <button type="button" class="home-weather-bento__button" @click="refreshWeather">
            {{ isLoading ? 'Refreshing...' : 'Refresh' }}
          </button>
          <button
            v-if="otaStore.updateAvailable"
            type="button"
            class="home-weather-bento__button home-weather-bento__button--strong"
            :disabled="otaStore.isUpdating"
            @click="otaStore.performUpdate()"
          >
            {{ otaStore.isUpdating ? 'Updating...' : 'Update' }}
          </button>
        </div>
      </div>

      <div class="home-weather-bento__hero">
        <div>
          <div class="home-weather-bento__temp">{{ temperatureLabel }}</div>
          <div class="home-weather-bento__date">{{ dateLabel }}</div>
        </div>

        <div class="home-weather-bento__icon">
          <Icon :name="currentCondition.icon" size="144" />
        </div>
      </div>

      <div class="home-weather-bento__hours">
        <div v-for="hour in hourlyItems" :key="hour.label" class="home-weather-bento__hour">
          <div class="home-weather-bento__hour-label">{{ hour.label }}</div>
          <Icon :name="hour.icon" size="28" />
          <div class="home-weather-bento__hour-temp">{{ hour.temperatureLabel }}</div>
          <div class="home-weather-bento__hour-rain">{{ hour.precipitationLabel }}</div>
        </div>
      </div>
    </template>
  </article>
</template>

<style scoped src="./home-weather-bento-card.css"></style>
