import { formatDurationLabel, prettyTime } from '~/lib/timeline';
import { formatPlaceName, type TimelineDay, type TimelineSegment } from '~/lib/places';

export function buildDayStats(day: TimelineDay | null) {
  if (!day) {
    return { placeCount: 0, tripCount: 0, movementSpanLabel: '0m', durationLabel: '--' };
  }
  const distanceMeters = day.segments.reduce((sum, row) => {
    if (row.segmentType !== 'trip') return sum;
    return sum + row.distanceMeters;
  }, 0);
  const durationMs = day.segments.reduce((sum, row) => sum + Math.max(0, row.durationMs), 0);
  return {
    placeCount: day.placeCount,
    tripCount: day.tripCount,
    movementSpanLabel: `${Math.round(distanceMeters)}m`,
    durationLabel: formatDurationLabel(durationMs)
  };
}

function nearestPlaceName(segments: TimelineSegment[], startIndex: number, direction: -1 | 1): string {
  let index = startIndex + direction;
  while (index >= 0 && index < segments.length) {
    const segment = segments[index];
    if (segment.segmentType === 'place') return formatPlaceName(segment.labelName, segment.autoLabel);
    index += direction;
  }
  return direction === -1 ? 'Previous stop' : 'Next stop';
}

export function buildTimelineRows(day: TimelineDay | null) {
  if (!day) return [];
  return day.segments.map((segment, index) => {
    if (segment.segmentType === 'place') {
      return {
        segmentType: 'place' as const,
        key: segment.key,
        title: formatPlaceName(segment.labelName, segment.autoLabel),
        rangeLabel: `${prettyTime(segment.arrivalMs)} - ${prettyTime(segment.departureMs || segment.arrivalMs)}`,
        durationLabel: formatDurationLabel(segment.durationMs),
        visitLabel: `${Math.max(1, segment.visitCount)} visits`,
        autoLabel: String(segment.autoLabel || 'new'),
        coordinateLabel: `${segment.lat.toFixed(4)}, ${segment.lng.toFixed(4)}`,
        source: segment.source
      };
    }
    const startPlace = nearestPlaceName(day.segments, index, -1);
    const endPlace = nearestPlaceName(day.segments, index, 1);
    return {
      segmentType: 'trip' as const,
      key: segment.key,
      title: `${segment.dominantMode || 'Trip'} segment`,
      rangeLabel: `${prettyTime(segment.startMs)} - ${prettyTime(segment.endMs || segment.startMs)}`,
      durationLabel: formatDurationLabel(segment.durationMs),
      routeLengthLabel: `${Math.round(segment.distanceMeters)}m`,
      startPlace,
      endPlace,
      story: `${startPlace} to ${endPlace}`,
      mode: segment.dominantMode || 'Trip',
      pointCount: segment.pointCount,
      points: segment.waypoints,
      source: segment.source
    };
  });
}
