const presetsStorageKey = 'iku.queuePrediction.presets'
const selectedPresetStorageKey = 'iku.queuePrediction.selectedPreset'

function canUseStorage() {
  return typeof window !== 'undefined'
}

function createPresetId() {
  if (canUseStorage() && typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizePreset(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const id = String(value.id || '').trim()
  const label = String(value.label || '').trim()
  const routeKey = String(value.route_key || '').trim()
  if (!id || !label || !routeKey) {
    return null
  }

  const createdAt = Number(value.created_at)
  const updatedAt = Number(value.updated_at)

  return {
    created_at: Number.isFinite(createdAt) ? createdAt : Date.now(),
    id,
    is_default: Boolean(value.is_default),
    label,
    route_key: routeKey,
    updated_at: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
  }
}

export function readStoredPresets() {
  if (!canUseStorage()) {
    return []
  }

  try {
    const raw = window.localStorage.getItem(presetsStorageKey)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.map(normalizePreset).filter(Boolean)
  } catch {
    return []
  }
}

export function storePresets(presets) {
  if (!canUseStorage()) {
    return
  }

  if (!Array.isArray(presets) || presets.length === 0) {
    window.localStorage.removeItem(presetsStorageKey)
    return
  }

  window.localStorage.setItem(presetsStorageKey, JSON.stringify(presets))
}

export function readStoredPresetId() {
  if (!canUseStorage()) {
    return ''
  }

  return String(window.localStorage.getItem(selectedPresetStorageKey) || '').trim()
}

export function storePresetId(value) {
  if (!canUseStorage()) {
    return
  }

  if (!value) {
    window.localStorage.removeItem(selectedPresetStorageKey)
    return
  }

  window.localStorage.setItem(selectedPresetStorageKey, value)
}

export function sanitizePresets(routes, presets) {
  const validRouteKeys = new Set((routes || []).map((route) => route.route_key))
  let defaultAssigned = false

  return (presets || [])
    .filter((preset) => validRouteKeys.has(preset.route_key))
    .map((preset) => {
      const normalized = {
        ...preset,
        label: String(preset.label || '').trim(),
        route_key: String(preset.route_key || '').trim(),
      }

      if (normalized.is_default && !defaultAssigned) {
        defaultAssigned = true
        return normalized
      }

      if (normalized.is_default) {
        return { ...normalized, is_default: false }
      }

      return normalized
    })
}

export function resolveSelectedPreset(routes, presets, preferredPresetId = '') {
  const requestedId = preferredPresetId || readStoredPresetId()
  const validPresets = sanitizePresets(routes, presets)
  const requested = validPresets.find((preset) => preset.id === requestedId)
  if (requested) {
    return requested
  }

  return validPresets.find((preset) => preset.is_default) ?? null
}

export function savePreset(presets, input) {
  const label = String(input?.label || '').trim()
  const routeKey = String(input?.route_key || '').trim()
  if (!label || !routeKey) {
    return null
  }

  const now = Date.now()
  const existingIndex = (presets || []).findIndex((preset) => preset.id === input.id)
  const basePreset = existingIndex >= 0
    ? {
        ...presets[existingIndex],
        label,
        route_key: routeKey,
        is_default: Boolean(input.is_default),
        updated_at: now,
      }
    : {
        created_at: now,
        id: createPresetId(),
        is_default: Boolean(input.is_default),
        label,
        route_key: routeKey,
        updated_at: now,
      }

  const nextPresets = existingIndex >= 0
    ? presets.map((preset, index) => (index === existingIndex ? basePreset : preset))
    : [...presets, basePreset]

  const normalizedPresets = !basePreset.is_default
    ? nextPresets
    : nextPresets.map((preset) =>
        preset.id === basePreset.id ? preset : { ...preset, is_default: false }
      )

  return {
    preset: normalizedPresets.find((preset) => preset.id === basePreset.id) ?? basePreset,
    presets: normalizedPresets,
  }
}

export function removePreset(presets, presetId) {
  return (presets || []).filter((preset) => preset.id !== presetId)
}
