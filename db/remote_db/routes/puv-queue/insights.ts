import type {
  QueueConfidence,
  QueueLevel,
  QueueMessage,
  QueueWaitEstimate,
  SignalSource,
  TravelRecommendation,
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
  degraded: boolean;
  isDayOff: boolean;
  level: QueueLevel;
  period: string;
  recommendation: TravelRecommendation;
  source: SignalSource;
  trafficRatio: number;
  waitEstimate: QueueWaitEstimate;
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

export function getConfidence(source: SignalSource): QueueConfidence {
  if (source === 'ors_live') return 'high';
  if (source === 'ors_cache') return 'medium';
  return 'low';
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
      message: 'Walking comparison is unavailable right now.',
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
      message: 'Walking and queueing are about the same right now.',
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
      message: `You may get home about ${timeSavedMinutes} minutes faster if you walk.`,
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
      message: `Riding is still faster by about ${timeSavedMinutes} minutes.`,
    };
  }

  return {
    best_option: 'either',
    ride_wait_minutes: rideWaitMinutes,
    ride_in_vehicle_minutes: rideInVehicleMinutes,
    ride_total_minutes: rideTotalMinutes,
    walk_total_minutes: walkTotalMinutes,
    time_saved_minutes: timeSavedMinutes,
    message: `Walking and riding are within about ${timeSavedMinutes} minutes of each other.`,
  };
}

function buildReason({
  cacheAgeMs,
  degraded,
  isDayOff,
  period,
  source,
  trafficRatio,
}: Omit<MessageInput, 'level' | 'recommendation' | 'waitEstimate'>): string {
  if (degraded) {
    return `Live traffic is unavailable, so this estimate uses the usual ${period} pattern for this route.`;
  }

  if (source === 'ors_cache') {
    const cacheAgeMinutes = cacheAgeMs == null ? null : Math.max(1, Math.round(cacheAgeMs / 60000));
    return cacheAgeMinutes == null
      ? `Recent cached traffic is ${formatRatio(trafficRatio)} the normal ${period} baseline for this route.`
      : `Cached traffic from about ${cacheAgeMinutes} minute${cacheAgeMinutes === 1 ? '' : 's'} ago is ${formatRatio(trafficRatio)} the normal ${period} baseline for this route.`;
  }

  if (isDayOff) {
    return `It is a weekend or holiday, which usually lightens queues even when travel time is ${formatRatio(trafficRatio)} of the normal ${period} baseline.`;
  }

  return `Live travel time is ${formatRatio(trafficRatio)} the normal ${period} baseline for this route.`;
}

function buildAction(level: QueueLevel, recommendation: TravelRecommendation, waitEstimate: QueueWaitEstimate): string {
  if (recommendation.best_option === 'walk') {
    return recommendation.message;
  }

  if (level === 'very_high') {
    return `Expect roughly ${waitEstimate.likely_minutes} minutes of queueing. If flexible, wait for the rush to ease or use another way home.`;
  }

  if (level === 'high') {
    return `Expect roughly ${waitEstimate.likely_minutes} minutes of queueing. Leaving a bit earlier or later should help.`;
  }

  if (level === 'moderate') {
    return `Plan for about ${waitEstimate.likely_minutes} minutes of waiting before boarding.`;
  }

  return 'Queueing should stay short enough that riding is still the convenient option.';
}

export function buildMessage(input: MessageInput): QueueMessage {
  const confidence = getConfidence(input.source);
  const headlineByLevel: Record<QueueLevel, string> = {
    low: 'Queue looks light',
    moderate: 'Queue looks manageable',
    high: 'Queue is building',
    very_high: 'Queue is heavy',
  };

  const confidenceNoteByConfidence: Record<QueueConfidence, string> = {
    high: 'Based on live traffic data.',
    medium: 'Based on recent cached traffic data.',
    low: 'Based on historical fallback data.',
  };

  return {
    headline: headlineByLevel[input.level],
    reason: buildReason(input),
    action: buildAction(input.level, input.recommendation, input.waitEstimate),
    confidence_note: confidenceNoteByConfidence[confidence],
  };
}
