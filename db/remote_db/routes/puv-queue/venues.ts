import type { QueueRouteConfig, QueueVenueCandidate } from './types';

const GOOGLE_PLACES_SEARCH_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';

type GooglePlacesResponse = {
  places?: Array<{
    id?: string;
    displayName?: {
      text?: string;
    };
    formattedAddress?: string;
    location?: {
      latitude?: number;
      longitude?: number;
    };
  }>;
};

type GooglePlace = NonNullable<GooglePlacesResponse['places']>[number];

const includedTypes = [
  'event_venue',
  'stadium',
  'concert_hall',
  'convention_center',
  'amphitheatre',
  'movie_theater',
  'community_center',
];

function makeSearchBody(route: QueueRouteConfig, key: 'origin' | 'destination', radiusMeters: number) {
  const coordinate = key === 'origin' ? route.origin : route.destination;
  return {
    includedTypes,
    maxResultCount: 10,
    rankPreference: 'DISTANCE',
    languageCode: 'en',
    regionCode: 'PH',
    locationRestriction: {
      circle: {
        center: {
          latitude: coordinate[1],
          longitude: coordinate[0],
        },
        radius: radiusMeters,
      },
    },
  };
}

function mapPlace(place: GooglePlace): QueueVenueCandidate | null {
  if (
    !place?.id ||
    !place.displayName?.text ||
    typeof place.location?.latitude !== 'number' ||
    typeof place.location?.longitude !== 'number'
  ) {
    return null;
  }

  return {
    id: place.id,
    label: place.displayName.text,
    address: place.formattedAddress ?? null,
    lat: place.location.latitude,
    lng: place.location.longitude,
    source: 'google_places',
  };
}

async function searchNearby(
  apiKey: string,
  route: QueueRouteConfig,
  key: 'origin' | 'destination',
  radiusMeters: number,
): Promise<QueueVenueCandidate[]> {
  const response = await fetch(GOOGLE_PLACES_SEARCH_NEARBY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify(makeSearchBody(route, key, radiusMeters)),
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json<GooglePlacesResponse>();
  return (payload.places ?? []).map(mapPlace).filter((candidate): candidate is QueueVenueCandidate => Boolean(candidate));
}

export async function discoverNearbyVenues(
  apiKey: string | undefined,
  route: QueueRouteConfig,
  radiusMeters = 2500,
): Promise<QueueVenueCandidate[]> {
  if (!apiKey) {
    return [];
  }

  const [originResults, destinationResults] = await Promise.all([
    searchNearby(apiKey, route, 'origin', radiusMeters),
    searchNearby(apiKey, route, 'destination', radiusMeters),
  ]);

  const unique = new Map<string, QueueVenueCandidate>();
  for (const candidate of [...originResults, ...destinationResults]) {
    unique.set(candidate.id, candidate);
  }

  return [...unique.values()].sort((left, right) => left.label.localeCompare(right.label));
}
