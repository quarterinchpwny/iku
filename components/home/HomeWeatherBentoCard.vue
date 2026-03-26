<script setup lang="ts">
import { useOTAStore } from '~/stores/ota';
import { useHomeWeatherBento } from '~/composables/home/useHomeWeatherBento';

const otaStore = useOTAStore();
const { error, hourlyItems, isLoading, refreshWeather } = useHomeWeatherBento();
</script>

<template>
  <article
    class="relative overflow-hidden rounded-[1rem] border border-white/10 bg-black/60 px-3 text-[var(--home-weather-text)] shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(255,255,255,0.05)] backdrop-blur-xl"
    :style="{
      // ...cardStyle,
      // background: 'var(--home-weather-background)',
      // borderColor: 'var(--home-weather-border)',
    }"
  >
    <!-- <div
      class="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-soft-light"
      style="background:
        radial-gradient(rgba(255,255,255,0.9) 0.7px, transparent 0.9px),
        radial-gradient(rgba(0,0,0,0.7) 0.7px, transparent 0.95px);
        background-position: 0 0, 4px 5px;
        background-size: 12px 12px, 11px 11px;"
    /> -->

    <div v-if="error && !isLoading" class="relative z-[1] flex items-center justify-between gap-4">
      <div>{{ error }}</div>
      <button
        type="button"
        class="cursor-pointer rounded-full border px-4 py-2 text-[0.82rem] font-bold text-[var(--home-weather-text)]"
        style="border-color: var(--home-weather-border); background: rgba(255, 255, 255, 0.18)"
        @click="refreshWeather"
      >
        Retry
      </button>
    </div>

    <div v-else-if="isLoading" class="relative z-[1] grid gap-4">
      <div class="h-[3.8rem] animate-pulse rounded-[1.4rem] bg-white/15"></div>
      <div class="h-32 animate-pulse rounded-[1.4rem] bg-white/15"></div>
      <div class="h-20 animate-pulse rounded-[1.4rem] bg-white/15"></div>
    </div>

    <template v-else>
      <!-- <div class="relative z-[1] hidden">
        <div>
          <div>{{ locationLabel || 'Current location' }}</div>
          <div>{{ currentCondition.label }}</div>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="cursor-pointer rounded-full border px-4 py-2 text-[0.82rem] font-bold text-[var(--home-weather-text)]"
            style="border-color: var(--home-weather-border); background: rgba(255,255,255,0.18);"
            @click="refreshWeather"
          >
            {{ isLoading ? 'Refreshing...' : 'Refresh' }}
          </button>
          <button
            v-if="otaStore.updateAvailable"
            type="button"
            class="cursor-pointer rounded-full border px-4 py-2 text-[0.82rem] font-bold text-[var(--home-weather-text)]"
            style="border-color: var(--home-weather-border); background: rgba(255,255,255,0.3);"
            :disabled="otaStore.isUpdating"
            @click="otaStore.performUpdate()"
          >
            {{ otaStore.isUpdating ? 'Updating...' : 'Update' }}
          </button>
        </div>
      </div>

      <div class="relative z-[1] grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div>
          <div class="text-[4rem] font-black leading-[0.9] tracking-[-0.06em]">{{ temperatureLabel }}</div>
          <div class="mt-[0.4rem] text-[1.1rem] font-bold opacity-85">{{ currentCondition.label }}</div>
        </div>
        <div class="flex items-center justify-center rounded-[1.25rem] p-2">
          <Icon :name="currentCondition.icon" size="100" />
        </div>
      </div> -->

      <div class="relative z-[1] flex items-end justify-between gap-2">
        <div
          v-for="hour in hourlyItems"
          :key="hour.label"
          class="flex min-w-[52px] flex-col items-center gap-[0.2rem] rounded-[0.85rem] px-[0.6rem] py-2 text-center"
        >
          <div class="text-[0.6rem] font-bold text-orange-400">
            {{ hour.label }}
          </div>
          <Icon :name="hour.icon" size="43" />
          <div class="text-[0.95rem] font-extrabold">{{ hour.temperatureLabel }}</div>
        </div>
        <!-- <div class="ml-auto pb-[0.4rem] text-right text-base font-extrabold leading-[1.3]">
          {{ locationLabel || 'Current location' }}
        </div> -->
      </div>
    </template>
  </article>
</template>
