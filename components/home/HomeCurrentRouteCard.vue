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

<style scoped >
.home-route-card {
  border-radius: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    radial-gradient(circle at 12% 15%, rgba(96, 165, 250, 0.16), transparent 30%),
    linear-gradient(180deg, rgba(10, 14, 22, 0.98), rgba(6, 9, 16, 1));
  padding: 1.2rem;
  color: #f8fafc;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
}

.home-route-card__header,
.home-route-card__stats,
.home-route-card__map,
.home-route-card__grid,
.home-route-card__state {
  position: relative;
}

.home-route-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.home-route-card__eyebrow {
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.88);
}

.home-route-card__title {
  margin-top: 0.25rem;
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  line-height: 0.98;
  letter-spacing: -0.06em;
}

.home-route-card__button {
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.05);
  padding: 0.62rem 0.92rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: rgba(226, 232, 240, 0.92);
}

.home-route-card__stats {
  margin-top: 1rem;
}

.home-route-card__primary {
  font-size: clamp(2.8rem, 8vw, 4.5rem);
  line-height: 0.9;
  letter-spacing: -0.1em;
  font-weight: 700;
}

.home-route-card__meta {
  margin-top: 0.45rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem 1rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: rgba(148, 163, 184, 0.88);
}

.home-route-card__map {
  margin-top: 1rem;
  overflow: hidden;
  border-radius: 1.45rem;
  border: 1px solid rgba(96, 165, 250, 0.16);
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.26)),
    radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.08), transparent 60%);
  padding: 0.85rem;
}

.home-route-card__svg {
  display: block;
  width: 100%;
  height: 140px;
}

.home-route-card__path {
  fill: none;
  stroke: #60a5fa;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.home-route-card__grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.home-route-card__cell {
  border-radius: 1.2rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(255, 255, 255, 0.04);
  padding: 0.85rem;
}

.home-route-card__label {
  font-size: 0.78rem;
  font-weight: 700;
  color: rgba(148, 163, 184, 0.88);
}

.home-route-card__value {
  margin-top: 0.3rem;
  font-size: 0.96rem;
  font-weight: 700;
  line-height: 1.25;
}

.home-route-card__state {
  margin-top: 1rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(148, 163, 184, 0.9);
}

@media (max-width: 900px) {
  .home-route-card__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .home-route-card__header {
    flex-direction: column;
  }

  .home-route-card__grid {
    grid-template-columns: 1fr;
  }
}
</style>
