import type { QueuePersonalizationInput } from './types';

const MAX_ACCESS_MINUTES = 180;
const MAX_WALK_MINUTES = 300;

export const defaultQueuePersonalization: QueuePersonalizationInput = {
  access_minutes: 0,
  egress_minutes: 0,
  max_walk_minutes: null,
};

function parseMinuteValue(value: string | undefined, max: number): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.round(parsed), max));
}

function parseOptionalMinuteValue(value: string | undefined, max: number): number | null {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.max(1, Math.min(Math.round(parsed), max));
}

export function normalizeQueuePersonalization(
  input: Partial<QueuePersonalizationInput> | null | undefined,
): QueuePersonalizationInput {
  return {
    access_minutes: parseMinuteValue(String(input?.access_minutes ?? 0), MAX_ACCESS_MINUTES),
    egress_minutes: parseMinuteValue(String(input?.egress_minutes ?? 0), MAX_ACCESS_MINUTES),
    max_walk_minutes: parseOptionalMinuteValue(
      input?.max_walk_minutes == null ? undefined : String(input.max_walk_minutes),
      MAX_WALK_MINUTES,
    ),
  };
}

export function readRequestedQueuePersonalization(
  accessMinutes: string | undefined,
  egressMinutes: string | undefined,
  maxWalkMinutes: string | undefined,
): QueuePersonalizationInput {
  return normalizeQueuePersonalization({
    access_minutes: parseMinuteValue(accessMinutes, MAX_ACCESS_MINUTES),
    egress_minutes: parseMinuteValue(egressMinutes, MAX_ACCESS_MINUTES),
    max_walk_minutes: parseOptionalMinuteValue(maxWalkMinutes, MAX_WALK_MINUTES),
  });
}

export function readRequestedQueuePersonalizations(value: string | undefined): Record<string, QueuePersonalizationInput> {
  const entries = String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return entries.reduce<Record<string, QueuePersonalizationInput>>((result, entry) => {
    const [routeKey, accessMinutes, egressMinutes, maxWalkMinutes] = entry.split(':');

    if (!routeKey || !/^[a-z0-9-]{3,64}$/.test(routeKey)) {
      return result;
    }

    result[routeKey] = readRequestedQueuePersonalization(accessMinutes, egressMinutes, maxWalkMinutes);
    return result;
  }, {});
}
