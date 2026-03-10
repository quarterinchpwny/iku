export const TRACKER_LIMITS = {
  minAccuracyMeters: 25,
  minDisplacementMeters: 7,
  minPointIntervalMs: 900,
  maxDerivedSpeedMps: 12,
  speedSmoothWindow: 6,
  coordinateSmoothingAlpha: 0.34,
  autoPauseSpeedMps: 0.55,
  autoPauseDelayMs: 8000,
  splitDistanceKm: 1,
  batchFlushIntervalMs: 15000,
  minMovingSpeedMps: 0.6,
};
