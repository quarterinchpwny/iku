type QueueRouteOption = {
  is_default?: boolean;
  route_key: string;
};

const selectedRouteStorageKey = 'iku.queue.selectedRoute';

export function readStoredQueueRouteKey(): string {
  if (!import.meta.client) return '';
  return String(localStorage.getItem(selectedRouteStorageKey) || '').trim();
}

export function storeQueueRouteKey(value: string): void {
  if (!import.meta.client) return;
  if (!value) {
    localStorage.removeItem(selectedRouteStorageKey);
    return;
  }

  localStorage.setItem(selectedRouteStorageKey, value);
}

export function resolveSelectedQueueRouteKey<T extends QueueRouteOption>(
  routes: T[],
  preferred = ''
): string {
  const stored = readStoredQueueRouteKey();
  const requested = preferred || stored;
  const matching = routes.find((route) => route.route_key === requested);
  return matching?.route_key ?? routes.find((route) => route.is_default)?.route_key ?? routes[0]?.route_key ?? '';
}
