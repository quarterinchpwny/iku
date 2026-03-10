export interface TrackPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy: number;
  speed: number;
  heading: number | null;
  altitude: number | null;
}

export interface Split {
  km: number;
  paceSeconds: number;
  durationMs: number;
}

export interface PositionFix {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  timestamp?: number;
}

export interface RouteSummary {
  elapsedMs: number;
  movingMs: number;
  distanceKm: number;
  avgSpeedMps: number;
  avgPaceSeconds: number;
  totalPoints: number;
  splits: Split[];
}
