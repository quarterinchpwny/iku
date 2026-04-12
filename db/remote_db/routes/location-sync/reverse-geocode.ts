const REVERSE_GEOCODE_URL = 'https://nominatim.openstreetmap.org/reverse';
const REVERSE_GEOCODE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_LOOKUPS_PER_REQUEST = 8;

type PlaceLabelLike = {
  id: number;
  centroid_lat: number;
  centroid_lng: number;
  name?: string | null;
  geocode_name?: string | null;
  geocode_updated_at?: number | null;
};

type ReverseGeocodeResponse = {
  name?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
};

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasUserName(row: PlaceLabelLike): boolean {
  return trimmed(row.name).length > 0;
}

function displayLabel(row: PlaceLabelLike): string {
  return trimmed(row.name) || trimmed(row.geocode_name);
}

function needsRefresh(row: PlaceLabelLike, now: number): boolean {
  if (hasUserName(row)) return false;
  const geocodeUpdatedAt = Number(row.geocode_updated_at || 0);
  if (!trimmed(row.geocode_name)) return true;
  if (!Number.isFinite(geocodeUpdatedAt) || geocodeUpdatedAt <= 0) return true;
  return now - geocodeUpdatedAt >= REVERSE_GEOCODE_TTL_MS;
}

function areaLabel(address: Record<string, string | undefined>): string {
  return trimmed(
    address.neighbourhood
    || address.suburb
    || address.city_district
    || address.city
    || address.town
    || address.village
    || address.municipality
  );
}

function buildLabel(payload: ReverseGeocodeResponse): string {
  const address = payload.address || {};
  const primary = trimmed(
    payload.name
    || address.amenity
    || address.shop
    || address.tourism
    || address.building
    || address.office
    || address.leisure
    || address.road
  );
  const area = areaLabel(address);
  if (primary && area && primary.toLowerCase() !== area.toLowerCase()) {
    return `${primary}, ${area}`;
  }
  if (primary) return primary;
  if (area) return area;
  const display = trimmed(payload.display_name);
  if (!display) return '';
  return display.split(',').slice(0, 2).join(',').trim();
}

async function fetchReverseGeocodeName(lat: number, lng: number): Promise<string> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lng),
    zoom: '18',
    addressdetails: '1'
  });
  const response = await fetch(`${REVERSE_GEOCODE_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'iku-route-sync/1.0'
    }
  });
  if (!response.ok) {
    throw new Error(`reverse geocode failed: ${response.status}`);
  }
  const payload = (await response.json()) as ReverseGeocodeResponse;
  return buildLabel(payload);
}

async function persistReverseGeocodeName(
  db: D1Database,
  row: PlaceLabelLike,
  geocodeName: string,
  now: number
): Promise<void> {
  await db
    .prepare(
      `UPDATE place_labels
       SET geocode_name = ?, geocode_provider = 'nominatim', geocode_updated_at = ?
       WHERE id = ?`
    )
    .bind(geocodeName, now, row.id)
    .run();
}

export async function hydrateReverseGeocodeNames(
  db: D1Database,
  rows: PlaceLabelLike[]
): Promise<Map<number, string>> {
  const now = Date.now();
  const labels = new Map<number, string>();

  for (const row of rows) {
    const label = displayLabel(row);
    if (label) labels.set(row.id, label);
  }

  const pending = rows
    .filter((row) => needsRefresh(row, now))
    .slice(0, MAX_LOOKUPS_PER_REQUEST);

  for (const row of pending) {
    try {
      const geocodeName = await fetchReverseGeocodeName(row.centroid_lat, row.centroid_lng);
      await persistReverseGeocodeName(db, row, geocodeName, now);
      if (geocodeName) labels.set(row.id, geocodeName);
    } catch {
      await persistReverseGeocodeName(db, row, trimmed(row.geocode_name), now);
    }
  }

  return labels;
}
