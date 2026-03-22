<template>
  <section class="rounded-[32px] border border-black/5 bg-white px-5 py-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:px-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Route map</p>
        <h2 class="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">OpenRouteService path</h2>
      </div>
      <button
        class="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-700 transition hover:border-orange-300 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        {{ loading ? 'Refreshing' : 'Refresh map' }}
      </button>
    </div>

    <div v-if="route" class="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <HomeTripMap :featured="true" :points="mapPoints" />

      <div class="grid gap-3">
        <div class="rounded-[26px] border border-zinc-200 bg-zinc-50 px-4 py-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Source</p>
          <p class="mt-2 text-lg font-semibold text-zinc-950">{{ formatQueueCoordinate(route.origin) }}</p>
        </div>
        <div class="rounded-[26px] border border-zinc-200 bg-zinc-50 px-4 py-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Destination</p>
          <p class="mt-2 text-lg font-semibold text-zinc-950">{{ formatQueueCoordinate(route.destination) }}</p>
        </div>
        <div class="rounded-[26px] border border-orange-200 bg-orange-50 px-4 py-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">Path status</p>
          <p class="mt-2 text-sm leading-6 text-zinc-800">
            {{ mapStatus }}
          </p>
        </div>
      </div>
    </div>

    <div v-else class="mt-5 rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center text-sm text-zinc-500">
      Pick a route to load the ORS path.
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import HomeTripMap from '~/components/home/HomeTripMap.vue';
import { formatQueueCoordinate } from '~/lib/queueCommute';

const props = defineProps({
  estimate: {
    type: Object,
    default: null,
  },
  loading: Boolean,
  route: {
    type: Object,
    default: null,
  },
});

defineEmits(['refresh']);

const mapPoints = computed(() => {
  const polyline = Array.isArray(props.estimate?.polyline) ? props.estimate.polyline : [];
  const points = polyline
    .map((coordinate: [number, number]) => ({
      lat: Number(coordinate?.[1]),
      lng: Number(coordinate?.[0]),
    }))
    .filter((point: { lat: number; lng: number }) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

  if (points.length > 1) {
    return points;
  }

  const route = props.route;
  if (!route) {
    return [];
  }

  return [route.origin, route.destination]
    .map((coordinate: [number, number]) => ({
      lat: Number(coordinate?.[1]),
      lng: Number(coordinate?.[0]),
    }))
    .filter((point: { lat: number; lng: number }) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
});

const mapStatus = computed(() => {
  const polylineCount = Array.isArray(props.estimate?.polyline) ? props.estimate.polyline.length : 0;
  if (polylineCount > 1) {
    return `Showing the OpenRouteService path with ${polylineCount} route points.`;
  }

  return 'Live route geometry is unavailable right now, so only the endpoints are shown.';
});
</script>
