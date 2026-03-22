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
  <article class="home-commute-hero">
    <div class="home-commute-hero__map-layer">
      <HomeTripMap :featured="true" :fill="true" :frameless="true" :points="mapPoints" />
    </div>
    <div class="home-commute-hero__veil"></div>

    <div v-if="error && !isLoading" class="home-commute-hero__state">
      <div>{{ error }}</div>
      <button type="button" class="home-commute-hero__button" @click="refreshCommute">Retry</button>
    </div>

    <div v-else-if="isLoading && !hasRoute" class="home-commute-hero__state">
      <div>Loading commute card…</div>
    </div>

    <div v-else-if="!hasRoute && !isLoading" class="home-commute-hero__state">
      <div>No commute route is configured yet.</div>
      <NuxtLink to="/routes" class="home-commute-hero__button">Set route</NuxtLink>
    </div>

    <div v-else class="home-commute-hero__content">
      <div class="home-commute-hero__header">
        <div>
          <p class="home-commute-hero__eyebrow">Dynamic Commute</p>
          <h2 class="home-commute-hero__title">{{ routeParts.title }}</h2>
        </div>

        <div class="home-commute-hero__actions">
          <div class="home-commute-hero__badge">{{ badgeLabel }}</div>
          <button type="button" class="home-commute-hero__button" @click="refreshCommute">
            {{ isLoading ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <div class="home-commute-hero__body">
        <div class="home-commute-hero__stats">
          <div class="home-commute-hero__label">Time To Destination</div>
          <div class="home-commute-hero__time">{{ durationLabel }}</div>

          <div class="home-commute-hero__eta-block">
            <div class="home-commute-hero__label">ETA</div>
            <div class="home-commute-hero__eta">{{ etaLabel }}</div>
          </div>
        </div>

        <div class="home-commute-hero__summary">
          <div class="home-commute-hero__destination">
            <div class="home-commute-hero__avatar">
              <Icon name="carbon:location-current" size="20" />
            </div>
            <div>
              <div class="home-commute-hero__destination-label">Destination</div>
              <div class="home-commute-hero__destination-value">{{ routeParts.destinationLabel }}</div>
            </div>
          </div>

          <div class="home-commute-hero__meta-card">
            <div class="home-commute-hero__signal">{{ signalLabel }}</div>
            <div class="home-commute-hero__copy">{{ statusLabel }}</div>
          </div>

          <div class="home-commute-hero__footer">
            <span class="home-commute-hero__origin">{{ routeParts.originLabel }}</span>
            <NuxtLink to="/routes" class="home-commute-hero__link">Open route</NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
