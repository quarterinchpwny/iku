import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import {
  coordinateToPoint,
  fallbackMinutesFromTraffic,
  formatEta,
  formatTrafficRatio,
  formatTravelMinutes,
  formatWaitRange,
  parseResponse,
  polylineToPoints,
  resolveErrorMessage,
  routeSummaryParts,
  trimTrailingSlash
} from '~/lib/homeCommuteHero';
import type { QueueEstimate, QueueRouteSummary } from '~/lib/homeCommuteHero';
import { readStoredQueueRouteKey, resolveSelectedQueueRouteKey, storeQueueRouteKey } from '~/lib/queueRouteSelection';

export function useHomeCommuteHero() {
  const config = useRuntimeConfig();
  const routes = ref<QueueRouteSummary[]>([]);
  const estimate = ref<QueueEstimate | null>(null);
  const selectedRouteKey = ref('');
  const isLoading = ref(true);
  const error = ref('');
  const loading = reactive({
    estimate: false,
    routes: false,
  });
  let refreshHandle: number | null = null;

  const apiBase = computed(() => {
    const configured = String(config.public.cfURL || '').trim();
    if (configured) {
      return trimTrailingSlash(configured);
    }

    if (import.meta.client && window.location.origin) {
      return trimTrailingSlash(window.location.origin);
    }

    return '';
  });

  const selectedRoute = computed(() =>
    routes.value.find((route) => route.route_key === selectedRouteKey.value) ?? null
  );
  const bestOption = computed(() => {
    const option = estimate.value?.recommendation?.best_option;
    if (option === 'walk' || option === 'ride') {
      return option;
    }
    return 'ride';
  });
  const activeMinutes = computed(() => {
    if (bestOption.value === 'walk') {
      return estimate.value?.recommendation?.walk_total_minutes ?? estimate.value?.recommendation?.ride_total_minutes ?? null;
    }

    return estimate.value?.recommendation?.ride_total_minutes
      ?? estimate.value?.recommendation?.walk_total_minutes
      ?? fallbackMinutesFromTraffic(estimate.value?.signals?.traffic?.duration_seconds);
  });
  const etaLabel = computed(() => formatEta(activeMinutes.value));
  const durationLabel = computed(() => formatTravelMinutes(activeMinutes.value));
  const waitLabel = computed(() => {
    if (bestOption.value === 'walk') {
      return '0 min'
    }

    return formatWaitRange(estimate.value?.wait_minutes_estimate)
  })
  const travelLabel = computed(() => {
    if (bestOption.value === 'walk') {
      return formatTravelMinutes(estimate.value?.recommendation?.walk_total_minutes)
    }

    return formatTravelMinutes(
      estimate.value?.recommendation?.ride_in_vehicle_minutes
      ?? fallbackMinutesFromTraffic(estimate.value?.signals?.traffic?.duration_seconds)
    )
  })
  const totalLabel = computed(() => formatTravelMinutes(activeMinutes.value))
  const trafficRatioLabel = computed(() => formatTrafficRatio(estimate.value?.signals?.traffic?.ratio))
  const routeParts = computed(() => routeSummaryParts(selectedRoute.value?.label || estimate.value?.route?.label));
  const mapPoints = computed(() => {
    const primaryPolyline = bestOption.value === 'walk'
      ? polylineToPoints(estimate.value?.walking_polyline)
      : polylineToPoints(estimate.value?.polyline);
    const secondaryPolyline = bestOption.value === 'walk'
      ? polylineToPoints(estimate.value?.polyline)
      : polylineToPoints(estimate.value?.walking_polyline);

    if (primaryPolyline.length > 1) {
      return primaryPolyline;
    }

    if (secondaryPolyline.length > 1) {
      return secondaryPolyline;
    }

    return [coordinateToPoint(selectedRoute.value?.origin), coordinateToPoint(selectedRoute.value?.destination)]
      .filter((point): point is { lat: number; lng: number } => point !== null);
  });
  const statusLabel = computed(() => {
    if (!estimate.value) {
      return 'Load a saved route to see the live commute time.';
    }

    if (bestOption.value === 'walk') {
      return estimate.value.recommendation?.message || 'Walking currently beats queueing.';
    }

    return estimate.value.message?.action || 'Live traffic estimate loaded.';
  });
  const signalLabel = computed(() => {
    const traffic = estimate.value?.signals?.traffic;
    if (!traffic?.label) {
      return 'Traffic unavailable';
    }

    return `${traffic.label} traffic`;
  });
  const badgeLabel = computed(() => {
    if (bestOption.value === 'walk') return 'Walk faster';
    return 'Ride route';
  });
  const hasRoute = computed(() => Boolean(selectedRoute.value && estimate.value));

  function buildUrl(path: string, params: Record<string, string> = {}): URL {
    if (!apiBase.value) {
      throw new Error('Queue API base URL is unavailable.');
    }

    const url = new URL(path, `${apiBase.value}/`);
    Object.entries(params).forEach(([key, value]) => {
      if (!value) return;
      url.searchParams.set(key, value);
    });
    return url;
  }

  async function requestJson(path: string, fallback: string, params: Record<string, string> = {}) {
    const response = await fetch(buildUrl(path, params), {
      headers: { accept: 'application/json' },
    });
    const payload = await parseResponse(response);

    if (!response.ok) {
      throw new Error(resolveErrorMessage(response, payload, fallback));
    }

    return payload;
  }

  async function loadRoutes() {
    loading.routes = true;
    try {
      const payload = await requestJson('/api/puv-queue/routes', 'Failed to load commute routes.');
      routes.value = Array.isArray(payload?.routes) ? payload.routes : [];
      selectedRouteKey.value = resolveSelectedQueueRouteKey(routes.value, readStoredQueueRouteKey());
      storeQueueRouteKey(selectedRouteKey.value);
    } finally {
      loading.routes = false;
    }
  }

  async function loadEstimate() {
    if (!selectedRouteKey.value) {
      estimate.value = null;
      return;
    }

    loading.estimate = true;
    try {
      estimate.value = await requestJson('/api/puv-queue/estimate', 'Failed to load live commute estimate.', {
        polyline: '1',
        routeKey: selectedRouteKey.value,
      }) as QueueEstimate;
    } finally {
      loading.estimate = false;
    }
  }

  async function refreshCommute() {
    try {
      isLoading.value = true;
      error.value = '';
      await loadRoutes();
      await loadEstimate();
    } catch (caughtError: unknown) {
      error.value = caughtError instanceof Error ? caughtError.message : 'Unable to load commute card';
    } finally {
      isLoading.value = false;
    }
  }

  onMounted(() => {
    refreshCommute().catch(() => undefined);
    if (import.meta.client) {
      refreshHandle = window.setInterval(() => {
        refreshCommute().catch(() => undefined);
      }, 60_000);
    }
  });

  onBeforeUnmount(() => {
    if (refreshHandle !== null && import.meta.client) {
      window.clearInterval(refreshHandle);
    }
  });

  return {
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
    statusLabel,
    totalLabel,
    trafficRatioLabel,
    travelLabel,
    waitLabel,
  };
}
