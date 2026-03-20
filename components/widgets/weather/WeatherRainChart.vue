<script setup lang="ts">
import type { ForecastHour } from './types';

defineProps<{
  hours: ForecastHour[];
}>();
</script>

<template>
  <section class="rain-chart">
    <div class="rain-chart__header">
      <div>
        <div class="rain-chart__eyebrow">Hourly pulse</div>
        <h3>Chance of rain</h3>
      </div>
    </div>

    <div class="rain-chart__scale">
      <span>Rainy</span>
      <span>Mixed</span>
      <span>Dry</span>
    </div>

    <div class="rain-chart__bars">
      <div v-for="hour in hours" :key="hour.label" class="rain-chart__item">
        <div class="rain-chart__track">
          <div
            class="rain-chart__bar"
            :style="{ height: `${Math.max(hour.probability, 8)}%` }"
          ></div>
        </div>
        <span class="rain-chart__time">{{ hour.label }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rain-chart {
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  padding: 1.15rem;
  color: #f5f7fb;
}

.rain-chart__header h3 {
  margin: 0.25rem 0 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.rain-chart__eyebrow {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(226, 232, 240, 0.5);
}

.rain-chart__scale {
  display: grid;
  gap: 1.35rem;
  margin-top: 1rem;
  font-size: 0.78rem;
  color: rgba(226, 232, 240, 0.54);
}

.rain-chart__bars {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.8rem;
  align-items: end;
  min-height: 180px;
  margin-top: 0.8rem;
}

.rain-chart__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.rain-chart__track {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: 132px;
}

.rain-chart__track::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 50%;
  width: 1px;
  transform: translateX(-50%);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
}

.rain-chart__bar {
  position: relative;
  z-index: 1;
  width: 16px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(223, 242, 255, 1), rgba(157, 216, 255, 0.65));
  box-shadow:
    0 0 0 1px rgba(219, 239, 255, 0.18),
    0 10px 26px rgba(145, 206, 255, 0.22);
}

.rain-chart__time {
  font-size: 0.72rem;
  color: rgba(226, 232, 240, 0.64);
}
</style>
