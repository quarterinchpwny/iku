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
          <div class="home-weather-bento__date">{{ currentCondition.label }}</div>
        </div>
        <div class="home-weather-bento__icon">
          <Icon :name="currentCondition.icon" size="100" />
        </div>
      </div>

      <div class="home-weather-bento__hours">
        <div v-for="hour in hourlyItems.slice(0, 3)" :key="hour.label" class="home-weather-bento__hour">
          <div class="home-weather-bento__hour-label">{{ hour.label }}</div>
          <Icon :name="hour.icon" size="24" />
          <div class="home-weather-bento__hour-temp">{{ hour.temperatureLabel }}</div>
        </div>
        <div class="home-weather-bento__location-inline">
          {{ locationLabel || 'Current location' }}
        </div>
      </div>
    </template>
  </article>
</template>

<style scoped>
.home-weather-bento {
  position: relative;
  overflow: hidden;
  border-radius: 17px;
  border: 1px solid var(--home-weather-border);
  background: var(--home-weather-background);
  padding: 1.5rem 1.5rem 1.25rem;
  color: var(--home-weather-text);
}

.home-weather-bento::after {
  position: absolute;
  inset: 0;
  content: '';
  opacity: 0.18;
  mix-blend-mode: soft-light;
  background:
    radial-gradient(rgba(255, 255, 255, 0.9) 0.7px, transparent 0.9px),
    radial-gradient(rgba(0, 0, 0, 0.7) 0.7px, transparent 0.95px);
  background-position: 0 0, 4px 5px;
  background-size: 12px 12px, 11px 11px;
  pointer-events: none;
}

.home-weather-bento__top,
.home-weather-bento__hero,
.home-weather-bento__hours,
.home-weather-bento__state,
.home-weather-bento__loading {
  position: relative;
  z-index: 1;
}

.home-weather-bento__top {
  display: none;
}

.home-weather-bento__hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.5rem;
}

.home-weather-bento__temp {
  font-size: 4rem;
  line-height: 0.9;
  letter-spacing: -0.06em;
  font-weight: 900;
  color: var(--home-weather-text);
}

.home-weather-bento__date {
  margin-top: 0.4rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--home-weather-text);
  opacity: 0.85;
}

.home-weather-bento__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border-radius: 1.25rem;

}

.home-weather-bento__hours {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.5rem;
}

.home-weather-bento__hour {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  text-align: center;
  padding: 0.5rem 0.6rem;
  min-width: 52px;
  border-radius: 0.85rem;

}

.home-weather-bento__hour-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--home-weather-muted);
}

.home-weather-bento__hour-temp {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--home-weather-text);
}

.home-weather-bento__hour-rain {
  display: none;
}

.home-weather-bento__location-inline {
  margin-left: auto;
  font-size: 1rem;
  font-weight: 800;
  color: var(--home-weather-text);
  text-align: right;
  line-height: 1.3;
  padding-bottom: 0.4rem;
}

.home-weather-bento__loading {
  display: grid;
  gap: 1rem;
}

.home-weather-bento__loading-top,
.home-weather-bento__loading-hero,
.home-weather-bento__loading-hours {
  border-radius: 1.4rem;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.08),
    rgba(255, 255, 255, 0.2),
    rgba(255, 255, 255, 0.08)
  );
  background-size: 200% 100%;
  animation: home-weather-bento-shimmer 1.4s linear infinite;
}

.home-weather-bento__loading-top    { height: 3.8rem; }
.home-weather-bento__loading-hero   { height: 8rem; }
.home-weather-bento__loading-hours  { height: 5rem; }

@keyframes home-weather-bento-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.home-weather-bento__state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.home-weather-bento__button {
  border-radius: 999px;
  border: 1px solid var(--home-weather-border);
  background: rgba(255, 255, 255, 0.18);
  padding: 0.55rem 0.9rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--home-weather-text);
  cursor: pointer;
}

.home-weather-bento__button:hover {
  background: rgba(255, 255, 255, 0.28);
}

.home-weather-bento__button--strong {
  background: rgba(255, 255, 255, 0.3);
}

.home-weather-bento__button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>