import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { ActivityRecognition } from '@/src/plugins/activityRecognition';
import { buildPlaceRecordsFromSegments, normalizePlaceRecords, normalizeTimelineSegments, type PlaceRecord, type TimelineSegment } from '~/lib/places';

type Snapshot = {
  segments: TimelineSegment[];
  places: PlaceRecord[];
};

async function getAuthHeader(): Promise<string> {
  if (!import.meta.client) return '';
  try {
    const { value } = await Preferences.get({ key: 'auth_token' });
    if (value) return `Bearer ${String(value).trim()}`;
  } catch {
  }
  const accountKey = String(localStorage.getItem('auth_account_key') || '').trim();
  return accountKey ? `Bearer ${accountKey}` : '';
}

function hasNativePlaces(): boolean {
  return import.meta.client
    && Capacitor.isNativePlatform()
    && Capacitor.isPluginAvailable('qipz-activity');
}

export function usePlaceDataSource() {
  const config = useRuntimeConfig();

  async function loadLocalSnapshot(fromMs: number, toMs: number, limit = 200): Promise<Snapshot> {
    if (!hasNativePlaces()) return { segments: [], places: [] };
    const [timelineResult, visitsResult] = await Promise.allSettled([
      ActivityRecognition.getTimeline({ fromMs, toMs, limit }),
      ActivityRecognition.getPlaceVisits({ fromMs, toMs, limit: Math.min(limit, 200) })
    ]);
    const segments = timelineResult.status === 'fulfilled'
      ? normalizeTimelineSegments(timelineResult.value?.segments || [], 'plugin')
      : [];
    const places = visitsResult.status === 'fulfilled'
      ? buildPlaceRecordsFromSegments(
          normalizeTimelineSegments(
            (visitsResult.value?.visits || []).map((visit: any) => ({
              ...visit,
              segmentType: 'place',
              startMs: visit?.arrivalMs
            })),
            'plugin'
          )
        )
      : buildPlaceRecordsFromSegments(segments);
    return { segments, places };
  }

  async function loadRemoteSnapshot(fromMs: number, toMs: number, limit = 200): Promise<Snapshot> {
    const authHeader = await getAuthHeader();
    if (!authHeader) return { segments: [], places: [] };
    const timelineParams = new URLSearchParams({
      fromMs: String(fromMs),
      toMs: String(toMs),
      limit: String(limit)
    });
    const placesParams = new URLSearchParams({ limit: '100' });
    const [timelineResponse, placesResponse] = await Promise.all([
      fetch(`${config.public.cfURL}/api/location/timeline?${timelineParams.toString()}`, {
        headers: { Authorization: authHeader }
      }),
      fetch(`${config.public.cfURL}/api/location/places?${placesParams.toString()}`, {
        headers: { Authorization: authHeader }
      })
    ]);
    if (!timelineResponse.ok) throw new Error(await timelineResponse.text());
    if (!placesResponse.ok) throw new Error(await placesResponse.text());
    const [timelineData, placesData] = await Promise.all([
      timelineResponse.json(),
      placesResponse.json()
    ]);
    return {
      segments: normalizeTimelineSegments(timelineData?.segments || [], 'cloud'),
      places: normalizePlaceRecords(placesData?.places || [], 'cloud')
    };
  }

  async function renamePlace(place: PlaceRecord, name: string): Promise<void> {
    const trimmedName = String(name || '').trim();
    if (!trimmedName) throw new Error('Name is required');
    if (!place.canRename || !place.id) throw new Error('This place cannot be renamed yet');
    if (place.source === 'plugin') {
      if (!hasNativePlaces()) throw new Error('Native place labels are unavailable');
      await ActivityRecognition.setPlaceLabel({ labelId: place.id, name: trimmedName });
      return;
    }
    const authHeader = await getAuthHeader();
    if (!authHeader) throw new Error('Missing auth');
    const response = await fetch(`${config.public.cfURL}/api/location/places/${place.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader
      },
      body: JSON.stringify({ name: trimmedName })
    });
    if (!response.ok) throw new Error(await response.text());
  }

  return {
    loadLocalSnapshot,
    loadRemoteSnapshot,
    renamePlace
  };
}
