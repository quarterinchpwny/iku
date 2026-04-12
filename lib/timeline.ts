export function geoDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(Number(b.lat) - Number(a.lat));
  const dLng = toRad(Number(b.lng) - Number(a.lng));
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(Number(a.lat))) *
      Math.cos(toRad(Number(b.lat))) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

export function prettyTime(ts: number): string {
  return new Date(Number(ts || 0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDurationLabel(ms: number): string {
  const safe = Math.max(0, Number(ms || 0));
  const mins = Math.floor(safe / 60_000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function bearingDegrees(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const y = Math.sin(toRad(Number(b.lng) - Number(a.lng))) * Math.cos(toRad(Number(b.lat)));
  const x =
    Math.cos(toRad(Number(a.lat))) * Math.sin(toRad(Number(b.lat))) -
    Math.sin(toRad(Number(a.lat))) *
      Math.cos(toRad(Number(b.lat))) *
      Math.cos(toRad(Number(b.lng) - Number(a.lng)));
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export function toCompass(deg: number): string {
  if (!Number.isFinite(deg)) return 'N/A';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[idx];
}

export function labelFromCenter(
  center: { lat: number; lng: number },
  homeCenter: { lat: number; lng: number } | null,
  officeCenter: { lat: number; lng: number } | null,
  fallbackIndex: number
): string {
  if (homeCenter && geoDistanceMeters(center, homeCenter) <= 220) return 'Home';
  if (officeCenter && geoDistanceMeters(center, officeCenter) <= 220) return 'Office';
  return `Place ${fallbackIndex}`;
}

const TIMELINE_CHUNK_MAX_GAP_MS = 15 * 60 * 1000;
const TIMELINE_CHUNK_MAX_JUMP_M = 800;
const TIMELINE_CHUNK_MAX_DURATION_MS = 90 * 60 * 1000;

export function summarizeTimelineSegment(segmentPoints: any[]) {
  const points = Array.isArray(segmentPoints) ? segmentPoints : [];
  if (!points.length) {
    return {
      routeIds: [],
      routeLabel: '-',
      pointCount: 0,
      durationMs: 0,
      durationLabel: formatDurationLabel(0),
      displacementMeters: 0,
      hasRoute14: false
    };
  }

  const routeIds = [
    ...new Set(points.map((p) => Number(p?.routeId)).filter((id) => Number.isFinite(id)))
  ].sort((a, b) => a - b);
  const start = points[0];
  const end = points[points.length - 1];
  const durationMs = Math.max(0, Number(end?.timestamp || 0) - Number(start?.timestamp || 0));
  let displacementMeters = 0;
  for (let i = 1; i < points.length; i++) {
    displacementMeters += geoDistanceMeters(points[i - 1], points[i]);
  }
  displacementMeters = Math.round(displacementMeters);

  return {
    routeIds,
    routeLabel: routeIds.length ? routeIds.map((id) => `#${id}`).join(', ') : '-',
    pointCount: points.length,
    durationMs,
    durationLabel: formatDurationLabel(durationMs),
    displacementMeters,
    hasRoute14: routeIds.includes(14)
  };
}

export function buildTimeDistanceChunks(points: any[]) {
  const sorted = [...points]
    .map((p) => ({
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      timestamp: Number(p?.timestamp || 0),
      routeId: Number(p?.routeId)
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (sorted.length < 2) return [];

  const chunks = [];
  let chunkStart = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const gapMs = Math.max(0, cur.timestamp - prev.timestamp);
    const jumpM = geoDistanceMeters(prev, cur);
    const durationMs = Math.max(0, cur.timestamp - sorted[chunkStart].timestamp);

    if (
      gapMs > TIMELINE_CHUNK_MAX_GAP_MS ||
      jumpM > TIMELINE_CHUNK_MAX_JUMP_M ||
      durationMs > TIMELINE_CHUNK_MAX_DURATION_MS
    ) {
      chunks.push(sorted.slice(chunkStart, i));
      chunkStart = i;
    }
  }
  chunks.push(sorted.slice(chunkStart));

  return chunks
    .filter((chunk) => chunk.length >= 2)
    .map((chunk, idx) => {
      const start = chunk[0];
      const end = chunk[chunk.length - 1];
      const durationMs = Math.max(0, end.timestamp - start.timestamp);
      return {
        id: `${start.timestamp}-${end.timestamp}-fallback-${idx}`,
        startStory: 'Started moving',
        endStory: `Stopped after ${formatDurationLabel(durationMs)}`,
        startTime: prettyTime(start.timestamp),
        endTime: prettyTime(end.timestamp),
        points: chunk,
        ...summarizeTimelineSegment(chunk)
      };
    });
}

export function buildDayTripSegments(points: any[]) {
  const sorted = [...points]
    .map((p) => ({
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      timestamp: Number(p?.timestamp || 0),
      routeId: Number(p?.routeId)
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length < 2) return [];

  const grouped: Array<{ routeId: number; points: any[] }> = [];
  for (const point of sorted) {
    const routeId = Number(point.routeId);
    if (!Number.isFinite(routeId)) continue;
    const last = grouped[grouped.length - 1];
    if (!last || last.routeId !== routeId) {
      grouped.push({ routeId, points: [point] });
    } else {
      last.points.push(point);
    }
  }
  if (grouped.length > 1) {
    const segments = grouped
      .filter((g) => g.points.length >= 2)
      .map((g, idx) => {
        const start = g.points[0];
        const end = g.points[g.points.length - 1];
        const durationMs = Math.max(0, end.timestamp - start.timestamp);
        return {
          id: `${start.timestamp}-${end.timestamp}-route-${g.routeId}-${idx}`,
          startStory: 'Started moving',
          endStory: `Stopped after ${formatDurationLabel(durationMs)}`,
          startTime: prettyTime(start.timestamp),
          endTime: prettyTime(end.timestamp),
          points: g.points,
          ...summarizeTimelineSegment(g.points)
        };
      });
    if (segments.length) return segments;
  }

  const STOP_RADIUS_M = 130;
  const STOP_MIN_DURATION_MS = 20 * 60 * 1000;
  const stays = [];
  let groupStart = 0;
  let sumLat = sorted[0].lat;
  let sumLng = sorted[0].lng;
  let groupCount = 1;

  for (let i = 1; i < sorted.length; i++) {
    const center = { lat: sumLat / groupCount, lng: sumLng / groupCount };
    const far = geoDistanceMeters(center, sorted[i]) > STOP_RADIUS_M;
    if (!far) {
      sumLat += sorted[i].lat;
      sumLng += sorted[i].lng;
      groupCount += 1;
      continue;
    }
    const startTs = sorted[groupStart].timestamp;
    const endTs = sorted[i - 1].timestamp;
    const durationMs = endTs - startTs;
    if (durationMs >= STOP_MIN_DURATION_MS) {
      stays.push({
        startIdx: groupStart,
        endIdx: i - 1,
        start: startTs,
        end: endTs,
        center,
        durationMs
      });
    }
    groupStart = i;
    sumLat = sorted[i].lat;
    sumLng = sorted[i].lng;
    groupCount = 1;
  }

  const finalStart = sorted[groupStart].timestamp;
  const finalEnd = sorted[sorted.length - 1].timestamp;
  const finalDuration = finalEnd - finalStart;
  if (finalDuration >= STOP_MIN_DURATION_MS) {
    stays.push({
      startIdx: groupStart,
      endIdx: sorted.length - 1,
      start: finalStart,
      end: finalEnd,
      center: { lat: sumLat / groupCount, lng: sumLng / groupCount },
      durationMs: finalDuration
    });
  }
  if (stays.length < 2) return buildTimeDistanceChunks(sorted);

  const homeCenter = stays[0]?.center || null;
  const officeCenter =
    [...stays]
      .filter((s) => homeCenter && geoDistanceMeters(s.center, homeCenter) > 220)
      .sort((a, b) => b.durationMs - a.durationMs)[0]?.center || null;

  const segments = [];
  let idx = 1;
  for (let i = 0; i < stays.length - 1; i++) {
    const from = stays[i];
    const to = stays[i + 1];
    const fromLabel = labelFromCenter(from.center, homeCenter, officeCenter, idx++);
    const toLabel = labelFromCenter(to.center, homeCenter, officeCenter, idx++);
    const travelMs = Math.max(0, to.start - from.end);
    const tripPoints = sorted.slice(from.endIdx, to.startIdx + 1);
    if (tripPoints.length < 2) continue;
    segments.push({
      id: `${from.start}-${to.end}-${i}`,
      startStory: `At ${fromLabel} for ${formatDurationLabel(from.durationMs)}`,
      endStory: `Went to ${toLabel} in ${formatDurationLabel(travelMs)} • stayed ${formatDurationLabel(to.durationMs)}`,
      startTime: prettyTime(from.start),
      endTime: prettyTime(to.end),
      points: tripPoints,
      ...summarizeTimelineSegment(tripPoints)
    });
  }
  return segments.length ? segments : buildTimeDistanceChunks(sorted);
}

export function buildPassiveStory(points: any[]) {
  const sorted = [...points]
    .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng), timestamp: Number(p.timestamp || 0) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length < 2)
    return { story: `Passive route with ${sorted.length} point`, durationMs: 0 };
  const totalMs = Math.max(0, sorted[sorted.length - 1].timestamp - sorted[0].timestamp);
  const dist = geoDistanceMeters(sorted[0], sorted[sorted.length - 1]);
  if (dist < 200) {
    return { story: `Stayed nearby for ${formatDurationLabel(totalMs)}`, durationMs: totalMs };
  }
  return {
    story: `Route length logged across ${formatDurationLabel(totalMs)} (${Math.round(dist)}m span)`,
    durationMs: totalMs
  };
}

export function buildActiveStory(points: any[]) {
  const sorted = [...points]
    .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng), timestamp: Number(p.timestamp || 0) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length < 2)
    return { story: `Active route with ${sorted.length} point`, durationMs: 0 };
  const totalMs = Math.max(0, sorted[sorted.length - 1].timestamp - sorted[0].timestamp);
  return {
    story: `Active route logged for ${formatDurationLabel(totalMs)}`,
    durationMs: totalMs,
    activeMetrics: null
  };
}

export function buildRouteSummaries(trackingRoutes: any[], trackingPoints: any[], passiveLocations: any[]) {
  const passiveRouteIds = new Set(
    passiveLocations.map((pl) => Number(pl.route_id)).filter((id) => Number.isFinite(id))
  );
  const passiveByRoute = new Map();
  for (const pl of passiveLocations) {
    const routeKey = Number(pl?.route_id);
    if (!Number.isFinite(routeKey)) continue;
    if (!passiveByRoute.has(routeKey)) passiveByRoute.set(routeKey, []);
    passiveByRoute.get(routeKey).push(pl);
  }
  const counts = new Map();
  const pointsByRoute = new Map();
  for (const p of trackingPoints) {
    const key = Number(p.routeId);
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!pointsByRoute.has(key)) pointsByRoute.set(key, []);
    pointsByRoute.get(key).push(p);
  }
  return [...trackingRoutes]
    .map((r) => {
      const id = Number(r.id);
      const source = String(r.source || '').toUpperCase();
      const classification =
        source === 'ACTIVE'
          ? 'ACTIVE'
          : source === 'PASSIVE'
            ? 'PASSIVE'
            : passiveRouteIds.has(id)
              ? 'PASSIVE'
              : 'ACTIVE';
      const routePoints = (pointsByRoute.get(id) || []).sort(
        (a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0)
      );
      const firstPointTimestamp = Number(routePoints[0]?.timestamp || 0);
      const lastPointTimestamp = Number(routePoints[routePoints.length - 1]?.timestamp || 0);
      const startTimestamp = firstPointTimestamp || Number(r?.timestamp || 0);
      const endTimestamp = lastPointTimestamp || startTimestamp;
      const narrative =
        classification === 'ACTIVE'
          ? buildActiveStory(routePoints)
          : buildPassiveStory(routePoints);
      const passiveRows = (passiveByRoute.get(id) || []).sort(
        (a, b) => Number(a?.timestamp || 0) - Number(b?.timestamp || 0)
      );
      const latestPassive = passiveRows.length ? passiveRows[passiveRows.length - 1] : null;
      const avgAcc = passiveRows.length
        ? passiveRows.reduce((acc, row) => acc + Number(row?.acc || 0), 0) / passiveRows.length
        : null;
      return {
        ...r,
        id,
        startTimestamp,
        endTimestamp,
        pointCount: counts.get(id) || 0,
        classification,
        story: narrative.story,
        durationLabel: formatDurationLabel(narrative.durationMs || 0),
        activeMetrics: narrative.activeMetrics,
        routeStatus: String(r?.status || '').toUpperCase() || '-',
        routeDistanceMeters: Number(r?.distance_meters || 0),
        routePointCountServer: Number(r?.point_count || 0),
        passiveSampleCount: passiveRows.length,
        passiveSummary: latestPassive
          ? {
              trigger: String(latestPassive?.trigger || ''),
              provider: String(latestPassive?.provider || ''),
              acc: Number(latestPassive?.acc || 0),
              vel: Number(latestPassive?.vel || 0),
              cog: Number(latestPassive?.cog || 0),
              alt: Number(latestPassive?.alt || 0),
              avgAcc: avgAcc == null || Number.isNaN(avgAcc) ? null : Number(avgAcc)
            }
          : null
      };
    })
    .filter((r) => r.pointCount > 0)
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
}

export function buildPassiveDayTimeline(routeSummaries: any[]) {
  const buckets = new Map();
  const passiveRoutes = routeSummaries
    .filter((r) => r.classification === 'PASSIVE')
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  for (const route of passiveRoutes) {
    const ts = Number(route.timestamp || 0);
    if (!Number.isFinite(ts) || ts <= 0) continue;
    const d = new Date(ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(route);
  }
  return [...buckets.entries()]
    .map(([dayKey, routes]) => {
      const routeIds = routes.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
      const totalPoints = routes.reduce((acc, r) => acc + Number(r.pointCount || 0), 0);
      const date = new Date(`${dayKey}T00:00:00`);
      const narrative = routes
        .slice(0, 3)
        .map((r) => String(r.story || `Route #${r.id}`))
        .join(' • ');
      return {
        dayKey,
        label: date.toLocaleDateString(),
        routeCount: routes.length,
        routeIds,
        totalPoints,
        summary: narrative || `${routes.length} routes • ${totalPoints} points`,
        events: narrative
          ? narrative
              .split(' • ')
              .map((s: string) => s.trim())
              .filter(Boolean)
              .slice(0, 4)
          : [`${routes.length} routes visited`, `${totalPoints} points logged`]
      };
    })
    .sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))
    .slice(0, 7);
}

export function segmentStartPlace(story: string) {
  const raw = String(story || '');
  const match = raw.match(/^At\s+(.+?)\s+for\s+/i);
  return match?.[1] || 'Origin';
}

export function segmentEndPlace(story: string) {
  const raw = String(story || '');
  const match = raw.match(/^Went to\s+(.+?)\s+in\s+/i);
  return match?.[1] || 'Destination';
}

export function segmentTravelMode(segment: any) {
  const durationHours = Math.max(0.01, Number(segment?.durationMs || 0) / 3_600_000);
  const distanceKm = Math.max(0, Number(segment?.displacementMeters || 0) / 1000);
  const speedKmh = distanceKm / durationHours;
  if (speedKmh < 8) return 'Walk';
  if (speedKmh < 22) return 'Bike';
  return 'Drive';
}
