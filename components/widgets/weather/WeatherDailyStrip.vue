<script setup lang="ts">
import type { ForecastDay } from './types';

defineProps<{
  days: ForecastDay[];
}>();
</script>

<template>
  <div class="daily-strip">
    <article
      v-for="day in days"
      :key="day.fullLabel"
      class="daily-strip__card"
      :class="{ 'daily-strip__card--active': day.active }"
    >
      <div class="daily-strip__day">{{ day.dayLabel }}</div>
      <div class="daily-strip__icon">
        <Icon :name="day.icon" size="30" />
      </div>
      <div class="daily-strip__temps">
        <strong>{{ day.high }}</strong>
        <span>{{ day.low }}</span>
      </div>
      <div class="daily-strip__condition">{{ day.condition }}</div>
    </article>
  </div>
</template>

<style scoped>
.daily-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.daily-strip__card {
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
  padding: 1rem 0.95rem;
  color: #f2f4f9;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background 180ms ease;
}

.daily-strip__card:hover {
  transform: translateY(-2px);
  border-color: rgba(185, 215, 255, 0.28);
}

.daily-strip__card--active {
  background: linear-gradient(180deg, rgba(215, 236, 255, 0.96), rgba(179, 213, 255, 0.84));
  color: #07111f;
  box-shadow: 0 14px 30px rgba(164, 208, 255, 0.18);
}

.daily-strip__day {
  font-size: 0.88rem;
  font-weight: 700;
}

.daily-strip__icon {
  margin-top: 1rem;
}

.daily-strip__temps {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  margin-top: 1rem;
}

.daily-strip__temps strong {
  font-size: 1.8rem;
  line-height: 1;
}

.daily-strip__temps span {
  font-size: 0.95rem;
  opacity: 0.65;
}

.daily-strip__condition {
  margin-top: 0.55rem;
  font-size: 0.78rem;
  opacity: 0.72;
}

@media (min-width: 900px) {
  .daily-strip {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
</style>
