export function formatQueueDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return 'Unavailable';
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function formatQueueMinutes(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable';
  return `${Math.round(value)} min`;
}

export function formatQueueRange(waitEstimate: { min_minutes: number; max_minutes: number } | null | undefined): string {
  if (!waitEstimate) return 'Unavailable';
  return `${waitEstimate.min_minutes}-${waitEstimate.max_minutes} min`;
}

export function formatQueueCoordinate(coordinate: [number, number] | null | undefined): string {
  if (!Array.isArray(coordinate) || coordinate.length !== 2) return 'Unavailable';
  const [lng, lat] = coordinate;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'Unavailable';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function coordinateToQueuePoint(coordinate: [number, number] | null | undefined) {
  const lat = Number(coordinate?.[1]);
  const lng = Number(coordinate?.[0]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function polylineToQueuePoints(polyline: [number, number][] | null | undefined) {
  if (!Array.isArray(polyline)) return [];
  return polyline
    .map((coordinate) => coordinateToQueuePoint(coordinate))
    .filter((point): point is { lat: number; lng: number } => point !== null);
}

export function formatQueueTimestamp(value: string | null | undefined): string {
  if (!value) return 'Not updated yet';
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

export function levelBadgeClassDark(level: string | null | undefined): string {
  return {
    low: 'border-green-800 bg-green-950 text-green-400',
    moderate: 'border-amber-800 bg-amber-950 text-amber-400',
    high: 'border-orange-800 bg-orange-950 text-orange-400',
    very_high: 'border-rose-800 bg-rose-950 text-rose-400',
  }[level || ''] ?? 'border-zinc-700 bg-zinc-900 text-zinc-400';
}

export function sourceBadgeClassDark(source: string | null | undefined): string {
  return {
    ors_live: 'border-sky-800 bg-sky-950 text-sky-400',
    ors_cache: 'border-violet-800 bg-violet-950 text-violet-400',
    historical_fallback: 'border-zinc-700 bg-zinc-900 text-zinc-400',
  }[source || ''] ?? 'border-zinc-700 bg-zinc-900 text-zinc-400';
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

export type QueueContextBadge = {
  label: string;
  tone: 'rain' | 'incident' | 'observation_hot' | 'observation_cool' | 'calendar';
};

function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function buildQueueContextBadges(estimate: Record<string, any> | null | undefined): QueueContextBadge[] {
  if (!estimate?.signals) {
    return [];
  }

  const badges: QueueContextBadge[] = [];
  const weather = estimate.signals.weather;
  const incidents = estimate.signals.incidents;
  const observations = estimate.signals.observations;
  const calendar = estimate.signals.calendar;

  if (weather?.severity === 'heavy_rain') {
    badges.push({ label: 'Heavy rain', tone: 'rain' });
  } else if (weather?.severity === 'moderate_rain') {
    badges.push({ label: 'Wet weather', tone: 'rain' });
  } else if (weather?.severity === 'light_rain') {
    badges.push({ label: 'Light rain', tone: 'rain' });
  }

  if (Array.isArray(incidents?.active) && incidents.active.length > 0) {
    if (incidents.active.length === 1) {
      const category = incidents.active[0]?.category === 'traffic_advisory' ? 'Traffic advisory' : 'Event pressure';
      badges.push({ label: category, tone: 'incident' });
    } else {
      badges.push({ label: `${incidents.active.length} live incidents`, tone: 'incident' });
    }
  }

  const observationDelta = safeNumber(observations?.score_delta);
  const observationSamples = safeNumber(observations?.sample_count) ?? 0;
  if (observationSamples >= 3 && observationDelta !== null) {
    if (observationDelta >= 0.4) {
      badges.push({ label: 'Running hotter', tone: 'observation_hot' });
    } else if (observationDelta <= -0.4) {
      badges.push({ label: 'Running lighter', tone: 'observation_cool' });
    }
  }

  if (calendar?.is_holiday && badges.length < 2) {
    badges.push({ label: 'Holiday pattern', tone: 'calendar' });
  }

  return badges.slice(0, 3);
}

export function queueContextBadgeClass(tone: QueueContextBadge['tone']): string {
  return {
    rain: 'border-sky-800 bg-sky-950 text-sky-300',
    incident: 'border-fuchsia-800 bg-fuchsia-950 text-fuchsia-300',
    observation_hot: 'border-amber-800 bg-amber-950 text-amber-300',
    observation_cool: 'border-emerald-800 bg-emerald-950 text-emerald-300',
    calendar: 'border-zinc-700 bg-zinc-900 text-zinc-300',
  }[tone];
}

export function buildQueueContextSummary(estimate: Record<string, any> | null | undefined): string | null {
  if (!estimate?.signals) {
    return null;
  }

  const weather = estimate.signals.weather;
  const incidents = estimate.signals.incidents;
  const observations = estimate.signals.observations;
  const calendar = estimate.signals.calendar;
  const activeIncidents = Array.isArray(incidents?.active) ? incidents.active : [];
  const observationDelta = safeNumber(observations?.score_delta);
  const observationSamples = safeNumber(observations?.sample_count) ?? 0;

  if (weather?.severity === 'heavy_rain') {
    return 'Rain is suppressing walking and pushing more riders into the queue than a normal slot.';
  }

  if (weather?.severity === 'moderate_rain') {
    return 'Wet weather is lifting boarding demand on top of the usual traffic pattern.';
  }

  if (activeIncidents.length > 0) {
    if (activeIncidents.length === 1 && typeof activeIncidents[0]?.title === 'string' && activeIncidents[0].title.trim()) {
      return `${activeIncidents[0].title} is adding extra pressure near the route right now.`;
    }
    return 'Multiple live route-side pressures are stacking on top of the normal corridor pattern.';
  }

  if (observationSamples >= 3 && observationDelta !== null) {
    if (observationDelta >= 0.4) {
      return 'Recent ground observations say this time slot is running hotter than the static baseline.';
    }
    if (observationDelta <= -0.4) {
      return 'Recent ground observations say this time slot is moving lighter than the static baseline.';
    }
  }

  if (calendar?.is_holiday) {
    return calendar.holiday_name
      ? `${calendar.holiday_name} is shifting the usual workday demand pattern.`
      : 'The holiday calendar is shifting the usual demand pattern today.';
  }

  return null;
}
