import { ORS_DIRECTIONS_URL, ORS_MATRIX_URL, ORS_WALKING_DIRECTIONS_URL, ORS_WALKING_MATRIX_URL } from './constants';
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

async function fetchMatrixDuration(
  apiKey: string | undefined,
  origin: Coordinate,
  destination: Coordinate,
  url: string,
): Promise<number> {
  if (!apiKey) {
    throw new OrsError('missing_ors_api_key', 'Missing ORS API key');
  }

  const response = await fetch(url, {
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

export async function fetchLiveDuration(
  apiKey: string | undefined,
  origin: Coordinate,
  destination: Coordinate,
): Promise<number> {
  return fetchMatrixDuration(apiKey, origin, destination, ORS_MATRIX_URL);
}

export async function fetchWalkingDuration(
  apiKey: string | undefined,
  origin: Coordinate,
  destination: Coordinate,
): Promise<number> {
  return fetchMatrixDuration(apiKey, origin, destination, ORS_WALKING_MATRIX_URL);
}

async function fetchDirectionsPolyline(
  apiKey: string | undefined,
  origin: Coordinate,
  destination: Coordinate,
  url: string,
): Promise<RoutePolyline | null> {
  if (!apiKey) {
    return null;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({
      coordinates: [origin, destination],
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

export async function fetchRoutePolyline(
  apiKey: string | undefined,
  origin: Coordinate,
  destination: Coordinate,
): Promise<RoutePolyline | null> {
  return fetchDirectionsPolyline(apiKey, origin, destination, ORS_DIRECTIONS_URL);
}

export async function fetchWalkingPolyline(
  apiKey: string | undefined,
  origin: Coordinate,
  destination: Coordinate,
): Promise<RoutePolyline | null> {
  return fetchDirectionsPolyline(apiKey, origin, destination, ORS_WALKING_DIRECTIONS_URL);
}
