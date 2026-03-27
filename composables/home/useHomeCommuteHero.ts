import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import {
  coordinateToPoint,
  fallbackMinutesFromTraffic,
  formatEta,
  formatTravelMinutes,
  parseResponse,
  polylineToPoints,
  resolveErrorMessage,
  routeSummaryParts,
  trimTrailingSlash
} from '~/lib/homeCommuteHero';
import type { QueueEstimate, QueueRouteSummary } from '~/lib/homeCommuteHero';
import {
  readStoredQueueRouteKey,
  resolveSelectedQueueRouteKey,
  storeQueueRouteKey
} from '~/lib/queueRouteSelection';

export function useHomeCommuteHero() {
  const config = useRuntimeConfig();
  const routes = ref<QueueRouteSummary[]>([]);
  const estimate = ref<QueueEstimate | null>(null);
  const heatmap = ref<Record<string, any> | null>(null);
  const selectedRouteKey = ref('');
  const isLoading = ref(true);
  const error = ref('');
  const loading = reactive({
    estimate: false,
    routes: false
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

  const selectedRoute = computed(
    () => routes.value.find((route) => route.route_key === selectedRouteKey.value) ?? null
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
      return (
        estimate.value?.recommendation?.walk_total_minutes ??
        estimate.value?.recommendation?.ride_total_minutes ??
        null
      );
    }

    return (
      estimate.value?.recommendation?.ride_total_minutes ??
      estimate.value?.recommendation?.walk_total_minutes ??
      fallbackMinutesFromTraffic(estimate.value?.signals?.traffic?.duration_seconds)
    );
  });

  const etaLabel = computed(() => formatEta(activeMinutes.value));
  const durationLabel = computed(() => formatTravelMinutes(activeMinutes.value));

  const routeParts = computed(() =>
    routeSummaryParts(selectedRoute.value?.label || estimate.value?.route?.label)
  );
  const mapPoints = computed(() => {
    const primaryPolyline =
      bestOption.value === 'walk'
        ? polylineToPoints(estimate.value?.walking_polyline)
        : polylineToPoints(estimate.value?.polyline);
    const secondaryPolyline =
      bestOption.value === 'walk'
        ? polylineToPoints(estimate.value?.polyline)
        : polylineToPoints(estimate.value?.walking_polyline);

    if (primaryPolyline.length > 1) {
      return primaryPolyline;
    }

    if (secondaryPolyline.length > 1) {
      return secondaryPolyline;
    }

    return [
      coordinateToPoint(selectedRoute.value?.origin),
      coordinateToPoint(selectedRoute.value?.destination)
    ].filter((point): point is { lat: number; lng: number } => point !== null);
  });
  const predictionMessages = computed(() => {
    if (!estimate.value) {
      return 'Load a saved route to see the live commute time.';
    }

    return estimate.value.message;
  });

  const trafficLevel = computed(() => {
    const traffic = estimate.value?.level;
    if (!traffic) {
      return 'Traffic unavailable';
    }

    return `${traffic} traffic`;
  });

  const predictionRecommendation = computed(() => {
    if (!estimate.value) return [];

    return estimate.recommendation;
  });

  const trafficPredictionScore = computed(() => {
    if (!estimate.value) return '0';

    return estimate.score;
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
      headers: { accept: 'application/json' }
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
      selectedRouteKey.value = resolveSelectedQueueRouteKey(
        routes.value,
        readStoredQueueRouteKey()
      );
      storeQueueRouteKey(selectedRouteKey.value);
    } finally {
      loading.routes = false;
    }
  }

  async function loadEstimate(includePolyline = false) {
    if (!selectedRouteKey.value) {
      estimate.value = null;
      return;
    }

    loading.estimate = true;
    try {
      const payload = (await requestJson(
        '/api/puv-queue/estimate',
        'Failed to load live commute estimate.',
        {
          polyline: includePolyline ? '1' : '',
          routeKey: selectedRouteKey.value
        }
      )) as QueueEstimate;

      const existingEstimate = estimate.value;
      const sameRoute = existingEstimate?.route?.route_key === selectedRouteKey.value;

      estimate.value = !Array.isArray(payload?.polyline) && sameRoute
        ? {
            ...payload,
            polyline: existingEstimate?.polyline ?? null,
            walking_polyline: existingEstimate?.walking_polyline ?? null
          }
        : payload;
    } finally {
      loading.estimate = false;
    }
  }
  async function loadHeatmap() {
    if (!selectedRouteKey.value) {
      estimate.value = null;
      return;
    }

    loading.estimate = true;
    try {
      heatmap.value = (await requestJson(
        '/api/puv-queue/heatmap',
        'Failed to load live commute estimate.',
        {
          routeKey: selectedRouteKey.value
        }
      )) as Record<string, any>;
    } finally {
      loading.estimate = false;
    }
  }
  async function refreshCommute(includePolyline = false) {
    try {
      isLoading.value = true;
      error.value = '';
      await loadRoutes();
      await loadEstimate(includePolyline);
      await loadHeatmap();
    } catch (caughtError: unknown) {
      error.value =
        caughtError instanceof Error ? caughtError.message : 'Unable to load commute card';
    } finally {
      isLoading.value = false;
    }
  }

  onMounted(() => {
    refreshCommute(true).catch(() => undefined);
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

    refreshCommute,
    mapPoints,
    routeParts,
    heatmap,
    trafficPredictionScore,
    trafficLevel,
    predictionMessages,
    predictionRecommendation
  };
}
