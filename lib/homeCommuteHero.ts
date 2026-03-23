export type QueueRouteSummary = {
  destination: [number, number];
  is_default: boolean;
  label: string;
  origin: [number, number];
  route_key: string;
  timezone: string;
};

export type QueueRecommendation = {
  best_option?: 'either' | 'ride' | 'unavailable' | 'walk';
  message?: string;
  ride_in_vehicle_minutes?: number | null;
  ride_wait_minutes?: number | null;
  ride_total_minutes?: number | null;
  walk_total_minutes?: number | null;
};

export type QueueEstimate = {
  computed_at?: string;
  message?: {
    action?: string;
    headline?: string;
  };
  meta?: {
    degraded?: boolean;
  };
  polyline?: [number, number][] | null;
  recommendation?: QueueRecommendation;
  route?: QueueRouteSummary;
  wait_minutes_estimate?: {
    min_minutes?: number;
    likely_minutes?: number;
    max_minutes?: number;
  };
  signals?: {
    traffic?: {
      duration_seconds?: number;
      label?: string;
      ratio?: number;
      source?: string;
    };
  };
  walking_polyline?: [number, number][] | null;
};

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export async function parseResponse(response: Response): Promise<any> {
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

export function resolveErrorMessage(response: Response, payload: any, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }

  return response.statusText || fallback;
}

export function formatTravelMinutes(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }

  return `${Math.max(1, Math.round(value))} min`;
}

export function formatWaitRange(waitEstimate: QueueEstimate['wait_minutes_estimate'] | null | undefined): string {
  const min = Number(waitEstimate?.min_minutes);
  const max = Number(waitEstimate?.max_minutes);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return '--';
  }

  return `${Math.max(0, Math.round(min))}-${Math.max(0, Math.round(max))} min`;
}

export function formatTrafficRatio(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }

  return `${Math.round(value * 100) / 100}x`;
}

export function formatEta(minutes: number | null | undefined): string {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) {
    return '--';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(Date.now() + minutes * 60_000));
}

export function coordinateToPoint(coordinate: [number, number] | null | undefined) {
  const lat = Number(coordinate?.[1]);
  const lng = Number(coordinate?.[0]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

export function polylineToPoints(polyline: [number, number][] | null | undefined) {
  if (!Array.isArray(polyline)) {
    return [];
  }

  return polyline
    .map((coordinate) => coordinateToPoint(coordinate))
    .filter((point): point is { lat: number; lng: number } => point !== null);
}

export function routeSummaryParts(label: string | undefined) {
  const raw = String(label || '').trim();
  if (!raw) {
    return {
      destinationLabel: 'Destination',
      originLabel: 'Saved route',
      title: 'Dynamic Commute',
    };
  }

  const parts = raw.split('->').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      destinationLabel: parts[parts.length - 1],
      originLabel: parts[0],
      title: raw,
    };
  }

  return {
    destinationLabel: raw,
    originLabel: 'Saved route',
    title: raw,
  };
}

export function fallbackMinutesFromTraffic(durationSeconds: number | undefined) {
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds)) {
    return null;
  }

  return Math.max(1, Math.round(durationSeconds / 60));
}
