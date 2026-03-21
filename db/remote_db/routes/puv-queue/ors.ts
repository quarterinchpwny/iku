import { ORS_DIRECTIONS_URL, ORS_MATRIX_URL } from './constants';
import type { Coordinate, DegradedReason, OrsDirectionsResponse, OrsMatrixResponse, RoutePolyline } from './types';

function isCoordinatePair(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length >= 2
    && typeof value[0] === 'number'
    && Number.isFinite(value[0])
    && typeof value[1] === 'number'
    && Number.isFinite(value[1]);
}

export class OrsError extends Error {
  code: DegradedReason;

  constructor(code: DegradedReason, message: string) {
    super(message);
    this.code = code;
  }
}

export async function fetchLiveDuration(
  apiKey: string | undefined,
  origin: Coordinate,
  destination: Coordinate,
): Promise<number> {
  if (!apiKey) {
    throw new OrsError('missing_ors_api_key', 'Missing ORS API key');
  }

  const response = await fetch(ORS_MATRIX_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({
      locations: [origin, destination],
      metrics: ['duration'],
      units: 'km',
    }),
  });

  if (!response.ok) {
    throw new OrsError('ors_request_failed', `ORS matrix request failed with status ${response.status}`);
  }

  const data = await response.json<OrsMatrixResponse>();
  const duration = data.durations?.[0]?.[1];

  if (typeof duration !== 'number' || duration <= 0) {
    throw new OrsError('ors_invalid_response', 'ORS returned an invalid duration');
  }

  return duration;
}

export async function fetchRoutePolyline(
  apiKey: string | undefined,
  origin: Coordinate,
  destination: Coordinate,
): Promise<RoutePolyline | null> {
  if (!apiKey) {
    return null;
  }

  const response = await fetch(ORS_DIRECTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({
      coordinates: [origin, destination],
      format: 'geojson',
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json<OrsDirectionsResponse>();
  const coordinates = data.features?.[0]?.geometry?.coordinates;

  if (!Array.isArray(coordinates)) {
    return null;
  }

  const polyline = coordinates.filter(isCoordinatePair);
  return polyline.length > 0 ? polyline : null;
}
