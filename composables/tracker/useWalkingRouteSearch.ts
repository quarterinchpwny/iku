import { ref } from 'vue';

interface GeocodePoint {
  lat: number;
  lng: number;
  label: string;
}

interface WalkingRouteResult {
  path: Array<[number, number]>;
  summaryText: string;
  originLabel: string;
  destinationLabel: string;
}

function formatDistanceKm(distanceMeters: number): string {
  return `${(distanceMeters / 1000).toFixed(2)} km`;
}

function formatDurationMinutes(durationSeconds: number): string {
  return `${Math.round(durationSeconds / 60)} min`;
}

export function useWalkingRouteSearch() {
  const config = useRuntimeConfig();
  const isSearchingRoute = ref(false);
  const routeError = ref('');
  const routeSummary = ref('');

  function getApiKey(): string {
    const key = String(config.public.orsKey || '').trim();
    if (!key) throw new Error('Missing ORS key in runtimeConfig.public.orsKey');
    return key;
  }

  async function geocodePlace(query: string): Promise<GeocodePoint> {
    const apiKey = getApiKey();
    const url = `https://api.openrouteservice.org/geocode/search?api_key=${encodeURIComponent(apiKey)}&text=${encodeURIComponent(query)}&size=1`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Geocode failed (${response.status})`);
    const payload = await response.json();
    const feature = payload?.features?.[0];
    if (!feature?.geometry?.coordinates) throw new Error(`No location found for "${query}"`);
    const [lng, lat] = feature.geometry.coordinates;
    return {
      lat,
      lng,
      label: String(feature?.properties?.label || query),
    };
  }

  async function findWalkingRoute(from: string, to: string): Promise<WalkingRouteResult> {
    const startText = from.trim();
    const endText = to.trim();
    if (!startText || !endText) throw new Error('Origin and destination are required');

    isSearchingRoute.value = true;
    routeError.value = '';

    try {
      const apiKey = getApiKey();
      const [origin, destination] = await Promise.all([geocodePlace(startText), geocodePlace(endText)]);
      const response = await fetch('https://api.openrouteservice.org/v2/directions/foot-walking/geojson', {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coordinates: [[origin.lng, origin.lat], [destination.lng, destination.lat]] }),
      });
      if (!response.ok) throw new Error(`Directions failed (${response.status})`);
      const payload = await response.json();
      const feature = payload?.features?.[0];
      const coordinates = feature?.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) throw new Error('No walk route found');

      const path = coordinates.map((pair: [number, number]) => [pair[1], pair[0]] as [number, number]);
      const summary = feature?.properties?.summary || {};
      const distanceMeters = Number(summary?.distance || 0);
      const durationSeconds = Number(summary?.duration || 0);
      routeSummary.value = `${formatDistanceKm(distanceMeters)} · ${formatDurationMinutes(durationSeconds)} walking`;

      return {
        path,
        summaryText: routeSummary.value,
        originLabel: origin.label,
        destinationLabel: destination.label,
      };
    } catch (error: any) {
      routeError.value = String(error?.message || 'Walking route search failed');
      throw error;
    } finally {
      isSearchingRoute.value = false;
    }
  }

  function clearRouteFeedback() {
    routeError.value = '';
    routeSummary.value = '';
  }

  return {
    isSearchingRoute,
    routeError,
    routeSummary,
    findWalkingRoute,
    clearRouteFeedback,
  };
}
