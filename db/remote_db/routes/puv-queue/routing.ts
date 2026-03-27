import { ORS_DIRECTIONS_URL, ORS_MATRIX_URL, ORS_WALKING_DIRECTIONS_URL, ORS_WALKING_MATRIX_URL } from './constants';
import type {
  Coordinate,
  DegradedReason,
  OrsDirectionsResponse,
  OrsMatrixResponse,
  OsrmRouteResponse,
  OsrmTableResponse,
  PuvQueueEnv,
  RoutePolyline,
} from './types';

type RoutingBindings = Pick<PuvQueueEnv['Bindings'], 'ORS_API_KEY' | 'OSRM_BASE_URL' | 'ROUTING_PROVIDER'>;

type ResolvedRoutingConfig =
  | {
      provider: 'ors';
      apiKey: string;
    }
  | {
      provider: 'osrm';
      baseUrl: string;
    };

function isCoordinatePair(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length >= 2
    && typeof value[0] === 'number'
    && Number.isFinite(value[0])
    && typeof value[1] === 'number'
    && Number.isFinite(value[1]);
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function serializeCoordinates(origin: Coordinate, destination: Coordinate): string {
  return `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
}

export class RoutingError extends Error {
  code: DegradedReason;

  constructor(code: DegradedReason, message: string) {
    super(message);
    this.code = code;
  }
}

function resolveRoutingConfig(bindings: RoutingBindings): ResolvedRoutingConfig {
  const provider = bindings.ROUTING_PROVIDER;

  if (provider === 'ors') {
    if (!bindings.ORS_API_KEY) {
      throw new RoutingError('missing_routing_config', 'Missing ORS_API_KEY');
    }

    return {
      provider,
      apiKey: bindings.ORS_API_KEY,
    };
  }

  if (provider === 'osrm') {
    if (!bindings.OSRM_BASE_URL) {
      throw new RoutingError('missing_routing_config', 'Missing OSRM_BASE_URL');
    }

    return {
      provider,
      baseUrl: normalizeBaseUrl(bindings.OSRM_BASE_URL),
    };
  }

  if (bindings.OSRM_BASE_URL && !bindings.ORS_API_KEY) {
    return {
      provider: 'osrm',
      baseUrl: normalizeBaseUrl(bindings.OSRM_BASE_URL),
    };
  }

  if (bindings.ORS_API_KEY && !bindings.OSRM_BASE_URL) {
    return {
      provider: 'ors',
      apiKey: bindings.ORS_API_KEY,
    };
  }

  throw new RoutingError(
    'missing_routing_config',
    'Set ROUTING_PROVIDER to "osrm" or "ors" and provide the matching credentials',
  );
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return await response.json<T>();
  } catch {
    return null;
  }
}

async function fetchOrsDirectionsResponse(
  apiKey: string,
  origin: Coordinate,
  destination: Coordinate,
  url: string,
): Promise<OrsDirectionsResponse> {
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
    throw new RoutingError('routing_request_failed', `ORS directions request failed with status ${response.status}`);
  }

  return response.json<OrsDirectionsResponse>();
}

async function fetchOrsDirectionsDuration(
  apiKey: string,
  origin: Coordinate,
  destination: Coordinate,
  url: string,
): Promise<number> {
  const data = await fetchOrsDirectionsResponse(apiKey, origin, destination, url);
  const duration = data.features?.[0]?.properties?.summary?.duration;

  if (typeof duration !== 'number' || duration <= 0) {
    throw new RoutingError('routing_invalid_response', 'ORS returned an invalid directions duration');
  }

  return duration;
}

async function fetchOrsMatrixDuration(
  apiKey: string,
  origin: Coordinate,
  destination: Coordinate,
  url: string,
  directionsUrl: string,
): Promise<number> {
  try {
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
      throw new RoutingError('routing_request_failed', `ORS matrix request failed with status ${response.status}`);
    }

    const data = await response.json<OrsMatrixResponse>();
    const duration = data.durations?.[0]?.[1];

    if (typeof duration !== 'number' || duration <= 0) {
      throw new RoutingError('routing_invalid_response', 'ORS returned an invalid duration');
    }

    return duration;
  } catch (error) {
    if (!(error instanceof RoutingError)) {
      throw error;
    }

    return fetchOrsDirectionsDuration(apiKey, origin, destination, directionsUrl);
  }
}

async function fetchOrsPolyline(
  apiKey: string,
  origin: Coordinate,
  destination: Coordinate,
  url: string,
): Promise<RoutePolyline | null> {
  let data: OrsDirectionsResponse;

  try {
    data = await fetchOrsDirectionsResponse(apiKey, origin, destination, url);
  } catch {
    return null;
  }

  const coordinates = data.features?.[0]?.geometry?.coordinates;

  if (!Array.isArray(coordinates)) {
    return null;
  }

  const polyline = coordinates.filter(isCoordinatePair);
  return polyline.length > 0 ? polyline : null;
}

async function fetchOsrmRouteResponse(
  baseUrl: string,
  profile: 'driving' | 'foot',
  origin: Coordinate,
  destination: Coordinate,
  overview: 'false' | 'full',
): Promise<OsrmRouteResponse> {
  const url = new URL(`${baseUrl}/route/v1/${profile}/${serializeCoordinates(origin, destination)}`);
  url.searchParams.set('alternatives', 'false');
  url.searchParams.set('overview', overview);
  url.searchParams.set('steps', 'false');

  if (overview !== 'false') {
    url.searchParams.set('geometries', 'geojson');
  }

  const response = await fetch(url.toString());
  const data = await readJson<OsrmRouteResponse>(response);

  if (!response.ok) {
    const code = typeof data?.code === 'string' ? data.code : `HTTP_${response.status}`;
    throw new RoutingError('routing_request_failed', `OSRM route request failed with ${code}`);
  }

  if (data?.code !== 'Ok') {
    throw new RoutingError('routing_request_failed', `OSRM route responded with ${data?.code ?? 'UNKNOWN'}`);
  }

  return data;
}

async function fetchOsrmRouteDuration(
  baseUrl: string,
  profile: 'driving' | 'foot',
  origin: Coordinate,
  destination: Coordinate,
): Promise<number> {
  const data = await fetchOsrmRouteResponse(baseUrl, profile, origin, destination, 'false');
  const duration = data.routes?.[0]?.duration;

  if (typeof duration !== 'number' || duration <= 0) {
    throw new RoutingError('routing_invalid_response', 'OSRM returned an invalid route duration');
  }

  return duration;
}

async function fetchOsrmTableDuration(
  baseUrl: string,
  profile: 'driving' | 'foot',
  origin: Coordinate,
  destination: Coordinate,
): Promise<number> {
  try {
    const url = new URL(`${baseUrl}/table/v1/${profile}/${serializeCoordinates(origin, destination)}`);
    url.searchParams.set('annotations', 'duration');
    url.searchParams.set('sources', '0');
    url.searchParams.set('destinations', '1');

    const response = await fetch(url.toString());
    const data = await readJson<OsrmTableResponse>(response);

    if (!response.ok) {
      const code = typeof data?.code === 'string' ? data.code : `HTTP_${response.status}`;
      throw new RoutingError('routing_request_failed', `OSRM table request failed with ${code}`);
    }

    if (data?.code !== 'Ok') {
      throw new RoutingError('routing_request_failed', `OSRM table responded with ${data?.code ?? 'UNKNOWN'}`);
    }

    const duration = data.durations?.[0]?.[0];

    if (typeof duration !== 'number' || duration <= 0) {
      throw new RoutingError('routing_invalid_response', 'OSRM returned an invalid table duration');
    }

    return duration;
  } catch (error) {
    if (!(error instanceof RoutingError)) {
      throw error;
    }

    return fetchOsrmRouteDuration(baseUrl, profile, origin, destination);
  }
}

async function fetchOsrmPolyline(
  baseUrl: string,
  profile: 'driving' | 'foot',
  origin: Coordinate,
  destination: Coordinate,
): Promise<RoutePolyline | null> {
  let data: OsrmRouteResponse;

  try {
    data = await fetchOsrmRouteResponse(baseUrl, profile, origin, destination, 'full');
  } catch {
    return null;
  }

  const coordinates = data.routes?.[0]?.geometry?.coordinates;

  if (!Array.isArray(coordinates)) {
    return null;
  }

  const polyline = coordinates.filter(isCoordinatePair);
  return polyline.length > 0 ? polyline : null;
}

export async function fetchLiveDuration(
  bindings: RoutingBindings,
  origin: Coordinate,
  destination: Coordinate,
): Promise<number> {
  const routing = resolveRoutingConfig(bindings);

  if (routing.provider === 'osrm') {
    return fetchOsrmTableDuration(routing.baseUrl, 'driving', origin, destination);
  }

  return fetchOrsMatrixDuration(routing.apiKey, origin, destination, ORS_MATRIX_URL, ORS_DIRECTIONS_URL);
}

export async function fetchWalkingDuration(
  bindings: RoutingBindings,
  origin: Coordinate,
  destination: Coordinate,
): Promise<number> {
  const routing = resolveRoutingConfig(bindings);

  if (routing.provider === 'osrm') {
    return fetchOsrmTableDuration(routing.baseUrl, 'foot', origin, destination);
  }

  return fetchOrsMatrixDuration(routing.apiKey, origin, destination, ORS_WALKING_MATRIX_URL, ORS_WALKING_DIRECTIONS_URL);
}

export async function fetchRoutePolyline(
  bindings: RoutingBindings,
  origin: Coordinate,
  destination: Coordinate,
): Promise<RoutePolyline | null> {
  const routing = resolveRoutingConfig(bindings);

  if (routing.provider === 'osrm') {
    return fetchOsrmPolyline(routing.baseUrl, 'driving', origin, destination);
  }

  return fetchOrsPolyline(routing.apiKey, origin, destination, ORS_DIRECTIONS_URL);
}

export async function fetchWalkingPolyline(
  bindings: RoutingBindings,
  origin: Coordinate,
  destination: Coordinate,
): Promise<RoutePolyline | null> {
  const routing = resolveRoutingConfig(bindings);

  if (routing.provider === 'osrm') {
    return fetchOsrmPolyline(routing.baseUrl, 'foot', origin, destination);
  }

  return fetchOrsPolyline(routing.apiKey, origin, destination, ORS_WALKING_DIRECTIONS_URL);
}
