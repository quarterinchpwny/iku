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
    low: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
    moderate: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
    high: 'border-orange-400/40 bg-orange-500/10 text-orange-200',
    very_high: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
  }[level] ?? 'border-slate-600 bg-slate-800 text-slate-200'
}

export function sourceLabel(source) {
  return {
    ors_live: 'Live ORS',
    ors_cache: 'Cached ORS',
    historical_fallback: 'Historical fallback',
  }[source] ?? 'Unknown'
}

export function sourceClasses(source) {
  return {
    ors_live: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200',
    ors_cache: 'border-violet-400/40 bg-violet-500/10 text-violet-200',
    historical_fallback: 'border-slate-600 bg-slate-800 text-slate-200',
  }[source] ?? 'border-slate-600 bg-slate-800 text-slate-200'
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
