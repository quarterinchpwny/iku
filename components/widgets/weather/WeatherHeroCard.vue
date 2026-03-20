<script setup lang="ts">
defineProps<{
  cityLabel: string;
  dayLabel: string;
  conditionLabel: string;
  conditionIcon: string;
  accent: string;
  glow: string;
  temperature: string;
  feelsLike: string;
  humidity: string;
  precipitation: string;
  windSpeed: string;
  uvIndex: string;
  sunriseLabel: string;
  sunsetLabel: string;
}>();
</script>

<template>
  <article class="weather-hero">
    <div class="weather-hero__topline">
      <div>
        <div class="weather-hero__date">{{ dayLabel }}</div>
        <div class="weather-hero__city">{{ cityLabel }}</div>
      </div>
      <div class="weather-hero__condition">{{ conditionLabel }}</div>
    </div>

    <div class="weather-hero__icon" :style="{ color: accent }">
      <Icon :name="conditionIcon" size="96" />
    </div>

    <div class="weather-hero__temperature-row">
      <div class="weather-hero__temperature">{{ temperature }}</div>
      <div class="weather-hero__feels">Feels like {{ feelsLike }}</div>
    </div>

    <div class="weather-hero__stats">
      <div>
        <span>Humidity</span>
        <strong>{{ humidity }}</strong>
      </div>
      <div>
        <span>Rain</span>
        <strong>{{ precipitation }}</strong>
      </div>
      <div>
        <span>Wind</span>
        <strong>{{ windSpeed }}</strong>
      </div>
      <div>
        <span>UV</span>
        <strong>{{ uvIndex }}</strong>
      </div>
      <div>
        <span>Sunrise</span>
        <strong>{{ sunriseLabel }}</strong>
      </div>
      <div>
        <span>Sunset</span>
        <strong>{{ sunsetLabel }}</strong>
      </div>
    </div>
  </article>
</template>

<style scoped>
.weather-hero {
  min-height: 100%;
  border-radius: 24px;
  padding: 1.25rem;
  background: linear-gradient(180deg, #5d9bff, #89b9ff);
  color: #f8fbff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.weather-hero__topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.weather-hero__date,
.weather-hero__city {
  font-size: 0.86rem;
  line-height: 1.1;
  opacity: 0.9;
}

.weather-hero__city {
  margin-top: 0.32rem;
  font-weight: 700;
}

.weather-hero__condition {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  padding: 0.45rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.weather-hero__icon {
  display: flex;
  justify-content: flex-start;
  margin-top: 1rem;
}

.weather-hero__temperature-row {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  margin-top: 1rem;
}

.weather-hero__temperature {
  font-size: clamp(3.4rem, 7vw, 4.8rem);
  line-height: 0.9;
  font-weight: 700;
  letter-spacing: -0.06em;
}

.weather-hero__feels {
  padding-bottom: 0.55rem;
  font-size: 0.9rem;
  opacity: 0.88;
}

.weather-hero__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem 1rem;
  margin-top: 1.3rem;
}

.weather-hero__stats span {
  display: block;
  font-size: 0.72rem;
  opacity: 0.72;
}

.weather-hero__stats strong {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.95rem;
  font-weight: 700;
}
</style>
