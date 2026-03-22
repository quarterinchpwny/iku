export function formatQueueDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return 'Unavailable';
  }

  if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function formatQueueMinutes(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Unavailable';
  }

  return `${Math.round(value)} min`;
}

export function formatQueueRange(waitEstimate: { min_minutes: number; max_minutes: number } | null | undefined): string {
  if (!waitEstimate) {
    return 'Unavailable';
  }

  return `${waitEstimate.min_minutes}-${waitEstimate.max_minutes} min`;
}

export function formatQueueCoordinate(coordinate: [number, number] | null | undefined): string {
  if (!Array.isArray(coordinate) || coordinate.length !== 2) {
    return 'Unavailable';
  }

  const [lng, lat] = coordinate;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return 'Unavailable';
  }

  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function formatQueueTimestamp(value: string | null | undefined): string {
  if (!value) {
    return 'Not updated yet';
  }

  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function levelBadgeClass(level: string | null | undefined): string {
  return {
    low: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    moderate: 'border-amber-300 bg-amber-50 text-amber-800',
    high: 'border-orange-300 bg-orange-50 text-orange-800',
    very_high: 'border-rose-300 bg-rose-50 text-rose-800',
  }[level || ''] ?? 'border-zinc-300 bg-white text-zinc-700';
}

export function sourceBadgeClass(source: string | null | undefined): string {
  return {
    ors_live: 'border-sky-300 bg-sky-50 text-sky-800',
    ors_cache: 'border-violet-300 bg-violet-50 text-violet-800',
    historical_fallback: 'border-zinc-300 bg-zinc-100 text-zinc-700',
  }[source || ''] ?? 'border-zinc-300 bg-zinc-100 text-zinc-700';
}

export function sourceLabel(source: string | null | undefined): string {
  return {
    ors_live: 'Live traffic',
    ors_cache: 'Cached traffic',
    historical_fallback: 'Historical fallback',
  }[source || ''] ?? 'Unknown source';
}

export function recommendationTitle(option: string | null | undefined): string {
  return {
    walk: 'Walk instead',
    ride: 'Ride the route',
    either: 'Either option works',
    unavailable: 'Comparison unavailable',
  }[option || ''] ?? 'Recommendation unavailable';
}
