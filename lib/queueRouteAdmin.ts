export function trimQueueRouteApiBase(value: string): string {
  return value.replace(/\/+$/, '');
}

export function slugifyQueueRouteKey(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
