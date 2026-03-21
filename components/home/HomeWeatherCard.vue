<script setup lang="ts">
import { useHomeWeatherCard } from '~/composables/home/useHomeWeatherCard';
import { useOTAStore } from '~/stores/ota';

const otaStore = useOTAStore();

const {
  cardStyle,
  conditionIcon,
  conditionLabel,
  dayLabel,
  detailItems,
  error,
  forecastItems,
  hasContent,
  headerEyebrow,
  headerTitle,
  highLowLabel,
  isLoading,
  placeLabel,
  refreshWeather,
  sunItems,
  temperatureLabel,
  updatedLabel
} = useHomeWeatherCard();
</script>

<template>
  <section class="home-weather-screen">
    <div class="home-weather-screen__frame">
      <div v-if="error && !hasContent" class="home-weather-screen__state">
        <div class="home-weather-screen__state-eyebrow">Weather card</div>
        <h1>{{ error }}</h1>
        <button type="button" class="home-weather-screen__button" @click="refreshWeather">Retry</button>
      </div>

      <div v-else-if="isLoading && !hasContent" class="home-weather-screen__loading">
        <div class="home-weather-screen__loading-header"></div>
        <div class="home-weather-screen__loading-hero"></div>
        <div class="home-weather-screen__loading-grid"></div>
      </div>

      <article v-else class="home-weather-card" :style="cardStyle">
        <div class="home-weather-card__top">
          <div>
            <div class="home-weather-card__eyebrow">{{ headerEyebrow }}</div>
            <h1 class="home-weather-card__title">{{ headerTitle }}</h1>
            <div class="home-weather-card__subtitle">
              <span>{{ placeLabel }}</span>
              <span>Updated {{ updatedLabel }}</span>
            </div>
          </div>

          <div class="home-weather-card__top-actions">
            <div
              v-if="otaStore.updateAvailable"
              class="home-weather-card__ota"
            >
              <div class="home-weather-card__ota-label">Update ready</div>
              <button
                type="button"
                class="home-weather-card__ota-button"
                :disabled="otaStore.isUpdating"
                @click="otaStore.performUpdate()"
              >
                {{ otaStore.isUpdating ? 'Updating...' : `Update ${otaStore.latestVersion?.version || ''}`.trim() }}
              </button>
            </div>
            <button type="button" class="home-weather-card__refresh" @click="refreshWeather">
              {{ isLoading ? 'Refreshing...' : 'Refresh' }}
            </button>
            <div class="home-weather-card__brand">行く</div>
          </div>
        </div>

        <div class="home-weather-card__hero">
          <div class="home-weather-card__hero-copy">
            <div class="home-weather-card__day">{{ dayLabel }}</div>
            <div class="home-weather-card__temperature">{{ temperatureLabel }}</div>
            <div class="home-weather-card__condition">{{ conditionLabel }}</div>
            <div class="home-weather-card__range">{{ highLowLabel }}</div>
          </div>

          <div class="home-weather-card__hero-mark">
            <Icon :name="conditionIcon" size="132" />
          </div>
        </div>

        <div class="home-weather-card__details">
          <div v-for="item in detailItems" :key="item.label" class="home-weather-card__detail">
            <div class="home-weather-card__detail-label">{{ item.label }}</div>
            <div class="home-weather-card__detail-value">{{ item.value }}</div>
          </div>
        </div>

        <div class="home-weather-card__footer">
          <div class="home-weather-card__sun">
            <div v-for="item in sunItems" :key="item.label" class="home-weather-card__sun-item">
              <div class="home-weather-card__sun-label">{{ item.label }}</div>
              <div class="home-weather-card__sun-value">{{ item.value }}</div>
            </div>
          </div>

          <div class="home-weather-card__forecast">
            <div
              v-for="item in forecastItems"
              :key="item.dayLabel"
              class="home-weather-card__forecast-item"
            >
              <div class="home-weather-card__forecast-day">{{ item.dayLabel }}</div>
              <Icon :name="item.icon" size="28" />
              <div class="home-weather-card__forecast-range">{{ item.rangeLabel }}</div>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped src="./home-weather-card.css"></style>
