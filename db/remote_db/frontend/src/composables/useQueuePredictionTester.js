import { computed, onMounted, reactive, ref } from 'vue'

import {
  getAuthToken,
  getDefaultApiBase,
  normalizeApiBase,
  parseApiResponse,
  resolveApiErrorMessage,
  storeApiBase,
} from '@/lib/queueApi'

export function useQueuePredictionTester() {
  const apiBaseState = ref(getDefaultApiBase())
  const routes = ref([])
  const selectedRouteKey = ref('')
  const routeDetail = ref(null)
  const estimate = ref(null)
  const heatmap = ref(null)
  const includePolyline = ref(true)
  const loading = reactive({
    routes: false,
    route: false,
    estimate: false,
    heatmap: false,
    save: false,
  })
  const errors = reactive({
    routes: '',
    route: '',
    estimate: '',
    heatmap: '',
    save: '',
  })
  const messages = reactive({
    save: '',
  })
  const lastLoadedAt = reactive({
    routes: '',
    route: '',
    estimate: '',
    heatmap: '',
  })

  const apiBase = computed({
    get: () => apiBaseState.value,
    set: (value) => {
      const normalized = normalizeApiBase(value)
      apiBaseState.value = normalized
      storeApiBase(normalized)
    },
  })

  const selectedRouteSummary = computed(
    () => routes.value.find((route) => route.route_key === selectedRouteKey.value) ?? null,
  )

  function ensureApiBase() {
    if (!apiBase.value) {
      throw new Error('Enter the Worker base URL before requesting queue data.')
    }
  }

  function buildUrl(path, params = {}) {
    ensureApiBase()

    const url = new URL(path, `${apiBase.value}/`)
    Object.entries(params).forEach(([key, value]) => {
      if (value == null || value === '') {
        return
      }

      url.searchParams.set(key, String(value))
    })

    return url
  }

  function buildHref(path, params = {}) {
    try {
      return buildUrl(path, params).toString()
    } catch {
      return ''
    }
  }

  async function requestJson(path, { auth = false, body, method = 'GET', params = {}, loadingKey, errorKey, loadedKey, failureLabel }) {
    loading[loadingKey] = true
    errors[errorKey] = ''
    if (errorKey === 'save') messages.save = ''

    try {
      const token = auth ? getAuthToken() : ''
      const headers = {
        accept: 'application/json',
      }
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json'
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(buildUrl(path, params), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const payload = await parseApiResponse(response)

      if (!response.ok) {
        throw new Error(resolveApiErrorMessage(response, payload, failureLabel))
      }

      lastLoadedAt[loadedKey] = new Date().toISOString()
      return payload
    } catch (error) {
      errors[errorKey] = error instanceof Error ? error.message : failureLabel
      throw error
    } finally {
      loading[loadingKey] = false
    }
  }

  async function loadRoutes() {
    const payload = await requestJson('/api/puv-queue/admin/routes', {
      auth: true,
      loadingKey: 'routes',
      errorKey: 'routes',
      loadedKey: 'routes',
      failureLabel: 'Failed to load routes',
    })

    routes.value = Array.isArray(payload?.routes) ? payload.routes : []

    const selectedStillExists = routes.value.some((route) => route.route_key === selectedRouteKey.value)
    if (selectedStillExists) {
      return routes.value
    }

    selectedRouteKey.value = routes.value.find((route) => route.is_default)?.route_key ?? routes.value[0]?.route_key ?? ''
    return routes.value
  }

  async function loadRouteDetail(routeKey = selectedRouteKey.value) {
    if (!routeKey) {
      routeDetail.value = null
      return null
    }

    const payload = await requestJson(`/api/puv-queue/admin/routes/${routeKey}`, {
      auth: true,
      loadingKey: 'route',
      errorKey: 'route',
      loadedKey: 'route',
      failureLabel: 'Failed to load route detail',
    })

    routeDetail.value = payload
    return payload
  }

  async function loadEstimate(routeKey = selectedRouteKey.value) {
    const payload = await requestJson('/api/puv-queue/estimate', {
      params: {
        routeKey,
        polyline: includePolyline.value ? '1' : '',
      },
      loadingKey: 'estimate',
      errorKey: 'estimate',
      loadedKey: 'estimate',
      failureLabel: 'Failed to load estimate',
    })

    estimate.value = payload
    return payload
  }

  async function loadHeatmap(routeKey = selectedRouteKey.value) {
    const payload = await requestJson('/api/puv-queue/heatmap', {
      params: {
        routeKey,
      },
      loadingKey: 'heatmap',
      errorKey: 'heatmap',
      loadedKey: 'heatmap',
      failureLabel: 'Failed to load heatmap',
    })

    heatmap.value = payload
    return payload
  }

  async function selectRoute(routeKey) {
    selectedRouteKey.value = routeKey

    if (!routeKey) {
      routeDetail.value = null
      estimate.value = null
      heatmap.value = null
      return
    }

    await Promise.allSettled([
      loadRouteDetail(routeKey),
      loadEstimate(routeKey),
      loadHeatmap(routeKey),
    ])
  }

  async function refreshPredictions() {
    if (!selectedRouteKey.value) {
      return
    }

    await Promise.allSettled([
      loadEstimate(selectedRouteKey.value),
      loadHeatmap(selectedRouteKey.value),
    ])
  }

  async function refreshAll() {
    await loadRoutes()

    if (!selectedRouteKey.value) {
      routeDetail.value = null
      estimate.value = null
      heatmap.value = null
      return
    }

    await Promise.allSettled([
      loadRouteDetail(selectedRouteKey.value),
      loadEstimate(selectedRouteKey.value),
      loadHeatmap(selectedRouteKey.value),
    ])
  }

  async function saveRoute(input, routeKey = selectedRouteKey.value) {
    const payload = await requestJson(`/api/puv-queue/admin/routes/${routeKey}`, {
      auth: true,
      body: input,
      method: 'PUT',
      loadingKey: 'save',
      errorKey: 'save',
      loadedKey: 'route',
      failureLabel: 'Failed to save route',
    })

    routeDetail.value = payload

    await requestJson('/api/puv-queue/admin/cache/invalidate', {
      auth: true,
      method: 'POST',
      params: { routeKey },
      loadingKey: 'save',
      errorKey: 'save',
      loadedKey: 'route',
      failureLabel: 'Failed to invalidate route cache',
    })

    await Promise.allSettled([
      loadRoutes(),
      loadRouteDetail(routeKey),
      loadEstimate(routeKey),
      loadHeatmap(routeKey),
    ])
    messages.save = 'Route updated.'
  }

  onMounted(() => {
    if (!apiBase.value) {
      return
    }

    refreshAll().catch(() => {})
  })

  return {
    apiBase,
    buildHref,
    errors,
    estimate,
    heatmap,
    includePolyline,
    lastLoadedAt,
    loading,
    messages,
    refreshAll,
    refreshPredictions,
    routeDetail,
    routes,
    loadRoutes,
    saveRoute,
    selectRoute,
    selectedRouteKey,
    selectedRouteSummary,
  }
}
