<script setup lang="ts">
import { useHomeCurrentRoute } from '~/composables/home/useHomeCurrentRoute';

const { error, hasRoute, isLoading, refreshRoute, route } = useHomeCurrentRoute();
</script>

<template>
  <article class="home-route-card">
    <div class="home-route-card__header">
      <div>
        <div class="home-route-card__eyebrow">Route</div>
        <h2 class="home-route-card__title">
          {{ route?.routeLabel || 'Current route travelled' }}
        </h2>
      </div>

      <button type="button" class="home-route-card__button" @click="refreshRoute">
        {{ isLoading ? 'Refreshing...' : 'Refresh' }}
      </button>
    </div>

    <div v-if="error && !isLoading" class="home-route-card__state">{{ error }}</div>
    <div v-else-if="!hasRoute && !isLoading" class="home-route-card__state">
      No route recorded yet.
    </div>
    <template v-else-if="route">
      <div class="home-route-card__stats">
        <div class="home-route-card__primary">{{ route.distanceLabel }}</div>
        <div class="home-route-card__meta">
          <span>{{ route.statusLabel }}</span>
          <span>{{ route.timeWindowLabel }}</span>
        </div>
      </div>

      <div class="home-route-card__map">
        <svg viewBox="0 0 100 56" preserveAspectRatio="none" class="home-route-card__svg">
          <path
            v-if="route.path"
            :d="route.path"
            class="home-route-card__path"
            pathLength="1"
          />
        </svg>
      </div>

      <div class="home-route-card__grid">
        <div class="home-route-card__cell">
          <div class="home-route-card__label">Duration</div>
          <div class="home-route-card__value">{{ route.durationLabel }}</div>
        </div>
        <div class="home-route-card__cell">
          <div class="home-route-card__label">Last fix</div>
          <div class="home-route-card__value">{{ route.lastFixLabel }}</div>
        </div>
        <div class="home-route-card__cell">
          <div class="home-route-card__label">Samples</div>
          <div class="home-route-card__value">{{ route.pointCountLabel }}</div>
        </div>
        <div class="home-route-card__cell">
          <div class="home-route-card__label">Source</div>
          <div class="home-route-card__value">{{ route.providerLabel }}</div>
        </div>
      </div>
    </template>
  </article>
</template>

<style scoped src="./home-current-route-card.css"></style>
