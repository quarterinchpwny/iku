import { formatDurationLabel, prettyTime } from '~/lib/timeline';

export type SegmentSource = 'plugin' | 'cloud';

export type PlaceTimelineSegment = {
  segmentType: 'place';
  key: string;
  source: SegmentSource;
  startMs: number;
  arrivalMs: number;
  departureMs: number | null;
  durationMs: number;
  lat: number;
  lng: number;
  fixCount: number;
  labelId: number | null;
  labelName: string;
  autoLabel: string;
  visitCount: number;
};

export type TripTimelineSegment = {
  segmentType: 'trip';
  key: string;
  source: SegmentSource;
  startMs: number;
  endMs: number | null;
  durationMs: number;
  routeId: number | null;
  distanceMeters: number;
  pointCount: number;
  status: string;
  dominantMode: string;
  waypoints: Array<{ lat: number; lng: number }>;
};

export type TimelineSegment = PlaceTimelineSegment | TripTimelineSegment;

export type PlaceRecord = {
  key: string;
  source: SegmentSource;
  id: number | null;
  labelName: string;
  autoLabel: string;
  visitCount: number;
  firstSeenMs: number;
  lastSeenMs: number;
  lat: number;
  lng: number;
  totalDurationMs: number;
  canRename: boolean;
};

export type TimelineDay = {
  dayKey: string;
  label: string;
  segments: TimelineSegment[];
  segmentCount: number;
  placeCount: number;
  tripCount: number;
  summary: string;
};

function safeNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizedAutoLabel(value: unknown): string {
  const label = String(value || '').trim().toLowerCase();
  return label || 'new';
}

export function formatPlaceName(labelName: string, autoLabel = 'new'): string {
  const trimmed = String(labelName || '').trim();
  if (trimmed) return trimmed;
  if (normalizedAutoLabel(autoLabel) === 'frequent') return 'Frequent place';
  return 'Recent stop';
}

function placeKey(source: SegmentSource, labelId: number | null, lat: number, lng: number): string {
  if (labelId) return `${source}:label:${labelId}`;
  return `${source}:coord:${lat.toFixed(4)}:${lng.toFixed(4)}`;
}

function segmentDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function tripModeLabel(mode: string): string {
  const normalized = String(mode || '').trim().toUpperCase();
  if (normalized === 'WALKING') return 'Walk';
  if (normalized === 'RUNNING') return 'Run';
  if (normalized === 'DRIVING') return 'Drive';
  if (normalized === 'CYCLING') return 'Ride';
  return 'Trip';
}

export function normalizeTimelineSegments(rawSegments: unknown[], source: SegmentSource): TimelineSegment[] {
  const safeSegments = Array.isArray(rawSegments) ? rawSegments : [];
  return safeSegments
    .map((row: any, index: number) => {
      if (String(row?.segmentType) === 'place') {
        const arrivalMs = safeNumber(row?.arrivalMs ?? row?.startMs);
        const departureMs = row?.departureMs == null ? null : safeNumber(row.departureMs);
        const lat = safeNumber(row?.lat, NaN);
        const lng = safeNumber(row?.lng, NaN);
        const labelId = Number.isFinite(Number(row?.labelId)) ? Number(row.labelId) : null;
        return {
          segmentType: 'place',
          key: `${placeKey(source, labelId, lat, lng)}:visit:${arrivalMs}:${index}`,
          source,
          startMs: arrivalMs,
          arrivalMs,
          departureMs,
          durationMs: Math.max(0, safeNumber(row?.durationMs, departureMs ? departureMs - arrivalMs : 0)),
          lat,
          lng,
          fixCount: Math.max(0, safeNumber(row?.fixCount)),
          labelId,
          labelName: String(row?.labelName || '').trim(),
          autoLabel: normalizedAutoLabel(row?.autoLabel),
          visitCount: Math.max(0, safeNumber(row?.visitCount))
        } satisfies PlaceTimelineSegment;
      }

      const startMs = safeNumber(row?.startMs);
      const endMs = row?.endMs == null ? null : safeNumber(row.endMs);
      const rawWaypoints = Array.isArray(row?.waypoints) ? row.waypoints : [];
      return {
        segmentType: 'trip',
        key: `${source}:trip:${safeNumber(row?.id ?? row?.routeId, index)}:${startMs}:${index}`,
        source,
        startMs,
        endMs,
        durationMs: Math.max(0, safeNumber(row?.durationMs, endMs ? endMs - startMs : 0)),
        routeId: Number.isFinite(Number(row?.routeId ?? row?.id)) ? Number(row?.routeId ?? row?.id) : null,
        distanceMeters: Math.max(0, safeNumber(row?.distanceMeters ?? row?.distanceM)),
        pointCount: Math.max(0, safeNumber(row?.pointCount, rawWaypoints.length)),
        status: String(row?.status || '').trim(),
        dominantMode: tripModeLabel(String(row?.dominantMode || '')),
        waypoints: rawWaypoints
          .map((point: any) => ({
            lat: safeNumber(Array.isArray(point) ? point[0] : point?.lat, NaN),
            lng: safeNumber(Array.isArray(point) ? point[1] : point?.lng, NaN)
          }))
          .filter((point: { lat: number; lng: number }) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
      } satisfies TripTimelineSegment;
    })
    .filter((segment: TimelineSegment) => {
      if (!Number.isFinite(segment.startMs) || segment.startMs <= 0) return false;
      if (segment.segmentType === 'place') {
        return Number.isFinite(segment.lat) && Number.isFinite(segment.lng);
      }
      return true;
    })
    .sort((a, b) => a.startMs - b.startMs);
}

export function buildPlaceRecordsFromSegments(segments: TimelineSegment[]): PlaceRecord[] {
  const groups = new Map<string, PlaceRecord>();
  for (const segment of segments) {
    if (segment.segmentType !== 'place') continue;
    const key = placeKey(segment.source, segment.labelId, segment.lat, segment.lng);
    const existing = groups.get(key);
    const nextVisitCount = segment.labelId ? segment.visitCount : (existing?.visitCount || 0) + 1;
    if (!existing) {
      groups.set(key, {
        key,
        source: segment.source,
        id: segment.labelId,
        labelName: formatPlaceName(segment.labelName, segment.autoLabel),
        autoLabel: segment.autoLabel,
        visitCount: Math.max(1, nextVisitCount),
        firstSeenMs: segment.arrivalMs,
        lastSeenMs: segment.departureMs || segment.arrivalMs,
        lat: segment.lat,
        lng: segment.lng,
        totalDurationMs: segment.durationMs,
        canRename: segment.labelId !== null
      });
      continue;
    }
    existing.visitCount = Math.max(existing.visitCount, Math.max(1, nextVisitCount));
    existing.firstSeenMs = Math.min(existing.firstSeenMs, segment.arrivalMs);
    existing.lastSeenMs = Math.max(existing.lastSeenMs, segment.departureMs || segment.arrivalMs);
    existing.totalDurationMs += segment.durationMs;
    if (segment.labelName.trim()) existing.labelName = segment.labelName.trim();
    if (existing.autoLabel === 'new' && segment.autoLabel !== 'new') existing.autoLabel = segment.autoLabel;
  }
  return [...groups.values()].sort((a, b) => {
    if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount;
    return b.lastSeenMs - a.lastSeenMs;
  });
}

export function normalizePlaceRecords(rawPlaces: unknown[], source: SegmentSource): PlaceRecord[] {
  const safePlaces = Array.isArray(rawPlaces) ? rawPlaces : [];
  return safePlaces
    .map((row: any) => {
      const id = Number.isFinite(Number(row?.id)) ? Number(row.id) : null;
      const lat = safeNumber(row?.centroid_lat ?? row?.lat, NaN);
      const lng = safeNumber(row?.centroid_lng ?? row?.lng, NaN);
      return {
        key: placeKey(source, id, lat, lng),
        source,
        id,
        labelName: formatPlaceName(String(row?.name || row?.labelName || '').trim(), row?.auto_label ?? row?.autoLabel),
        autoLabel: normalizedAutoLabel(row?.auto_label ?? row?.autoLabel),
        visitCount: Math.max(1, safeNumber(row?.visit_count ?? row?.visitCount, 1)),
        firstSeenMs: safeNumber(row?.first_seen_ms ?? row?.firstSeenMs),
        lastSeenMs: safeNumber(row?.last_seen_ms ?? row?.lastSeenMs),
        lat,
        lng,
        totalDurationMs: Math.max(0, safeNumber(row?.durationMs)),
        canRename: id !== null
      } satisfies PlaceRecord;
    })
    .filter((place: PlaceRecord) => Number.isFinite(place.lat) && Number.isFinite(place.lng))
    .sort((a, b) => {
      if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount;
      return b.lastSeenMs - a.lastSeenMs;
    });
}

export function buildTimelineDays(segments: TimelineSegment[]): TimelineDay[] {
  const buckets = new Map<string, TimelineSegment[]>();
  for (const segment of segments) {
    const key = segmentDayKey(segment.startMs);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)?.push(segment);
  }
  return [...buckets.entries()]
    .map(([dayKey, rows]) => {
      const placeCount = rows.filter((row) => row.segmentType === 'place').length;
      const tripCount = rows.length - placeCount;
      const durationMs = rows.reduce((sum, row) => sum + Math.max(0, row.durationMs), 0);
      const date = new Date(`${dayKey}T00:00:00`);
      return {
        dayKey,
        label: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        segments: rows.sort((a, b) => a.startMs - b.startMs),
        segmentCount: rows.length,
        placeCount,
        tripCount,
        summary: `${placeCount} places • ${tripCount} trips • ${formatDurationLabel(durationMs)}`
      } satisfies TimelineDay;
    })
    .sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1));
}
