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
  buildQueueConfidenceState,
  buildQueueDepartureCall,
  buildQueueSignalState
} from '~/lib/queueEstimateTrust';
import {
  readStoredQueuePresetId,
  readStoredQueuePresets,
  readStoredQueueRouteKey,
  removeQueuePreset,
  resolveSelectedQueuePreset,
  resolveSelectedQueueRouteKey,
  saveQueuePreset,
  sanitizeQueuePresets,
  storeQueuePresetId,
  storeQueuePresets,
  storeQueueRouteKey
} from '~/lib/queueRouteSelection';
import type { QueueCommutePreset } from '~/lib/queueRouteSelection';

export function useHomeCommuteHero() {
  const config = useRuntimeConfig();
  const routes = ref<QueueRouteSummary[]>([]);
  const presets = ref<QueueCommutePreset[]>([]);
  const selectedPresetId = ref('');
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
  const selectedPreset = computed(
    () => presets.value.find((preset) => preset.id === selectedPresetId.value) ?? null
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
  const headlineLabel = computed(() => {
    if (estimate.value?.message?.headline) {
      return estimate.value.message.headline;
    }

    if (!estimate.value?.level) {
      return 'Commute unavailable';
    }

    return `${estimate.value.level.replace('_', ' ')} traffic`;
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
  const signalState = computed(() => buildQueueSignalState(estimate.value));
  const confidenceState = computed(() => buildQueueConfidenceState(estimate.value));
  const departureCall = computed(() => buildQueueDepartureCall(estimate.value));
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
      const sanitizedPresets = sanitizeQueuePresets(
        routes.value,
        presets.value.length ? presets.value : readStoredQueuePresets()
      );
      presets.value = sanitizedPresets;
      storeQueuePresets(sanitizedPresets);
      const resolvedPreset = resolveSelectedQueuePreset(
        routes.value,
        sanitizedPresets,
        selectedPresetId.value || readStoredQueuePresetId()
      );
      selectedPresetId.value = resolvedPreset?.id ?? '';
      storeQueuePresetId(selectedPresetId.value);
      selectedRouteKey.value = resolveSelectedQueueRouteKey(
        routes.value,
        readStoredQueueRouteKey(),
        sanitizedPresets,
        selectedPresetId.value
      );
      storeQueueRouteKey(selectedRouteKey.value);
    } finally {
      loading.routes = false;
    }
  }

  async function selectPreset(presetId: string) {
    const preset = presets.value.find((candidate) => candidate.id === presetId);
    if (!preset) {
      return;
    }

    selectedPresetId.value = preset.id;
    selectedRouteKey.value = preset.route_key;
    storeQueuePresetId(preset.id);
    storeQueueRouteKey(preset.route_key);

    try {
      error.value = '';
      await Promise.allSettled([loadEstimate(true), loadHeatmap()]);
    } catch (caughtError: unknown) {
      error.value =
        caughtError instanceof Error ? caughtError.message : 'Unable to load selected preset';
    }
  }

  function saveCurrentPreset(label: string, isDefault = false) {
    if (!selectedRouteKey.value) {
      return;
    }

    const saved = saveQueuePreset(presets.value, {
      is_default: isDefault,
      label,
      route_key: selectedRouteKey.value
    });

    if (!saved) {
      return;
    }

    presets.value = sanitizeQueuePresets(routes.value, saved.presets);
    selectedPresetId.value = saved.preset.id;
    storeQueuePresets(presets.value);
    storeQueuePresetId(saved.preset.id);
  }

  function deletePreset(presetId: string) {
    const removedSelected = selectedPresetId.value === presetId;
    presets.value = sanitizeQueuePresets(routes.value, removeQueuePreset(presets.value, presetId));
    storeQueuePresets(presets.value);

    if (!removedSelected) {
      return;
    }

    selectedPresetId.value = '';
    storeQueuePresetId('');
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
    confidenceState,
    departureCall,
    durationLabel,
    deletePreset,
    error,
    etaLabel,
    hasRoute,
    headlineLabel,
    isLoading,

    refreshCommute,
    mapPoints,
    presets,
    routeParts,
    routes,
    saveCurrentPreset,
    signalState,
    heatmap,
    selectedPreset,
    selectedPresetId,
    selectedRoute,
    selectPreset,
    trafficPredictionScore,
    trafficLevel,
    predictionMessages,
    predictionRecommendation
  };
}
