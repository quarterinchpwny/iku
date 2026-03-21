import { formatPlaceName, type TimelineSegment } from '~/lib/places';

type RouteLike = {
  startTimestamp?: number;
  endTimestamp?: number;
  timestamp?: number;
  localOnly?: boolean;
  story?: string;
};

type PlaceSegment = Extract<TimelineSegment, { segmentType: 'place' }>;

function placeSegments(segments: TimelineSegment[]): PlaceSegment[] {
  return segments.filter((segment): segment is PlaceSegment => segment.segmentType === 'place');
}

function placeName(segment: PlaceSegment | null): string {
  if (!segment) return '';
  return formatPlaceName(segment.labelName, segment.autoLabel);
}

function overlapsWindow(segment: PlaceSegment, startMs: number, endMs: number): boolean {
  const departureMs = segment.departureMs ?? segment.arrivalMs;
  return segment.arrivalMs <= endMs && departureMs >= startMs;
}

function nearestPreviousPlace(segments: PlaceSegment[], timestamp: number, toleranceMs: number): PlaceSegment | null {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    const departureMs = segment.departureMs ?? segment.arrivalMs;
    if (departureMs > timestamp) continue;
    if (timestamp - departureMs > toleranceMs) break;
    return segment;
  }
  return null;
}

function nearestNextPlace(segments: PlaceSegment[], timestamp: number, toleranceMs: number): PlaceSegment | null {
  for (const segment of segments) {
    if (segment.arrivalMs < timestamp) continue;
    if (segment.arrivalMs - timestamp > toleranceMs) break;
    return segment;
  }
  return null;
}

function resolvePlacesForRoute(route: RouteLike, segments: TimelineSegment[]) {
  const startMs = Number(route.startTimestamp || route.timestamp || 0);
  const endMs = Number(route.endTimestamp || startMs);
  if (!Number.isFinite(startMs) || startMs <= 0) return null;
  const sortedPlaces = placeSegments(segments).sort((a, b) => a.arrivalMs - b.arrivalMs);
  if (!sortedPlaces.length) return null;
  const overlapping = sortedPlaces.filter((segment) => overlapsWindow(segment, startMs, endMs));
  const toleranceMs = 12 * 60 * 60 * 1000;
  const startPlace =
    overlapping[0] ||
    nearestPreviousPlace(sortedPlaces, startMs, toleranceMs) ||
    nearestNextPlace(sortedPlaces, startMs, toleranceMs);
  const endPlace =
    overlapping[overlapping.length - 1] ||
    nearestNextPlace(sortedPlaces, endMs, toleranceMs) ||
    nearestPreviousPlace(sortedPlaces, endMs, toleranceMs);
  const startLabel = placeName(startPlace);
  const endLabel = placeName(endPlace);
  if (!startLabel && !endLabel) return null;
  if (startLabel && endLabel && startLabel !== endLabel) {
    return {
      startPlace: startLabel,
      endPlace: endLabel,
      placeStory: `${startLabel} to ${endLabel}`
    };
  }
  const sharedLabel = startLabel || endLabel;
  return {
    startPlace: sharedLabel,
    endPlace: sharedLabel,
    placeStory: `Movement around ${sharedLabel}`
  };
}

export function enrichRoutesWithPlaceLabels<T extends RouteLike>(
  routes: T[],
  localSegments: TimelineSegment[],
  remoteSegments: TimelineSegment[]
): Array<T & { startPlace?: string; endPlace?: string; placeStory?: string }> {
  return routes.map((route) => {
    const preferredSegments = route.localOnly
      ? localSegments
      : remoteSegments.length
        ? remoteSegments
        : localSegments;
    const placeDetails = resolvePlacesForRoute(route, preferredSegments);
    if (!placeDetails) return route;
    return {
      ...route,
      ...placeDetails,
      story: placeDetails.placeStory
    };
  });
}
