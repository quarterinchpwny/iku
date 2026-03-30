import {
  readStoredQueuePresetId,
  readStoredQueuePresets,
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
import {
  buildComparisonAdjustmentParam,
  buildEstimatePersonalizationParams,
  clearQueuePersonalization,
  readStoredQueuePersonalizations,
  resolveQueuePersonalization,
  sanitizeQueuePersonalizations,
  saveQueuePersonalization,
  storeQueuePersonalizations
} from '~/lib/queuePersonalization';

type QueueRouteSummary = {
  route_key: string;
  label: string;
  timezone: string;
  origin: [number, number];
  destination: [number, number];
  is_active: boolean;
  is_default: boolean;
  updated_at: number;
};

type QueueEstimate = Record<string, any>;
type QueueHeatmap = Record<string, any>;
type QueueComparison = Record<string, any>;
type QueueRoutePersonalization = {
  access_minutes: number;
  egress_minutes: number;
  max_walk_minutes: number | null;
};
type QueueRequestKey = 'routes' | 'estimate' | 'heatmap' | 'comparison';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

async function parseResponse(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function resolveErrorMessage(response: Response, payload: any, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }

  return response.statusText || fallback;
}

export function useQueueCommute() {
  const config = useRuntimeConfig();
  const routes = ref<QueueRouteSummary[]>([]);
  const presets = ref<QueueCommutePreset[]>([]);
  const selectedPresetId = ref('');
  const selectedRouteKey = ref('');
  const estimate = ref<QueueEstimate | null>(null);
  const heatmap = ref<QueueHeatmap | null>(null);
  const comparison = ref<QueueComparison | null>(null);
  const personalizations = ref<Record<string, QueueRoutePersonalization>>({});
  const loading = reactive({
    routes: false,
    estimate: false,
    heatmap: false,
    comparison: false,
  });
  const errors = reactive({
    routes: '',
    estimate: '',
    heatmap: '',
    comparison: '',
  });
  const lastLoadedAt = reactive({
    routes: '',
    estimate: '',
    heatmap: '',
    comparison: '',
  });
  let refreshTimer: number | null = null;

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

  const selectedRoute = computed(() => {
    return routes.value.find((route) => route.route_key === selectedRouteKey.value) ?? null;
  });
  const selectedPersonalization = computed(() =>
    resolveQueuePersonalization(selectedRouteKey.value, personalizations.value)
  );
  const busy = computed(() => loading.routes || loading.estimate || loading.heatmap || loading.comparison);

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

  async function requestJson(
    path: string,
    options: {
      errorKey: QueueRequestKey;
      loadingKey: QueueRequestKey;
      loadedKey: QueueRequestKey;
      fallback: string;
      params?: Record<string, string>;
    },
  ): Promise<any> {
    loading[options.loadingKey] = true;
    errors[options.errorKey] = '';

    try {
      const response = await fetch(buildUrl(path, options.params), {
        headers: { accept: 'application/json' },
      });
      const payload = await parseResponse(response);

      if (!response.ok) {
        throw new Error(resolveErrorMessage(response, payload, options.fallback));
      }

      lastLoadedAt[options.loadedKey] = new Date().toISOString();
      return payload;
    } catch (error) {
      errors[options.errorKey] = error instanceof Error ? error.message : options.fallback;
      throw error;
    } finally {
      loading[options.loadingKey] = false;
    }
  }

  function applySelectedRoute(candidates: QueueRouteSummary[]): void {
    const sanitizedPresets = sanitizeQueuePresets(candidates, presets.value.length ? presets.value : readStoredQueuePresets());
    presets.value = sanitizedPresets;
    storeQueuePresets(sanitizedPresets);
    personalizations.value = sanitizeQueuePersonalizations(
      candidates,
      Object.keys(personalizations.value).length ? personalizations.value : readStoredQueuePersonalizations()
    );
    storeQueuePersonalizations(personalizations.value);

    const resolvedPreset = resolveSelectedQueuePreset(
      candidates,
      sanitizedPresets,
      selectedPresetId.value || readStoredQueuePresetId(),
    );

    selectedPresetId.value = resolvedPreset?.id ?? '';
    storeQueuePresetId(selectedPresetId.value);

    selectedRouteKey.value = resolveSelectedQueueRouteKey(
      candidates,
      selectedRouteKey.value,
      sanitizedPresets,
      selectedPresetId.value,
    );
    storeQueueRouteKey(selectedRouteKey.value);
  }

  async function loadRoutes(): Promise<QueueRouteSummary[]> {
    const payload = await requestJson('/api/puv-queue/routes', {
      errorKey: 'routes',
      loadingKey: 'routes',
      loadedKey: 'routes',
      fallback: 'Failed to load commute routes.',
    });

    routes.value = Array.isArray(payload?.routes) ? payload.routes : [];
    applySelectedRoute(routes.value);
    return routes.value;
  }

  async function loadEstimate(routeKey = selectedRouteKey.value, includePolyline = false): Promise<QueueEstimate | null> {
    if (!routeKey) {
      estimate.value = null;
      return null;
    }

    const payload = await requestJson('/api/puv-queue/estimate', {
      errorKey: 'estimate',
      loadingKey: 'estimate',
      loadedKey: 'estimate',
      fallback: 'Failed to load live queue estimate.',
      params: {
        routeKey,
        polyline: includePolyline ? '1' : '',
        ...buildEstimatePersonalizationParams(resolveQueuePersonalization(routeKey, personalizations.value)),
      },
    });

    const existingPolyline = estimate.value?.route?.route_key === routeKey && Array.isArray(estimate.value?.polyline)
      ? estimate.value.polyline
      : null;

    estimate.value = !Array.isArray(payload?.polyline) && existingPolyline
      ? { ...payload, polyline: existingPolyline }
      : payload;
    return payload;
  }

  async function loadComparison(routeKeys = routes.value.map((route) => route.route_key)): Promise<QueueComparison | null> {
    if (!routeKeys.length) {
      comparison.value = null;
      return null;
    }

    const payload = await requestJson('/api/puv-queue/compare', {
      errorKey: 'comparison',
      loadingKey: 'comparison',
      loadedKey: 'comparison',
      fallback: 'Failed to load route comparison.',
      params: {
        routeKeys: routeKeys.join(','),
        adjustments: buildComparisonAdjustmentParam(routeKeys, personalizations.value),
      },
    });

    comparison.value = payload;
    return payload;
  }

  async function loadHeatmap(routeKey = selectedRouteKey.value): Promise<QueueHeatmap | null> {
    if (!routeKey) {
      heatmap.value = null;
      return null;
    }

    const payload = await requestJson('/api/puv-queue/heatmap', {
      errorKey: 'heatmap',
      loadingKey: 'heatmap',
      loadedKey: 'heatmap',
      fallback: 'Failed to load route heatmap.',
      params: { routeKey },
    });

    heatmap.value = payload;
    return payload;
  }

  async function refreshPredictions(
    routeKey = selectedRouteKey.value,
    includePolyline = false,
    options: { comparison?: boolean } = {},
  ): Promise<void> {
    if (!routeKey) {
      estimate.value = null;
      heatmap.value = null;
      if (options.comparison) {
        await loadComparison();
      }
      return;
    }

    const tasks = [
      loadEstimate(routeKey, includePolyline),
      loadHeatmap(routeKey),
    ];

    if (options.comparison) {
      tasks.push(loadComparison());
    }

    await Promise.allSettled(tasks);
  }

  async function refreshAll(): Promise<void> {
    await loadRoutes();
    await refreshPredictions(selectedRouteKey.value, true, { comparison: true });
  }

  async function selectRoute(routeKey: string): Promise<void> {
    selectedRouteKey.value = routeKey;
    selectedPresetId.value = '';
    storeQueuePresetId('');
    storeQueueRouteKey(routeKey);
    await refreshPredictions(routeKey, true);
  }

  async function selectPreset(presetId: string): Promise<void> {
    const preset = presets.value.find((candidate) => candidate.id === presetId);
    if (!preset) {
      return;
    }

    selectedPresetId.value = preset.id;
    selectedRouteKey.value = preset.route_key;
    storeQueuePresetId(preset.id);
    storeQueueRouteKey(preset.route_key);
    await refreshPredictions(preset.route_key, true);
  }

  function saveCurrentPreset(label: string, isDefault = false): void {
    if (!selectedRouteKey.value) {
      return;
    }

    const saved = saveQueuePreset(presets.value, {
      is_default: isDefault,
      label,
      route_key: selectedRouteKey.value,
    });

    if (!saved) {
      return;
    }

    presets.value = sanitizeQueuePresets(routes.value, saved.presets);
    selectedPresetId.value = saved.preset.id;
    storeQueuePresets(presets.value);
    storeQueuePresetId(saved.preset.id);
  }

  function deletePreset(presetId: string): void {
    const removedSelected = selectedPresetId.value === presetId;
    presets.value = sanitizeQueuePresets(routes.value, removeQueuePreset(presets.value, presetId));
    storeQueuePresets(presets.value);

    if (!removedSelected) {
      return;
    }

    selectedPresetId.value = '';
    storeQueuePresetId('');
  }

  function saveSelectedPersonalization(input: QueueRoutePersonalization): void {
    if (!selectedRouteKey.value) {
      return;
    }

    personalizations.value = saveQueuePersonalization(personalizations.value, selectedRouteKey.value, input);
    storeQueuePersonalizations(personalizations.value);
  }

  function resetSelectedPersonalization(): void {
    if (!selectedRouteKey.value) {
      return;
    }

    personalizations.value = clearQueuePersonalization(personalizations.value, selectedRouteKey.value);
    storeQueuePersonalizations(personalizations.value);
  }

  function startAutoRefresh(): void {
    if (!import.meta.client || refreshTimer !== null) return;

    refreshTimer = window.setInterval(() => {
      refreshPredictions().catch(() => undefined);
    }, 60_000);
  }

  function stopAutoRefresh(): void {
    if (refreshTimer === null || !import.meta.client) return;
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }

  onMounted(() => {
    refreshAll().catch(() => undefined);
    startAutoRefresh();
  });

  onBeforeUnmount(() => {
    stopAutoRefresh();
  });

  return {
    busy,
    comparison,
    errors,
    estimate,
    heatmap,
    lastLoadedAt,
    loading,
    presets,
    personalizations,
    refreshAll,
    refreshPredictions,
    routes,
    saveCurrentPreset,
    saveSelectedPersonalization,
    selectPreset,
    selectedPresetId,
    selectedPersonalization,
    selectedRoute,
    selectedRouteKey,
    selectRoute,
    deletePreset,
    resetSelectedPersonalization,
  };
}
