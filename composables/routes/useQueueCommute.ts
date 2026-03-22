import { resolveSelectedQueueRouteKey, storeQueueRouteKey } from '~/lib/queueRouteSelection';

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
  const selectedRouteKey = ref('');
  const estimate = ref<QueueEstimate | null>(null);
  const heatmap = ref<QueueHeatmap | null>(null);
  const loading = reactive({
    routes: false,
    estimate: false,
    heatmap: false,
  });
  const errors = reactive({
    routes: '',
    estimate: '',
    heatmap: '',
  });
  const lastLoadedAt = reactive({
    routes: '',
    estimate: '',
    heatmap: '',
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

  const busy = computed(() => loading.routes || loading.estimate || loading.heatmap);

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
      errorKey: 'routes' | 'estimate' | 'heatmap';
      loadingKey: 'routes' | 'estimate' | 'heatmap';
      loadedKey: 'routes' | 'estimate' | 'heatmap';
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
    selectedRouteKey.value = resolveSelectedQueueRouteKey(candidates, selectedRouteKey.value);
    storeRouteKey(selectedRouteKey.value);
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

  async function refreshPredictions(routeKey = selectedRouteKey.value, includePolyline = false): Promise<void> {
    if (!routeKey) {
      estimate.value = null;
      heatmap.value = null;
      return;
    }

    await Promise.allSettled([
      loadEstimate(routeKey, includePolyline),
      loadHeatmap(routeKey),
    ]);
  }

  async function refreshAll(): Promise<void> {
    await loadRoutes();
    await refreshPredictions(selectedRouteKey.value, true);
  }

  async function selectRoute(routeKey: string): Promise<void> {
    selectedRouteKey.value = routeKey;
    storeRouteKey(routeKey);
    await refreshPredictions(routeKey, true);
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
    errors,
    estimate,
    heatmap,
    lastLoadedAt,
    loading,
    refreshAll,
    refreshPredictions,
    routes,
    selectedRoute,
    selectedRouteKey,
    selectRoute,
  };
}
