<template>
  <div class="grid gap-3">
    <article
      class="relative min-h-[200px] overflow-hidden rounded-[1rem] border-white/10 bg-[#1a1c1e] text-white shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(255,255,255,0.05)] backdrop-blur-xl"
    >
      <!-- Error state -->
      <div
        v-if="error && !isLoading"
        class="relative grid min-h-[200px] place-content-center justify-items-center gap-3 p-6 text-center font-bold"
        style="z-index: 9999; position: relative"
      >
        <div class="text-slate-400">{{ error }}</div>
        <button
          class="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
          @click="refreshCommute"
        >
          Retry
        </button>
      </div>

      <!-- Main -->
      <div v-else class="relative h-full min-h-[260px]">
        <!-- Map Background -->
        <div class="absolute inset-0 opacity-100" style="z-index: 0; isolation: isolate">
          <HomeTripMap :featured="true" :fill="true" :frameless="true" :points="mapPoints" />
        </div>

        <!-- Gradient Overlay for readability -->
        <div
          class="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80"
          style="z-index: 1"
        ></div>

        <!-- Content Overlay -->
        <div class="absolute inset-0 flex flex-col justify-between p-5" style="z-index: 10">
          <div class="flex items-start justify-between">
            <div class="flex flex-col gap-0.5">
              <p
                class="text-[0.65rem] font-black uppercase tracking-widest text-slate-300 opacity-80"
              >
                {{ routeParts.title }}
              </p>
              <h2 class="text-2xl font-bold tracking-tight text-white drop-shadow-md">
                {{ headlineLabel }}
              </h2>
              <p class="mt-1 max-w-[18rem] text-[0.72rem] font-medium leading-5 text-slate-200/90">
                {{ predictionMessages?.action || signalState.detail }}
              </p>
            </div>
          </div>

          <div class="mt-auto space-y-3">
            <div class="flex items-end justify-between gap-3">
              <div class="flex flex-col gap-2">
                <div>
                  <p class="text-[0.5rem] font-black uppercase tracking-wider text-slate-400">
                    TIME TO DESTINATION:
                  </p>
                  <p class="text-3xl font-black leading-none tracking-tighter text-orange-500">
                    {{ durationLabel }}
                  </p>
                </div>

                <p class="font-black leading-none tracking-tight text-white">ETA: {{ etaLabel }}</p>
              </div>

              <div v-if="!isWeatherLoading" class="flex flex-col items-end">
                <div class="flex items-center gap-1.5">
                  <Icon :name="currentCondition.icon" class="text-2xl text-amber-400" />
                  <span class="text-2xl font-bold">{{ temperatureLabel }}</span>
                </div>
                <span class="text-[0.7rem] font-bold text-slate-300 opacity-90">
                  {{ currentCondition.label }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>

    <!-- <div class="rounded-[1rem] border border-white/10 bg-black/40 px-4 py-3">
      <div class="grid grid-cols-3">
        <div class="rounded-xl border px-3 py-2.5" :class="queueTrustPanelClass(signalState.tone)">
          <p class="text-[0.58rem] font-black uppercase tracking-[0.18em] text-slate-500">Signal</p>
          <p class="mt-1 text-sm font-semibold" :class="queueTrustLabelClass(signalState.tone)">
            {{ signalState.label }}
          </p>
        </div>

        <div
          class="rounded-[1rem] border px-3 py-2.5"
          :class="queueTrustPanelClass(confidenceState.tone)"
        >
          <p class="text-[0.58rem] font-black uppercase tracking-[0.18em] text-slate-500">
            Confidence
          </p>
          <p class="mt-1 text-sm font-semibold" :class="queueTrustLabelClass(confidenceState.tone)">
            {{ confidenceState.label }}
          </p>
        </div>

        <div
          class="rounded-xl border px-3 py-2.5"
          :class="queueTrustPanelClass(departureCall.tone)"
        >
          <p class="text-[0.58rem] font-black uppercase tracking-[0.18em] text-slate-500">
            Timing call
          </p>
        </div>
      </div>
    </div> -->
    <div class="grid grid-cols-3 gap-3">
      <div class="col-span-2 rounded-[1rem] border border-white/10 bg-black/40 px-4 py-3">
        <p class="mt-1 text-sm font-semibold" :class="queueTrustLabelClass(departureCall.tone)">
          {{ predictionRecommendation.best_option }}
        </p>
        <p class="mt-1 text-[0.72rem] leading-5 text-slate-300/90">
          {{ departureCall.detail }}
        </p>
      </div>
      <div class="rounded-[1rem] border border-white/10 bg-black/40 px-4 py-3">
        <p class="mt-1 text-[0.72rem] leading-5 text-slate-300/90">
          {{ predictionRecommendation?.ride_total_minutes }} minutes
        </p>
        <p class="mt-1 text-[0.72rem] leading-5 text-slate-300/90">
          {{ predictionRecommendation?.ride_wait_minutes }} minutes
        </p>
      </div>
    </div>

    <!-- <div class="rounded-[1rem] border border-white/10 bg-black/40 px-4 py-3">
      <button
        class="flex w-full items-center justify-between text-left"
        @click="presetsOpen = !presetsOpen"
      >
        <div>
          <p class="text-sm font-semibold text-white">Saved commute presets</p>
          <p class="mt-1 text-xs text-slate-400">
            {{ presets.length ? `${presets.length} saved routes` : 'No saved presets yet' }}
          </p>
        </div>
        <span class="text-sm font-semibold text-orange-400">
          {{ presetsOpen ? 'Hide' : 'Show' }}
        </span>
      </button>

      <QueuePresetManager
        v-if="presetsOpen"
        class="mt-3"
        :presets="presets"
        :routes="routes"
        :save-disabled="!selectedRoute"
        :selected-preset-id="selectedPresetId"
        :selected-route-key="selectedRoute?.route_key || ''"
        title="Saved commute presets"
        @delete-preset="deletePreset"
        @save-preset="saveCurrentPreset($event.label, $event.is_default)"
        @select-preset="selectPreset"
      />
    </div> -->
  </div>
</template>
<script setup lang="ts">
import '~/assets/styles/home-commute-hero.scss';

import { ref } from 'vue';
import HomeTripMap from '~/components/home/HomeTripMap.vue';
import QueuePresetManager from '~/components/queue/QueuePresetManager.vue';
import { useHomeCommuteHero } from '~/composables/home/useHomeCommuteHero';
import { useHomeWeatherBento } from '~/composables/home/useHomeWeatherBento';
import { queueTrustLabelClass, queueTrustPanelClass } from '~/lib/queueEstimateTrust';

const props = defineProps<{
  commute?: ReturnType<typeof useHomeCommuteHero>;
  weather?: ReturnType<typeof useHomeWeatherBento>;
}>();

const commute = props.commute ?? useHomeCommuteHero();
const weather = props.weather ?? useHomeWeatherBento();

const {
  confidenceState,
  departureCall,
  deletePreset,
  durationLabel,
  error,
  etaLabel,
  headlineLabel,
  isLoading,
  mapPoints,
  predictionMessages,
  presets,
  refreshCommute,
  routes,
  routeParts,
  saveCurrentPreset,
  signalState,
  selectedPresetId,
  selectPreset,
  selectedRoute,
  predictionRecommendation
} = commute;

const { temperatureLabel, currentCondition, isLoading: isWeatherLoading } = weather;
const presetsOpen = ref(false);
</script>
