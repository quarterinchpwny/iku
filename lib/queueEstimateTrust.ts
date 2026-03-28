export type QueueTrustTone = 'critical' | 'muted' | 'strong' | 'warning';

type QueueEstimateLike = {
  computed_at?: string | null;
  level?: string | null;
  message?: {
    action?: string | null;
    confidence_note?: string | null;
  } | null;
  meta?: {
    confidence?: string | null;
    degraded?: boolean;
    degraded_reason?: string | null;
    cache?: {
      age_ms?: number | null;
      hit?: boolean;
    } | null;
  } | null;
  recommendation?: {
    best_option?: string | null;
    message?: string | null;
    ride_total_minutes?: number | null;
    time_saved_minutes?: number | null;
    walk_total_minutes?: number | null;
  } | null;
  signals?: {
    traffic?: {
      source?: string | null;
    } | null;
  } | null;
  wait_minutes_estimate?: {
    likely_minutes?: number | null;
  } | null;
} | null | undefined;

export type QueueTrustState = {
  detail: string;
  label: string;
  tone: QueueTrustTone;
};

function normalizeSource(source: string | null | undefined): 'historical_fallback' | 'routing_cache' | 'routing_live' | 'unknown' {
  if (source === 'routing_live' || source === 'ors_live') return 'routing_live';
  if (source === 'routing_cache' || source === 'ors_cache') return 'routing_cache';
  if (source === 'historical_fallback') return 'historical_fallback';
  return 'unknown';
}

function normalizeConfidence(confidence: string | null | undefined): 'high' | 'low' | 'medium' | 'unknown' {
  if (confidence === 'high' || confidence === 'medium' || confidence === 'low') return confidence;
  return 'unknown';
}

function formatRelativeAge(ageMs: number | null | undefined): string {
  if (typeof ageMs !== 'number' || !Number.isFinite(ageMs) || ageMs <= 0) {
    return 'just now';
  }

  const totalMinutes = Math.max(1, Math.round(ageMs / 60000));
  if (totalMinutes < 60) {
    return `${totalMinutes} min old`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!minutes) {
    return `${hours} hr old`;
  }

  return `${hours} hr ${minutes} min old`;
}

function formatComputedAt(value: string | null | undefined): string {
  if (!value) return 'just now';

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 'just now';

  return new Date(parsed).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function describeDegradedReason(reason: string | null | undefined): string {
  if (reason === 'missing_routing_config') {
    return 'Routing is not configured for this route yet.';
  }

  if (reason === 'routing_invalid_response') {
    return 'The routing provider returned invalid data, so this estimate fell back.';
  }

  if (reason === 'routing_request_failed') {
    return 'Live routing failed, so this estimate fell back to the usual corridor pattern.';
  }

  return 'Live routing is unavailable right now, so this estimate is using fallback logic.';
}

function deriveConfidence(estimate: QueueEstimateLike): 'high' | 'low' | 'medium' {
  const source = normalizeSource(estimate?.signals?.traffic?.source);
  if (estimate?.meta?.degraded || source === 'historical_fallback') return 'low';
  if (source === 'routing_cache') return 'medium';
  return 'high';
}

export function buildQueueSignalState(estimate: QueueEstimateLike): QueueTrustState {
  if (!estimate) {
    return {
      detail: 'Pick a route to load its current commute signal.',
      label: 'Signal unavailable',
      tone: 'muted',
    };
  }

  const source = normalizeSource(estimate.signals?.traffic?.source);
  const computedAt = formatComputedAt(estimate.computed_at);
  const cacheAge = formatRelativeAge(estimate.meta?.cache?.age_ms);

  if (estimate.meta?.degraded || source === 'historical_fallback') {
    return {
      detail: `${describeDegradedReason(estimate.meta?.degraded_reason)} Updated ${computedAt}.`,
      label: 'Fallback estimate',
      tone: 'critical',
    };
  }

  if (source === 'routing_cache') {
    return {
      detail: `Using recent routing data that is ${cacheAge}. Re-scored with current route context.`,
      label: 'Cached route signal',
      tone: 'warning',
    };
  }

  return {
    detail: `Live routing was scored at ${computedAt} with the current route context.`,
    label: 'Live route signal',
    tone: 'strong',
  };
}

export function buildQueueConfidenceState(estimate: QueueEstimateLike): QueueTrustState {
  if (!estimate) {
    return {
      detail: 'Confidence appears after the first route estimate loads.',
      label: 'No confidence yet',
      tone: 'muted',
    };
  }

  const confidence = normalizeConfidence(estimate.meta?.confidence) === 'unknown'
    ? deriveConfidence(estimate)
    : normalizeConfidence(estimate.meta?.confidence);
  const note = String(estimate.message?.confidence_note || '').trim();

  return {
    detail: note || 'Confidence is based on routing freshness and the supporting context signals.',
    label: `${confidence.charAt(0).toUpperCase()}${confidence.slice(1)} confidence`,
    tone: {
      high: 'strong',
      medium: 'warning',
      low: 'critical',
    }[confidence],
  };
}

export function buildQueueDepartureCall(estimate: QueueEstimateLike): QueueTrustState {
  if (!estimate) {
    return {
      detail: 'Choose a saved route to get a timing recommendation.',
      label: 'No timing call yet',
      tone: 'muted',
    };
  }

  const recommendation = estimate.recommendation;
  const bestOption = recommendation?.best_option;
  const likelyWait = Number(estimate.wait_minutes_estimate?.likely_minutes);
  const waitLabel = Number.isFinite(likelyWait) ? `about ${Math.round(likelyWait)} min of queueing` : 'the current queue pattern';

  if (estimate.meta?.degraded || normalizeSource(estimate.signals?.traffic?.source) === 'historical_fallback') {
    return {
      detail: `This timing call is leaning on fallback traffic, so treat ${waitLabel} as a cautious estimate.`,
      label: 'Check again soon',
      tone: 'critical',
    };
  }

  if (bestOption === 'walk') {
    return {
      detail: recommendation?.message || 'Walking currently beats waiting in the queue.',
      label: 'Walk now',
      tone: 'strong',
    };
  }

  if (bestOption === 'either') {
    return {
      detail: recommendation?.message || 'Both options are close enough that timing is flexible.',
      label: 'Leave when ready',
      tone: 'muted',
    };
  }

  if (estimate.level === 'very_high') {
    return {
      detail: `Expect ${waitLabel}. If you can move your departure, waiting 15-20 minutes should help.`,
      label: 'Delay 15-20 min if flexible',
      tone: 'critical',
    };
  }

  if (estimate.level === 'high') {
    return {
      detail: `Expect ${waitLabel}. If your schedule allows it, a 10-15 minute delay should help.`,
      label: 'Delay 10-15 min if flexible',
      tone: 'warning',
    };
  }

  return {
    detail: recommendation?.message || `Current signal suggests ${waitLabel}, but the route is still worth taking now.`,
    label: 'Leave now',
    tone: 'strong',
  };
}

export function queueTrustPanelClass(tone: QueueTrustTone): string {
  return {
    strong: 'border-emerald-900 bg-emerald-950/70',
    warning: 'border-amber-900 bg-amber-950/50',
    critical: 'border-rose-900 bg-rose-950/50',
    muted: 'border-zinc-800 bg-zinc-950',
  }[tone];
}

export function queueTrustLabelClass(tone: QueueTrustTone): string {
  return {
    strong: 'text-emerald-300',
    warning: 'text-amber-300',
    critical: 'text-rose-300',
    muted: 'text-zinc-300',
  }[tone];
}
