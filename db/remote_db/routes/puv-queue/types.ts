import type { D1Database } from '@cloudflare/workers-types';

export type PuvQueueEnv = {
  Bindings: {
    RouteDB: D1Database;
    JWT_SECRET: string;
    ROUTING_PROVIDER?: RoutingProvider;
    OSRM_BASE_URL?: string;
    ORS_API_KEY?: string;
    GOOGLE_MAPS_API_KEY?: string;
  };
};

export type Coordinate = [number, number];

export type RoutingProvider = 'ors' | 'osrm';

export type QueueLevel = 'low' | 'moderate' | 'high' | 'very_high';
export type QueueConfidence = 'high' | 'medium' | 'low';

export type SignalSource = 'routing_live' | 'routing_cache' | 'historical_fallback';

export type DegradedReason = 'missing_routing_config' | 'routing_request_failed' | 'routing_invalid_response';

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

export type WeatherSeverity = 'clear' | 'light_rain' | 'moderate_rain' | 'heavy_rain';

export type WeatherSignal = {
  source: 'open_meteo_live' | 'open_meteo_cache' | 'unavailable';
  severity: WeatherSeverity;
  score_delta: number;
  weather_code: number | null;
  precipitation_probability: number | null;
  precipitation_mm: number | null;
  rain_mm: number | null;
  showers_mm: number | null;
  fetched_at: string | null;
};

export type CalendarSignal = {
  is_holiday: boolean;
  holiday_name: string | null;
  category: string | null;
  source: 'route_config' | 'holiday_calendar' | 'none';
  fetched_at: string | null;
};

export type IncidentCategory = 'event' | 'traffic_advisory';

export type ActiveIncidentSignal = {
  id: number;
  category: IncidentCategory;
  title: string;
  venue_name: string | null;
  score_delta: number;
  source: string;
  starts_at: string;
  ends_at: string;
};

export type IncidentSignal = {
  score_delta: number;
  active: ActiveIncidentSignal[];
};

export type ObservationSignal = {
  score_delta: number;
  sample_count: number;
  average_score: number | null;
  last_observed_at: string | null;
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
    weather: WeatherSignal;
    calendar: CalendarSignal;
    incidents: IncidentSignal;
    observations: ObservationSignal;
  };
  wait_minutes_estimate: QueueWaitEstimate;
  message: QueueMessage;
  recommendation: TravelRecommendation;
  computed_at: string;
  meta: {
    confidence: QueueConfidence;
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
    properties?: {
      summary?: {
        duration?: number;
      };
    };
    geometry?: {
      coordinates?: unknown[];
    };
  }>;
};

export type OsrmTableResponse = {
  code?: string;
  durations?: Array<Array<number | null>>;
};

export type OsrmRouteResponse = {
  code?: string;
  routes?: Array<{
    duration?: number;
    geometry?: {
      coordinates?: unknown[];
    };
  }>;
};

export type QueueHolidayEntry = {
  holiday_date: string;
  label: string;
  category: string;
  source: string;
  year: number;
  fetched_at: number;
  created_at: number;
  updated_at: number;
};

export type QueueIncident = {
  id: number;
  route_key: string;
  category: IncidentCategory;
  title: string;
  venue_name: string | null;
  starts_at: string;
  ends_at: string;
  score_delta: number;
  source: string;
  notes: string;
  is_active: boolean;
  created_at: number;
  updated_at: number;
};

export type QueueObservation = {
  id: number;
  route_key: string;
  observed_at: number;
  queue_level: QueueLevel | null;
  wait_minutes: number | null;
  observed_score: number;
  notes: string;
  created_at: number;
};

export type QueueVenueCandidate = {
  id: string;
  label: string;
  address: string | null;
  lat: number;
  lng: number;
  source: 'google_places';
};
