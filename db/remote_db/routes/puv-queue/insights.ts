import type {
  CalendarSignal,
  IncidentSignal,
  ObservationSignal,
  QueueConfidence,
  QueueLevel,
  QueueMessage,
  QueueWaitEstimate,
  SignalSource,
  TravelRecommendation,
  WeatherSignal,
} from './types';

type WaitBand = {
  min: number;
  likely: number;
  max: number;
  lowerScore: number;
  upperScore: number;
};

type MessageInput = {
  cacheAgeMs: number | null;
  calendar: CalendarSignal;
  degraded: boolean;
  incidents: IncidentSignal;
  level: QueueLevel;
  observations: ObservationSignal;
  period: string;
  recommendation: TravelRecommendation;
  source: SignalSource;
  trafficRatio: number;
  waitEstimate: QueueWaitEstimate;
  weather: WeatherSignal;
};

const waitBands: Record<QueueLevel, WaitBand> = {
  low: { min: 0, likely: 4, max: 8, lowerScore: 0, upperScore: 2.5 },
  moderate: { min: 5, likely: 10, max: 16, lowerScore: 2.5, upperScore: 4.5 },
  high: { min: 12, likely: 20, max: 32, lowerScore: 4.5, upperScore: 7 },
  very_high: { min: 25, likely: 35, max: 50, lowerScore: 7, upperScore: 10 },
};

function roundMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

function interpolate(min: number, max: number, progress: number): number {
  return Math.round(min + (max - min) * progress);
}

function formatRatio(trafficRatio: number): string {
  return `${Math.round(trafficRatio * 10) / 10}x`;
}

function scoreDeltaLabel(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

export function buildWaitEstimate(score: number, level: QueueLevel): QueueWaitEstimate {
  const band = waitBands[level];
  const span = Math.max(0.1, band.upperScore - band.lowerScore);
  const progress = Math.min(1, Math.max(0, (score - band.lowerScore) / span));

  return {
    min_minutes: band.min,
    likely_minutes: interpolate(band.min, band.max, progress),
    max_minutes: band.max,
  };
}

export function buildRecommendation(
  waitEstimate: QueueWaitEstimate,
  driveDurationSeconds: number,
  walkDurationSeconds: number | null,
): TravelRecommendation {
  const rideWaitMinutes = waitEstimate.likely_minutes;
  const rideInVehicleMinutes = roundMinutes(driveDurationSeconds);
  const rideTotalMinutes = rideWaitMinutes + rideInVehicleMinutes;

  if (walkDurationSeconds == null) {
    return {
      best_option: 'unavailable',
      ride_wait_minutes: rideWaitMinutes,
      ride_in_vehicle_minutes: rideInVehicleMinutes,
      ride_total_minutes: rideTotalMinutes,
      walk_total_minutes: null,
      time_saved_minutes: null,
      message: "Can't compare walking right now — directions aren't available.",
    };
  }

  const walkTotalMinutes = roundMinutes(walkDurationSeconds);
  const timeSavedMinutes = Math.abs(rideTotalMinutes - walkTotalMinutes);

  if (timeSavedMinutes < 5) {
    return {
      best_option: 'either',
      ride_wait_minutes: rideWaitMinutes,
      ride_in_vehicle_minutes: rideInVehicleMinutes,
      ride_total_minutes: rideTotalMinutes,
      walk_total_minutes: walkTotalMinutes,
      time_saved_minutes: timeSavedMinutes,
      message: 'Walking or riding takes about the same time — go with whatever feels easier.',
    };
  }

  if (walkTotalMinutes + 10 <= rideTotalMinutes || walkTotalMinutes <= rideTotalMinutes * 0.85) {
    return {
      best_option: 'walk',
      ride_wait_minutes: rideWaitMinutes,
      ride_in_vehicle_minutes: rideInVehicleMinutes,
      ride_total_minutes: rideTotalMinutes,
      walk_total_minutes: walkTotalMinutes,
      time_saved_minutes: timeSavedMinutes,
      message: `Walking could save you about ${timeSavedMinutes} minutes — the queue isn't worth it right now.`,
    };
  }

  if (rideTotalMinutes + 10 <= walkTotalMinutes || rideTotalMinutes <= walkTotalMinutes * 0.85) {
    return {
      best_option: 'ride',
      ride_wait_minutes: rideWaitMinutes,
      ride_in_vehicle_minutes: rideInVehicleMinutes,
      ride_total_minutes: rideTotalMinutes,
      walk_total_minutes: walkTotalMinutes,
      time_saved_minutes: timeSavedMinutes,
      message: `Riding is still about ${timeSavedMinutes} minutes faster than walking.`,
    };
  }

  return {
    best_option: 'either',
    ride_wait_minutes: rideWaitMinutes,
    ride_in_vehicle_minutes: rideInVehicleMinutes,
    ride_total_minutes: rideTotalMinutes,
    walk_total_minutes: walkTotalMinutes,
    time_saved_minutes: timeSavedMinutes,
    message: `Walking and riding are within ${timeSavedMinutes} minutes of each other — either works.`,
  };
}

function buildContextFragments({
  calendar,
  incidents,
  observations,
  weather,
}: Pick<MessageInput, 'calendar' | 'incidents' | 'observations' | 'weather'>): string[] {
  const fragments: string[] = [];

  if (weather.severity === 'heavy_rain') {
    fragments.push('Heavy rain is likely pushing more riders into the queue.');
  } else if (weather.severity === 'moderate_rain') {
    fragments.push('Rain is likely adding noticeable queue pressure.');
  } else if (weather.severity === 'light_rain') {
    fragments.push('Light rain may be nudging demand upward.');
  }

  if (calendar.is_holiday && calendar.holiday_name) {
    fragments.push(`${calendar.holiday_name} changes the usual commute pattern today.`);
  } else if (calendar.is_holiday) {
    fragments.push('A holiday schedule is shaping demand today.');
  }

  if (incidents.active.length === 1) {
    fragments.push(`${incidents.active[0].title} is adding extra pressure near the route.`);
  } else if (incidents.active.length > 1) {
    fragments.push(`${incidents.active.length} active route incidents are adding extra pressure right now.`);
  }

  if (observations.sample_count >= 3 && typeof observations.average_score === 'number') {
    if (Math.abs(observations.score_delta) < 0.1) {
      fragments.push('Recent operator observations are lining up closely with the static baseline.');
    } else {
      const direction = observations.score_delta > 0 ? 'above' : 'below';
      fragments.push(`Recent operator observations are running ${direction} the static baseline for this time slot.`);
    }
  }

  return fragments;
}

function buildHeadline({
  calendar,
  incidents,
  level,
  observations,
  weather,
}: Pick<MessageInput, 'calendar' | 'incidents' | 'level' | 'observations' | 'weather'>): string {
  if (weather.severity === 'heavy_rain') {
    if (level === 'very_high' || level === 'high') return 'Rain surge on the queue';
    return 'Rain is lifting demand';
  }

  if (weather.severity === 'moderate_rain') {
    if (level === 'very_high' || level === 'high') return 'Wet-weather queue build';
    return 'Rain pressure is showing';
  }

  if (incidents.active.length) {
    const incident = incidents.active[0];
    if (incident.category === 'traffic_advisory') {
      return level === 'low' ? 'Route disruption nearby' : 'Traffic disruption is biting';
    }
    return level === 'low' ? 'Event demand nearby' : 'Event traffic is pushing queues up';
  }

  if (observations.sample_count >= 3 && observations.score_delta >= 0.8) {
    return 'Queues are running hotter than usual';
  }

  if (observations.sample_count >= 3 && observations.score_delta <= -0.8) {
    return 'Queues are lighter than usual';
  }

  if (calendar.is_holiday) {
    if (level === 'low') return 'Holiday pattern looks light';
    if (level === 'moderate') return 'Holiday demand is manageable';
    return 'Holiday demand is still elevated';
  }

  const headlineByLevel: Record<QueueLevel, string> = {
    low: 'Queue looks clear',
    moderate: 'Short wait expected',
    high: 'Queue is building',
    very_high: 'Long queue ahead',
  };

  return headlineByLevel[level];
}

function buildReason({
  cacheAgeMs,
  calendar,
  degraded,
  incidents,
  observations,
  period,
  source,
  trafficRatio,
  weather,
}: Omit<MessageInput, 'level' | 'recommendation' | 'waitEstimate'>): string {
  const context = buildContextFragments({ calendar, incidents, observations, weather }).join(' ');
  if (degraded) {
    return [context, `Live traffic isn't available, so this estimate falls back to the usual ${period} pattern for this route.`]
      .filter(Boolean)
      .join(' ');
  }

  if (source === 'routing_cache') {
    const cacheAgeMinutes = cacheAgeMs == null ? null : Math.max(1, Math.round(cacheAgeMs / 60000));
    const base = cacheAgeMinutes == null
      ? `Cached data shows travel time running ${formatRatio(trafficRatio)} the usual ${period} pace for this route.`
      : `Traffic data from about ${cacheAgeMinutes} minute${cacheAgeMinutes === 1 ? '' : 's'} ago shows travel time running ${formatRatio(trafficRatio)} the usual ${period} pace.`;
    return [base, context].filter(Boolean).join(' ');
  }

  if (calendar.is_holiday) {
    return [
      `Traffic is running ${formatRatio(trafficRatio)} the usual ${period} pace on a holiday schedule.`,
      context,
    ]
      .filter(Boolean)
      .join(' ');
  }

  return [`Live travel time is ${formatRatio(trafficRatio)} the usual ${period} pace for this route.`, context]
    .filter(Boolean)
    .join(' ');
}

function buildPrimaryDriver({
  calendar,
  incidents,
  observations,
  weather,
}: Pick<MessageInput, 'calendar' | 'incidents' | 'observations' | 'weather'>): string | null {
  if (weather.score_delta >= 1.5) {
    return `Heavy rain is adding about ${scoreDeltaLabel(weather.score_delta)} queue score.`;
  }

  if (weather.score_delta >= 0.5) {
    return `Rain is adding about ${scoreDeltaLabel(weather.score_delta)} queue score.`;
  }

  if (incidents.active.length) {
    const incident = incidents.active[0];
    if (incidents.active.length === 1) {
      return `${incident.title} is adding about ${scoreDeltaLabel(incident.score_delta)} queue score.`;
    }

    return `${incidents.active.length} route incidents are adding about ${scoreDeltaLabel(incidents.score_delta)} queue score.`;
  }

  if (observations.sample_count >= 3 && Math.abs(observations.score_delta) >= 0.4) {
    const direction = observations.score_delta > 0 ? 'above' : 'below';
    return `Recent observations are ${direction} baseline by about ${scoreDeltaLabel(observations.score_delta)} score.`;
  }

  if (calendar.is_holiday && calendar.holiday_name) {
    return `${calendar.holiday_name} is changing the usual demand pattern.`;
  }

  if (calendar.is_holiday) {
    return 'The holiday calendar is shifting the usual demand pattern.';
  }

  return null;
}

function buildAction(
  calendar: CalendarSignal,
  level: QueueLevel,
  recommendation: TravelRecommendation,
  waitEstimate: QueueWaitEstimate,
  observations: ObservationSignal,
  weather: WeatherSignal,
  incidents: IncidentSignal,
): string {
  if (recommendation.best_option === 'walk') {
    if (weather.severity === 'heavy_rain' || weather.severity === 'moderate_rain') {
      return `${recommendation.message} Rain is elevated too, so only walk if that tradeoff still makes sense for you.`;
    }
    return recommendation.message;
  }

  if (level === 'very_high') {
    if (incidents.active.length) {
      return `Expect around ${waitEstimate.likely_minutes} minutes of queuing. A nearby event or traffic disruption is likely amplifying the surge.`;
    }
    if (weather.severity === 'heavy_rain' || weather.severity === 'moderate_rain') {
      return `Expect around ${waitEstimate.likely_minutes} minutes of queuing. Wet-weather demand is likely compressing boarding time.`;
    }
    return `Expect around ${waitEstimate.likely_minutes} minutes of queuing. If you're flexible, consider waiting it out or finding another way home.`;
  }

  if (level === 'high') {
    if (weather.severity === 'heavy_rain' || weather.severity === 'moderate_rain') {
      return `Expect around ${waitEstimate.likely_minutes} minutes of queuing. Rain is keeping more riders off the walk option right now.`;
    }
    if (calendar.is_holiday) {
      return `Expect around ${waitEstimate.likely_minutes} minutes of queuing. Holiday traffic may look lighter, but boarding demand is still elevated.`;
    }
    return `Expect around ${waitEstimate.likely_minutes} minutes of queuing — leaving a little earlier or later should help.`;
  }

  if (level === 'moderate') {
    if (observations.sample_count >= 3 && observations.score_delta >= 0.5) {
      return `Allow about ${waitEstimate.likely_minutes} minutes of waiting. Recent ground observations suggest this slot is running warmer than the static baseline.`;
    }
    return `Allow about ${waitEstimate.likely_minutes} minutes of waiting before you board.`;
  }

  if (calendar.is_holiday) {
    return 'The queue should stay fairly easy on the holiday schedule.';
  }

  return "The queue should move quickly — no need to rush.";
}

function buildConfidenceNote({
  calendar,
  incidents,
  observations,
  source,
  weather,
}: Pick<MessageInput, 'calendar' | 'incidents' | 'observations' | 'source' | 'weather'>): string {
  const base = {
    routing_live: 'Live routing data',
    routing_cache: 'Recent cached routing data',
    historical_fallback: 'Historical traffic patterns',
  }[source];

  const enrichments: string[] = [];
  if (weather.source !== 'unavailable') enrichments.push('Open-Meteo rain signal');
  if (calendar.source === 'holiday_calendar') enrichments.push('official holiday calendar');
  if (calendar.source === 'route_config') enrichments.push('route holiday rules');
  if (incidents.active.length) enrichments.push(`${incidents.active.length} route incident${incidents.active.length === 1 ? '' : 's'}`);
  if (observations.sample_count >= 3) enrichments.push(`${observations.sample_count} matching observations`);

  if (!enrichments.length) {
    return `Based on ${base.toLowerCase()}.`;
  }

  return `Based on ${base.toLowerCase()} plus ${enrichments.join(', ')}.`;
}

export function buildConfidence({
  degraded,
  observations,
  source,
  weather,
}: Pick<MessageInput, 'degraded' | 'observations' | 'source' | 'weather'>): QueueConfidence {
  if (degraded || source === 'historical_fallback') {
    return observations.sample_count >= 3 ? 'medium' : 'low';
  }

  if (source === 'routing_cache') {
    if (observations.sample_count >= 3 || weather.source !== 'unavailable') {
      return 'high';
    }
    return 'medium';
  }

  if (observations.sample_count >= 3 || weather.source !== 'unavailable') {
    return 'high';
  }

  return 'medium';
}

export function buildMessage(input: MessageInput): QueueMessage {
  const primaryDriver = buildPrimaryDriver(input);

  return {
    headline: buildHeadline(input),
    reason: [primaryDriver, buildReason(input)].filter(Boolean).join(' '),
    action: buildAction(input.calendar, input.level, input.recommendation, input.waitEstimate, input.observations, input.weather, input.incidents),
    confidence_note: buildConfidenceNote(input),
  };
}
