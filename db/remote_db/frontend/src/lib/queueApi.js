const storageKey = 'iku.queuePrediction.apiBase'

export function getDefaultApiBase() {
  if (typeof window === 'undefined') {
    return ''
  }

  const stored = window.localStorage.getItem(storageKey)
  if (stored) {
    return stored
  }

  const { hostname, origin } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8787'
  }

  return origin
}

export function normalizeApiBase(value) {
  return value.trim().replace(/\/+$/, '')
}

export function storeApiBase(value) {
  if (typeof window === 'undefined') {
    return
  }

  const normalized = normalizeApiBase(value)
  if (normalized) {
    window.localStorage.setItem(storageKey, normalized)
    return
  }

  window.localStorage.removeItem(storageKey)
}

export async function parseApiResponse(response) {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function resolveApiErrorMessage(response, payload, fallback) {
  if (payload && typeof payload === 'object' && typeof payload.error === 'string') {
    return payload.error
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim()
  }

  return `${fallback} (${response.status})`
}

export function getAuthToken() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem('authToken') || ''
}
