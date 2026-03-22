<script setup lang="ts">
import '~/assets/styles/home-commute-hero.scss';

import HomeTripMap from '~/components/home/HomeTripMap.vue';
import { useHomeCommuteHero } from '~/composables/home/useHomeCommuteHero';

const {
  badgeLabel,
  durationLabel,
  error,
  etaLabel,
  hasRoute,
  isLoading,
  mapPoints,
  refreshCommute,
  routeParts,
  signalLabel,
  statusLabel
} = useHomeCommuteHero();
</script>
<template>
  <article
    class="relative overflow-hidden rounded-[2rem] text-[#fffdf8]
           min-h-60
           shadow-[0_28px_70px_rgba(15,23,42,0.18)]
           bg-[radial-gradient(circle_at_16%_18%,rgba(251,191,36,0.24),transparent_32%),linear-gradient(135deg,rgba(17,24,39,0.96),rgba(7,11,20,0.88))]"
  >
    <!-- Map layer -->
    <div class="absolute inset-0 opacity-[0.78]">
      <HomeTripMap
        :featured="true"
        :fill="true"
        :frameless="true"
        :points="mapPoints"
      />
    </div>

    <!-- Uncomment if needed -->
    <!--
    <div class="absolute inset-0
      bg-[linear-gradient(110deg,rgba(255,248,235,0.92)_0%,rgba(255,248,235,0.84)_28%,rgba(255,248,235,0.2)_58%,rgba(15,23,42,0.48)_100%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(2,6,23,0.18))]">
    </div>
    -->

    <!-- STATE -->
    <!--
    <div v-if="error && !isLoading"
         class="relative z-10 grid place-content-center gap-3 justify-items-center p-6 text-center text-[#0f172a] font-bold min-h-[332px] sm:min-h-[420px]">
      <div>{{ error }}</div>
      <button class="px-3 py-2 rounded-full bg-white/70 backdrop-blur border border-black/10">
        Retry
      </button>
    </div>
    -->

    <!-- CONTENT -->
    <!--
    <div v-else class="relative z-10 grid gap-5 p-5 min-h-[332px] sm:min-h-[420px]">

      <div class="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <p class="uppercase tracking-[0.18em] font-bold text-[0.72rem] text-slate-600">
            Dynamic Commute
          </p>

          <h2 class="mt-1 max-w-[18rem]
                     text-[clamp(1.6rem,3.5vw,2.35rem)]
                     leading-[0.98] tracking-[-0.06em] text-[#101828]">
            {{ routeParts.title }}
          </h2>
        </div>

        <div class="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div class="px-3 py-2 text-[0.74rem] font-bold rounded-full
                      text-orange-50 bg-orange-600/90
                      shadow-[0_10px_24px_rgba(234,88,12,0.28)]">
            {{ badgeLabel }}
          </div>

          <button
            class="inline-flex items-center justify-center px-3 py-2 text-[0.8rem]
                   rounded-full border border-black/10
                   bg-white/70 backdrop-blur text-gray-900">
            {{ isLoading ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 flex-1">

        <div>
          <div class="uppercase tracking-[0.18em] font-bold text-[0.78rem] text-slate-600">
            Time To Destination
          </div>

          <div class="mt-1 text-[clamp(3rem,9vw,5.2rem)]
                      leading-[0.88] tracking-[-0.11em]
                      font-extrabold text-orange-600">
            {{ durationLabel }}
          </div>

          <div class="mt-5">
            <div class="uppercase tracking-[0.18em] font-bold text-[0.78rem] text-slate-600">
              ETA
            </div>

            <div class="mt-1 text-[clamp(2.1rem,6vw,3.3rem)]
                        leading-[0.92] tracking-[-0.08em]
                        font-extrabold text-slate-900">
              {{ etaLabel }}
            </div>
          </div>
        </div>

        <div class="grid gap-3 w-full max-w-[20rem]">

          <div class="flex items-center gap-3">
            <div class="w-[2.8rem] h-[2.8rem] grid place-items-center rounded-full
                        bg-blue-600/90 text-orange-50
                        shadow-[0_12px_24px_rgba(37,99,235,0.24)]">
              <Icon name="carbon:location-current" size="20" />
            </div>

            <div>
              <div class="uppercase tracking-[0.18em] font-bold text-[0.68rem] text-slate-200/70">
                Destination
              </div>

              <div class="mt-1 text-[1.6rem] leading-[0.96] tracking-[-0.05em]
                          font-bold text-[#fffaf4]">
                {{ routeParts.destinationLabel }}
              </div>
            </div>
          </div>

          <div class="rounded-[1.35rem] p-4 backdrop-blur
                      bg-slate-900/50 border border-white/10">
            <div class="uppercase tracking-[0.18em] font-bold text-[0.65rem] text-amber-300">
              {{ signalLabel }}
            </div>

            <div class="mt-2 text-[0.93rem] leading-[1.5] text-white/90">
              {{ statusLabel }}
            </div>
          </div>

          <div class="flex flex-col md:flex-row justify-between gap-3">
            <span class="text-[0.82rem] font-bold text-white/80">
              {{ routeParts.originLabel }}
            </span>

            <NuxtLink
              to="/routes"
              class="inline-flex items-center justify-center px-3 py-2 text-[0.8rem]
                     rounded-full border border-black/10
                     bg-white/70 backdrop-blur text-gray-900">
              Open route
            </NuxtLink>
          </div>
        </div>

      </div>
    </div>
    -->
  </article>
</template>