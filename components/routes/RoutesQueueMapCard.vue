<template>
  <section class="border-white/8 rounded-[28px] border bg-[#111418] px-4 py-4 shadow-[0_24px_70px_rgba(0,0,0,0.4)] sm:px-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Route map</p>
        <h2 class="mt-1.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">OpenRouteService path</h2>
      </div>
      <button
        class="rounded-full border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300 transition hover:border-orange-500/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        {{ loading ? 'Refreshing' : 'Refresh map' }}
      </button>
    </div>

    <div v-if="route" class="mt-4 grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
      <div class="overflow-hidden rounded-[24px] border border-zinc-800" style="min-height: 260px">
        <div class="relative bg-[#0f172a]" style="height: 260px">
          <HomeTripMap :featured="true" :fill="true" :frameless="true" :points="mapPoints" />

          <div
            style="
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              padding: 12px 14px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              background: linear-gradient(to bottom, rgba(10, 10, 14, 0.75) 0%, transparent 100%);
            "
          >
            <div>
              <p
                style="
                  font-size: 10px;
                  color: #999;
                  font-weight: 600;
                  text-transform: uppercase;
                  letter-spacing: 0.07em;
                  margin-bottom: 2px;
                "
              >
                Active route
              </p>
              <p style="font-size: 13px; font-weight: 700; color: #fff">
                {{ route.label }}
              </p>
            </div>
            <div
              style="
                background: #4caf50;
                border-radius: 20px;
                padding: 3px 10px;
                font-size: 9px;
                font-weight: 700;
                color: #fff;
                letter-spacing: 0.05em;
                display: flex;
                align-items: center;
                gap: 4px;
              "
            >
              <span
                style="
                  width: 5px;
                  height: 5px;
                  border-radius: 50%;
                  background: #fff;
                  opacity: 0.85;
                  display: inline-block;
                "
              ></span>
              ACTIVE
            </div>
          </div>
        </div>

        <div style="display: flex; border-top: 0.5px solid #242428">
          <div
            style="
              flex: 1;
              padding: 10px 12px;
              border-right: 0.5px solid #242428;
              text-align: center;
            "
          >
            <p
              style="
                font-size: 9px;
                color: #555;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.07em;
                margin-bottom: 3px;
              "
            >
              Origin
            </p>
            <p style="font-size: 11px; font-weight: 600; color: #ccc; font-family: monospace">
              {{ formatQueueCoordinate(route.origin) }}
            </p>
          </div>
          <div style="flex: 1; padding: 10px 12px; text-align: center">
            <p
              style="
                font-size: 9px;
                color: #555;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.07em;
                margin-bottom: 3px;
              "
            >
              Destination
            </p>
            <p style="font-size: 11px; font-weight: 600; color: #ccc; font-family: monospace">
              {{ formatQueueCoordinate(route.destination) }}
            </p>
          </div>
        </div>
      </div>

      <div class="grid content-start gap-3">
        <div class="rounded-[24px] border border-[#3d2d10] bg-[#1c1608] px-3.5 py-3.5">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-500">
            Path status
          </p>
          <p class="mt-1.5 text-[13px] leading-5 text-zinc-300 sm:text-sm sm:leading-6">{{ mapStatus }}</p>
        </div>

        <div v-if="estimate?.recommendation" class="grid grid-cols-2 gap-3">
          <div class="rounded-2xl border border-[#1a3020] bg-[#0d1f12] px-3.5 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Ride total
            </p>
            <p class="mt-1 text-base font-semibold text-green-400 sm:text-lg">
              {{ formatQueueMinutes(estimate.recommendation.ride_total_minutes) }}
            </p>
          </div>
          <div class="rounded-2xl border border-zinc-800 bg-zinc-900 px-3.5 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Walk total
            </p>
            <p class="mt-1 text-base font-semibold text-zinc-400 sm:text-lg">
              {{ formatQueueMinutes(estimate.recommendation.walk_total_minutes) }}
            </p>
          </div>
        </div>

        <div
          v-if="polylineCount > 1"
          class="rounded-[24px] border border-zinc-800 bg-zinc-900 px-3.5 py-3.5"
        >
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            ORS geometry
          </p>
          <p class="mt-1.5 text-base font-semibold text-white sm:text-lg">{{ polylineCount }} points</p>
          <p class="mt-1 text-[11px] text-zinc-600">Live route loaded from OpenRouteService</p>
        </div>
      </div>
    </div>

    <div
      v-else
      class="mt-4 rounded-[24px] border border-dashed border-zinc-800 bg-zinc-900 px-4 py-6 text-center text-sm text-zinc-600"
    >
      Pick a route to load the ORS path.
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import HomeTripMap from '~/components/home/HomeTripMap.vue';
import { coordinateToQueuePoint, formatQueueCoordinate, formatQueueMinutes, polylineToQueuePoints } from '~/lib/queueCommute';

const props = defineProps({
  estimate: { type: Object, default: null },
  loading: Boolean,
  route: { type: Object, default: null }
});

defineEmits(['refresh']);

const polylineCount = computed(() =>
  Array.isArray(props.estimate?.polyline) ? props.estimate.polyline.length : 0
);

const mapPoints = computed(() => {
  const primaryPolyline = polylineToQueuePoints(props.estimate?.polyline);
  const secondaryPolyline = polylineToQueuePoints(props.estimate?.walking_polyline);

  if (primaryPolyline.length > 1) {
    return primaryPolyline;
  }

  if (secondaryPolyline.length > 1) {
    return secondaryPolyline;
  }

  return [
    coordinateToQueuePoint(props.route?.origin),
    coordinateToQueuePoint(props.route?.destination),
  ].filter((point): point is { lat: number; lng: number } => point !== null);
});

const mapStatus = computed(() => {
  if (polylineCount.value > 1)
    return `Showing OpenRouteService path with ${polylineCount.value} route points.`;
  return 'Live route geometry is unavailable right now, so only the endpoints are shown.';
});
</script>
