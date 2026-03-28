type QueueRouteOption = {
  is_default?: boolean;
  route_key: string;
};

const selectedRouteStorageKey = 'iku.queue.selectedRoute';
const presetsStorageKey = 'iku.queue.presets';
const selectedPresetStorageKey = 'iku.queue.selectedPreset';

export type QueueCommutePreset = {
  created_at: number;
  id: string;
  is_default: boolean;
  label: string;
  route_key: string;
  updated_at: number;
};

function canUseStorage(): boolean {
  return import.meta.client;
}

function createPresetId(): string {
  if (canUseStorage() && typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizePreset(value: unknown): QueueCommutePreset | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<QueueCommutePreset>;
  const id = String(candidate.id || '').trim();
  const label = String(candidate.label || '').trim();
  const routeKey = String(candidate.route_key || '').trim();
  const createdAt = Number(candidate.created_at);
  const updatedAt = Number(candidate.updated_at);

  if (!id || !label || !routeKey) {
    return null;
  }

  return {
    created_at: Number.isFinite(createdAt) ? createdAt : Date.now(),
    id,
    is_default: Boolean(candidate.is_default),
    label,
    route_key: routeKey,
    updated_at: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
  };
}

export function readStoredQueueRouteKey(): string {
  if (!canUseStorage()) return '';
  return String(localStorage.getItem(selectedRouteStorageKey) || '').trim();
}

export function storeQueueRouteKey(value: string): void {
  if (!canUseStorage()) return;
  if (!value) {
    localStorage.removeItem(selectedRouteStorageKey);
    return;
  }

  localStorage.setItem(selectedRouteStorageKey, value);
}

export function readStoredQueuePresets(): QueueCommutePreset[] {
  if (!canUseStorage()) return [];

  try {
    const raw = localStorage.getItem(presetsStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizePreset).filter((preset): preset is QueueCommutePreset => preset !== null);
  } catch {
    return [];
  }
}

export function storeQueuePresets(presets: QueueCommutePreset[]): void {
  if (!canUseStorage()) return;

  if (!presets.length) {
    localStorage.removeItem(presetsStorageKey);
    return;
  }

  localStorage.setItem(presetsStorageKey, JSON.stringify(presets));
}

export function readStoredQueuePresetId(): string {
  if (!canUseStorage()) return '';
  return String(localStorage.getItem(selectedPresetStorageKey) || '').trim();
}

export function storeQueuePresetId(value: string): void {
  if (!canUseStorage()) return;

  if (!value) {
    localStorage.removeItem(selectedPresetStorageKey);
    return;
  }

  localStorage.setItem(selectedPresetStorageKey, value);
}

export function sanitizeQueuePresets<T extends QueueRouteOption>(
  routes: T[],
  presets: QueueCommutePreset[],
): QueueCommutePreset[] {
  const validRouteKeys = new Set(routes.map((route) => route.route_key));
  let defaultAssigned = false;

  return presets
    .filter((preset) => validRouteKeys.has(preset.route_key))
    .map((preset) => {
      const normalized = {
        ...preset,
        label: preset.label.trim(),
        route_key: preset.route_key.trim(),
      };

      if (!defaultAssigned && normalized.is_default) {
        defaultAssigned = true;
        return normalized;
      }

      if (normalized.is_default) {
        return { ...normalized, is_default: false };
      }

      return normalized;
    });
}

export function saveQueuePreset(
  presets: QueueCommutePreset[],
  input: { id?: string; is_default?: boolean; label: string; route_key: string },
): { preset: QueueCommutePreset; presets: QueueCommutePreset[] } | null {
  const label = String(input.label || '').trim();
  const routeKey = String(input.route_key || '').trim();

  if (!label || !routeKey) {
    return null;
  }

  const now = Date.now();
  const existingIndex = presets.findIndex((preset) => preset.id === input.id);
  const basePreset: QueueCommutePreset = existingIndex >= 0
    ? {
        ...presets[existingIndex],
        label,
        route_key: routeKey,
        is_default: Boolean(input.is_default),
        updated_at: now,
      }
    : {
        created_at: now,
        id: createPresetId(),
        is_default: Boolean(input.is_default),
        label,
        route_key: routeKey,
        updated_at: now,
      };

  const nextPresets = existingIndex >= 0
    ? presets.map((preset, index) => (index === existingIndex ? basePreset : preset))
    : [...presets, basePreset];

  const normalizedPresets = !basePreset.is_default
    ? nextPresets
    : nextPresets.map((preset) =>
    preset.id === basePreset.id ? preset : { ...preset, is_default: false }
  );

  const savedPreset = normalizedPresets.find((preset) => preset.id === basePreset.id) ?? basePreset;

  return {
    preset: savedPreset,
    presets: normalizedPresets,
  };
}

export function removeQueuePreset(presets: QueueCommutePreset[], presetId: string): QueueCommutePreset[] {
  return presets.filter((preset) => preset.id !== presetId);
}

export function resolveSelectedQueuePreset<T extends QueueRouteOption>(
  routes: T[],
  presets: QueueCommutePreset[],
  preferredPresetId = '',
): QueueCommutePreset | null {
  const storedPresetId = readStoredQueuePresetId();
  const requestedId = preferredPresetId || storedPresetId;
  const validPresets = sanitizeQueuePresets(routes, presets);
  const requested = validPresets.find((preset) => preset.id === requestedId);

  if (requested) {
    return requested;
  }

  return validPresets.find((preset) => preset.is_default) ?? null;
}

export function resolveSelectedQueueRouteKey<T extends QueueRouteOption>(
  routes: T[],
  preferred = '',
  presets: QueueCommutePreset[] = [],
  preferredPresetId = '',
): string {
  const selectedPreset = resolveSelectedQueuePreset(routes, presets, preferredPresetId);
  if (selectedPreset) {
    return selectedPreset.route_key;
  }

  const stored = readStoredQueueRouteKey();
  const requested = preferred || stored;
  const matching = routes.find((route) => route.route_key === requested);
  return matching?.route_key ?? routes.find((route) => route.is_default)?.route_key ?? routes[0]?.route_key ?? '';
}
