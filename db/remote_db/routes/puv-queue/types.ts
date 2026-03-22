import type { D1Database } from '@cloudflare/workers-types';

export type PuvQueueEnv = {
  Bindings: {
    RouteDB: D1Database;
    JWT_SECRET: string;
    ORS_API_KEY?: string;
  };
};

export type Coordinate = [number, number];

export type QueueLevel = 'low' | 'moderate' | 'high' | 'very_high';
export type QueueConfidence = 'high' | 'medium' | 'low';

export type SignalSource = 'ors_live' | 'ors_cache' | 'historical_fallback';

export type DegradedReason = 'missing_ors_api_key' | 'ors_request_failed' | 'ors_invalid_response';

export type QueueRouteConfig = {
  route_key: string;
  label: string;
  origin: Coordinate;
  destination: Coordinate;
  timezone: string;
  cache_ttl_ms: number;
  baseline_by_hour: number[];
  tod_score_by_hour: number[];
  holidays: string[];
  is_active: boolean;
  is_default: boolean;
  created_at: number;
  updated_at: number;
};

export type QueueRouteSummary = Pick<
  QueueRouteConfig,
  'route_key' | 'label' | 'timezone' | 'is_active' | 'is_default' | 'updated_at'
> & {
  origin: Coordinate;
  destination: Coordinate;
};

export type TimeSignal = {
  hour: number;
  period: string;
  base_score: number;
};

export type TrafficSignal = {
  source: SignalSource;
  duration_seconds: number;
  baseline_seconds: number;
  ratio: number;
  label: 'light' | 'moderate' | 'heavy';
};

export type DayTypeSignal = {
  is_weekend: boolean;
  is_holiday: boolean;
  multiplier: number;
};

export type QueueWaitEstimate = {
  min_minutes: number;
  likely_minutes: number;
  max_minutes: number;
};

export type QueueMessage = {
  headline: string;
  reason: string;
  action: string;
  confidence_note: string;
};

export type TravelRecommendation = {
  best_option: 'ride' | 'walk' | 'either' | 'unavailable';
  ride_wait_minutes: number;
  ride_in_vehicle_minutes: number;
  ride_total_minutes: number;
  walk_total_minutes: number | null;
  time_saved_minutes: number | null;
  message: string;
};

export type QueueEstimate = {
  route: {
    route_key: string;
    label: string;
    origin: Coordinate;
    destination: Coordinate;
    timezone: string;
  };
  level: QueueLevel;
  score: number;
  signals: {
    time_of_day: TimeSignal;
    traffic: TrafficSignal;
    day_type: DayTypeSignal;
  };
  wait_minutes_estimate: QueueWaitEstimate;
  advice: string;
  message: QueueMessage;
  recommendation: TravelRecommendation;
  computed_at: string;
  meta: {
    degraded: boolean;
    degraded_reason: DegradedReason | null;
    cache: {
      hit: boolean;
      age_ms: number | null;
      ttl_ms: number;
    };
  };
  polyline?: RoutePolyline | null;
  walking_polyline?: RoutePolyline | null;
};

export type OrsMatrixResponse = {
  durations?: number[][];
};

export type RoutePolyline = [number, number][];

export type OrsDirectionsResponse = {
  features?: Array<{
    geometry?: {
      coordinates?: unknown[];
    };
  }>;
};
