export function formatCoordinate(coordinate) {
  if (!Array.isArray(coordinate) || coordinate.length !== 2) {
    return 'Unavailable'
  }

  return `${coordinate[1].toFixed(5)}, ${coordinate[0].toFixed(5)}`
}

export function formatDuration(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return 'Unavailable'
  }

  if (seconds < 60) {
    return `${Math.round(seconds)} sec`
  }

  const minutes = Math.round(seconds / 60)
  return `${minutes} min`
}

export function formatTimestamp(value) {
  if (!value) {
    return 'Never'
  }

  return new Date(value).toLocaleString()
}

export function formatUpdatedAt(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Unavailable'
  }

  return new Date(value).toLocaleString()
}

export function levelClasses(level) {
  return {
    low: 'border-zinc-700 bg-zinc-900 text-zinc-200',
    moderate: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
    high: 'border-orange-500/40 bg-orange-500/15 text-orange-100',
    very_high: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  }[level] ?? 'border-zinc-700 bg-zinc-900 text-zinc-200'
}

export function sourceLabel(source) {
  return {
    routing_live: 'Live routing',
    routing_cache: 'Cached routing',
    historical_fallback: 'Historical fallback',
  }[source] ?? 'Unknown'
}

export function sourceClasses(source) {
  return {
    routing_live: 'border-orange-500/40 bg-orange-500/10 text-orange-200',
    routing_cache: 'border-zinc-700 bg-zinc-900 text-zinc-200',
    historical_fallback: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  }[source] ?? 'border-zinc-700 bg-zinc-900 text-zinc-200'
}

export function prettyJson(value) {
  if (value == null) {
    return 'No payload yet.'
  }

  return JSON.stringify(value, null, 2)
}

export function slugifyRouteKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}
