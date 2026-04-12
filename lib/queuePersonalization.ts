export type QueueRoutePersonalization = {
  access_minutes: number;
  egress_minutes: number;
  max_walk_minutes: number | null;
};

type QueueRoutePersonalizationMap = Record<string, QueueRoutePersonalization>;

const queuePersonalizationStorageKey = 'iku.queue.personalization';
const MAX_ACCESS_MINUTES = 180;
const MAX_WALK_MINUTES = 300;

export function defaultQueuePersonalization(): QueueRoutePersonalization {
  return {
    access_minutes: 0,
    egress_minutes: 0,
    max_walk_minutes: null,
  };
}

function clampMinuteValue(value: unknown, max: number): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.round(parsed), max));
}

function clampOptionalMinuteValue(value: unknown, max: number): number | null {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.max(1, Math.min(Math.round(parsed), max));
}

export function normalizeQueuePersonalization(value: Partial<QueueRoutePersonalization> | null | undefined): QueueRoutePersonalization {
  return {
    access_minutes: clampMinuteValue(value?.access_minutes, MAX_ACCESS_MINUTES),
    egress_minutes: clampMinuteValue(value?.egress_minutes, MAX_ACCESS_MINUTES),
    max_walk_minutes: clampOptionalMinuteValue(value?.max_walk_minutes, MAX_WALK_MINUTES),
  };
}

export function isDefaultQueuePersonalization(value: QueueRoutePersonalization | null | undefined): boolean {
  return !value
    || (value.access_minutes === 0 && value.egress_minutes === 0 && value.max_walk_minutes == null);
}

export function readStoredQueuePersonalizations(): QueueRoutePersonalizationMap {
  if (!import.meta.client) {
    return {};
  }

  try {
    const raw = localStorage.getItem(queuePersonalizationStorageKey);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return Object.entries(parsed).reduce<QueueRoutePersonalizationMap>((result, [routeKey, value]) => {
      if (!/^[a-z0-9-]{3,64}$/.test(routeKey)) {
        return result;
      }

      const normalized = normalizeQueuePersonalization(value as Partial<QueueRoutePersonalization>);
      if (isDefaultQueuePersonalization(normalized)) {
        return result;
      }

      result[routeKey] = normalized;
      return result;
    }, {});
  } catch {
    return {};
  }
}

export function storeQueuePersonalizations(value: QueueRoutePersonalizationMap): void {
  if (!import.meta.client) {
    return;
  }

  const filtered = Object.entries(value).reduce<QueueRoutePersonalizationMap>((result, [routeKey, personalization]) => {
    const normalized = normalizeQueuePersonalization(personalization);
    if (isDefaultQueuePersonalization(normalized)) {
      return result;
    }

    result[routeKey] = normalized;
    return result;
  }, {});

  if (!Object.keys(filtered).length) {
    localStorage.removeItem(queuePersonalizationStorageKey);
    return;
  }

  localStorage.setItem(queuePersonalizationStorageKey, JSON.stringify(filtered));
}

export function sanitizeQueuePersonalizations(
  routes: Array<{ route_key: string }>,
  value: QueueRoutePersonalizationMap,
): QueueRoutePersonalizationMap {
  const validRouteKeys = new Set(routes.map((route) => route.route_key));
  return Object.entries(value).reduce<QueueRoutePersonalizationMap>((result, [routeKey, personalization]) => {
    if (!validRouteKeys.has(routeKey)) {
      return result;
    }

    const normalized = normalizeQueuePersonalization(personalization);
    if (isDefaultQueuePersonalization(normalized)) {
      return result;
    }

    result[routeKey] = normalized;
    return result;
  }, {});
}

export function resolveQueuePersonalization(
  routeKey: string | null | undefined,
  personalizations: QueueRoutePersonalizationMap,
): QueueRoutePersonalization {
  if (!routeKey) {
    return defaultQueuePersonalization();
  }

  return normalizeQueuePersonalization(personalizations[routeKey]);
}

export function saveQueuePersonalization(
  value: QueueRoutePersonalizationMap,
  routeKey: string,
  personalization: Partial<QueueRoutePersonalization>,
): QueueRoutePersonalizationMap {
  const normalized = normalizeQueuePersonalization(personalization);

  if (isDefaultQueuePersonalization(normalized)) {
    const { [routeKey]: _omitted, ...rest } = value;
    return rest;
  }

  return {
    ...value,
    [routeKey]: normalized,
  };
}

export function clearQueuePersonalization(
  value: QueueRoutePersonalizationMap,
  routeKey: string,
): QueueRoutePersonalizationMap {
  const { [routeKey]: _omitted, ...rest } = value;
  return rest;
}

export function buildEstimatePersonalizationParams(personalization: QueueRoutePersonalization): Record<string, string> {
  return {
    accessMinutes: personalization.access_minutes ? String(personalization.access_minutes) : '',
    egressMinutes: personalization.egress_minutes ? String(personalization.egress_minutes) : '',
    maxWalkMinutes: personalization.max_walk_minutes ? String(personalization.max_walk_minutes) : '',
  };
}

export function buildComparisonAdjustmentParam(
  routeKeys: string[],
  personalizations: QueueRoutePersonalizationMap,
): string {
  return routeKeys
    .map((routeKey) => {
      const personalization = normalizeQueuePersonalization(personalizations[routeKey]);
      if (isDefaultQueuePersonalization(personalization)) {
        return '';
      }

      return [
        routeKey,
        personalization.access_minutes,
        personalization.egress_minutes,
        personalization.max_walk_minutes ?? '',
      ].join(':');
    })
    .filter(Boolean)
    .join(',');
}
