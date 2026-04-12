import { computed, onMounted, reactive, ref } from 'vue'

import {
  getAuthToken,
  getDefaultApiBase,
  normalizeApiBase,
  parseApiResponse,
  resolveApiErrorMessage,
  storeApiBase,
} from '@/lib/queueApi'
import {
  readStoredPresetId,
  readStoredPresets,
  removePreset,
  resolveSelectedPreset,
  sanitizePresets,
  savePreset,
  storePresetId,
  storePresets,
} from '@/lib/queuePresets'

export function useQueuePredictionTester() {
  const apiBaseState = ref(getDefaultApiBase())
  const holidayYear = ref(new Date().getFullYear())
  const routes = ref([])
  const presets = ref([])
  const selectedPresetId = ref('')
  const selectedRouteKey = ref('')
  const routeDetail = ref(null)
  const editorMode = ref('edit')
  const createTemplate = ref(null)
  const estimate = ref(null)
  const heatmap = ref(null)
  const incidents = ref([])
  const observations = ref([])
  const venueCandidates = ref([])
  const includePolyline = ref(true)
  const loading = reactive({
    routes: false,
    route: false,
    estimate: false,
    heatmap: false,
    holidays: false,
    context: false,
    venues: false,
    save: false,
  })
  const errors = reactive({
    routes: '',
    route: '',
    estimate: '',
    heatmap: '',
    holidays: '',
    context: '',
    venues: '',
    save: '',
  })
  const messages = reactive({
    save: '',
    context: '',
  })
  const lastLoadedAt = reactive({
    routes: '',
    route: '',
    estimate: '',
    heatmap: '',
    holidays: '',
    context: '',
    venues: '',
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
  const selectedPreset = computed(
    () => presets.value.find((preset) => preset.id === selectedPresetId.value) ?? null,
  )
  function cloneRouteTemplate(route) {
    if (!route) {
      return null
    }

    return {
      ...route,
      origin: [...route.origin],
      destination: [...route.destination],
      baseline_by_hour: [...route.baseline_by_hour],
      tod_score_by_hour: [...route.tod_score_by_hour],
      holidays: [...route.holidays],
    }
  }

  function clearSaveState() {
    errors.save = ''
    messages.save = ''
  }

  function clearContextState() {
    errors.context = ''
    errors.holidays = ''
    errors.venues = ''
    messages.context = ''
  }

  function exitCreateMode() {
    editorMode.value = 'edit'
    createTemplate.value = null
  }

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
    presets.value = sanitizePresets(routes.value, presets.value.length ? presets.value : readStoredPresets())
    storePresets(presets.value)

    const resolvedPreset = resolveSelectedPreset(
      routes.value,
      presets.value,
      selectedPresetId.value || readStoredPresetId(),
    )
    selectedPresetId.value = resolvedPreset?.id ?? ''
    storePresetId(selectedPresetId.value)

    const selectedStillExists = routes.value.some((route) => route.route_key === selectedRouteKey.value)
    if (resolvedPreset?.route_key) {
      selectedRouteKey.value = resolvedPreset.route_key
      return routes.value
    }

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

  async function syncHolidayCalendar(year = holidayYear.value) {
    clearContextState()

    const payload = await requestJson('/api/puv-queue/admin/holidays/sync', {
      auth: true,
      method: 'POST',
      params: { year },
      loadingKey: 'holidays',
      errorKey: 'holidays',
      loadedKey: 'holidays',
      failureLabel: 'Failed to sync holiday calendar',
    })

    holidayYear.value = payload?.year ?? year
    messages.context = `Synced ${payload?.imported ?? 0} holidays for ${holidayYear.value}.`

    await Promise.allSettled([
      loadEstimate(selectedRouteKey.value),
      loadHeatmap(selectedRouteKey.value),
    ])

    return payload
  }

  async function loadIncidents(routeKey = selectedRouteKey.value) {
    if (!routeKey) {
      incidents.value = []
      return []
    }

    const payload = await requestJson('/api/puv-queue/admin/incidents', {
      auth: true,
      params: { routeKey },
      loadingKey: 'context',
      errorKey: 'context',
      loadedKey: 'context',
      failureLabel: 'Failed to load route incidents',
    })

    incidents.value = Array.isArray(payload?.incidents) ? payload.incidents : []
    return incidents.value
  }

  async function loadObservations(routeKey = selectedRouteKey.value) {
    if (!routeKey) {
      observations.value = []
      return []
    }

    const payload = await requestJson('/api/puv-queue/admin/observations', {
      auth: true,
      params: { routeKey, limit: 20 },
      loadingKey: 'context',
      errorKey: 'context',
      loadedKey: 'context',
      failureLabel: 'Failed to load route observations',
    })

    observations.value = Array.isArray(payload?.observations) ? payload.observations : []
    return observations.value
  }

  async function loadContext(routeKey = selectedRouteKey.value) {
    if (!routeKey) {
      incidents.value = []
      observations.value = []
      return
    }

    await Promise.allSettled([
      loadIncidents(routeKey),
      loadObservations(routeKey),
    ])
  }

  async function discoverVenues(routeKey = selectedRouteKey.value, radiusMeters = 2500) {
    if (!routeKey) {
      venueCandidates.value = []
      return []
    }

    clearContextState()

    const payload = await requestJson('/api/puv-queue/admin/venues/discover', {
      auth: true,
      params: { radiusMeters, routeKey },
      loadingKey: 'venues',
      errorKey: 'venues',
      loadedKey: 'venues',
      failureLabel: 'Failed to discover nearby venues',
    })

    venueCandidates.value = Array.isArray(payload?.venues) ? payload.venues : []
    messages.context = venueCandidates.value.length
      ? `Loaded ${venueCandidates.value.length} nearby venues.`
      : 'No nearby venues were returned.'
    return venueCandidates.value
  }

  async function selectRoute(routeKey) {
    exitCreateMode()
    clearContextState()
    selectedRouteKey.value = routeKey
    selectedPresetId.value = ''
    storePresetId('')

    if (!routeKey) {
      routeDetail.value = null
      estimate.value = null
      heatmap.value = null
      incidents.value = []
      observations.value = []
      venueCandidates.value = []
      return
    }

    await Promise.allSettled([
      loadRouteDetail(routeKey),
      loadEstimate(routeKey),
      loadHeatmap(routeKey),
      loadContext(routeKey),
    ])
  }

  async function selectPreset(presetId) {
    const preset = presets.value.find((candidate) => candidate.id === presetId)
    if (!preset) {
      return
    }

    selectedPresetId.value = preset.id
    selectedRouteKey.value = preset.route_key
    storePresetId(preset.id)
    await selectRoute(preset.route_key)
    selectedPresetId.value = preset.id
    storePresetId(preset.id)
  }

  function saveCurrentPreset(label, isDefault = false) {
    if (!selectedRouteKey.value) {
      return
    }

    const saved = savePreset(presets.value, {
      is_default: isDefault,
      label,
      route_key: selectedRouteKey.value,
    })

    if (!saved) {
      return
    }

    presets.value = sanitizePresets(routes.value, saved.presets)
    selectedPresetId.value = saved.preset.id
    storePresets(presets.value)
    storePresetId(saved.preset.id)
  }

  function deletePreset(presetId) {
    const removedSelected = selectedPresetId.value === presetId
    presets.value = sanitizePresets(routes.value, removePreset(presets.value, presetId))
    storePresets(presets.value)

    if (!removedSelected) {
      return
    }

    selectedPresetId.value = ''
    storePresetId('')
  }

  function startCreateRoute() {
    if (!routeDetail.value) {
      return
    }

    createTemplate.value = cloneRouteTemplate(routeDetail.value)
    editorMode.value = 'create'
    clearSaveState()
  }

  function cancelCreateRoute() {
    exitCreateMode()
    clearSaveState()
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
      incidents.value = []
      observations.value = []
      venueCandidates.value = []
      return
    }

    await Promise.allSettled([
      loadRouteDetail(selectedRouteKey.value),
      loadEstimate(selectedRouteKey.value),
      loadHeatmap(selectedRouteKey.value),
      loadContext(selectedRouteKey.value),
    ])
  }

  async function createIncident(input) {
    clearContextState()

    const payload = await requestJson('/api/puv-queue/admin/incidents', {
      auth: true,
      body: input,
      method: 'POST',
      loadingKey: 'context',
      errorKey: 'context',
      loadedKey: 'context',
      failureLabel: 'Failed to create incident',
    })

    await Promise.allSettled([
      loadIncidents(input.route_key),
      loadEstimate(input.route_key),
    ])
    messages.context = 'Incident added.'
    return payload
  }

  async function deleteIncident(id, routeKey = selectedRouteKey.value) {
    clearContextState()

    await requestJson(`/api/puv-queue/admin/incidents/${id}`, {
      auth: true,
      method: 'DELETE',
      loadingKey: 'context',
      errorKey: 'context',
      loadedKey: 'context',
      failureLabel: 'Failed to delete incident',
    })

    await Promise.allSettled([
      loadIncidents(routeKey),
      loadEstimate(routeKey),
    ])
    messages.context = 'Incident removed.'
  }

  async function createObservation(input) {
    clearContextState()

    const payload = await requestJson('/api/puv-queue/admin/observations', {
      auth: true,
      body: input,
      method: 'POST',
      loadingKey: 'context',
      errorKey: 'context',
      loadedKey: 'context',
      failureLabel: 'Failed to create observation',
    })

    await Promise.allSettled([
      loadObservations(input.route_key),
      loadEstimate(input.route_key),
    ])
    messages.context = 'Observation added.'
    return payload
  }

  async function deleteObservation(id, routeKey = selectedRouteKey.value) {
    clearContextState()

    await requestJson(`/api/puv-queue/admin/observations/${id}`, {
      auth: true,
      method: 'DELETE',
      loadingKey: 'context',
      errorKey: 'context',
      loadedKey: 'context',
      failureLabel: 'Failed to delete observation',
    })

    await Promise.allSettled([
      loadObservations(routeKey),
      loadEstimate(routeKey),
    ])
    messages.context = 'Observation removed.'
  }

  async function createRoute(input) {
    const payload = await requestJson('/api/puv-queue/admin/routes', {
      auth: true,
      body: input,
      method: 'POST',
      loadingKey: 'save',
      errorKey: 'save',
      loadedKey: 'route',
      failureLabel: 'Failed to create route',
    })

    selectedRouteKey.value = payload.route_key
    exitCreateMode()

    await Promise.allSettled([
      loadRoutes(),
      loadRouteDetail(payload.route_key),
      loadEstimate(payload.route_key),
      loadHeatmap(payload.route_key),
    ])
    messages.save = 'Route created.'
    return payload
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
    cancelCreateRoute,
    createIncident,
    createObservation,
    createRoute,
    createTemplate,
    deleteIncident,
    deleteObservation,
    discoverVenues,
    editorMode,
    errors,
    estimate,
    heatmap,
    holidayYear,
    includePolyline,
    incidents,
    lastLoadedAt,
    loadContext,
    loading,
    observations,
    messages,
    presets,
    refreshAll,
    refreshPredictions,
    saveCurrentPreset,
    routeDetail,
    routes,
    loadRoutes,
    saveRoute,
    selectedPreset,
    selectedPresetId,
    selectPreset,
    selectRoute,
    selectedRouteKey,
    selectedRouteSummary,
    startCreateRoute,
    syncHolidayCalendar,
    venueCandidates,
    deletePreset,
  }
}
