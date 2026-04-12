import { computed, onMounted, ref } from 'vue';
import { db } from '@/db/index.js';
import { syncPassiveFromPluginToDexie } from '~/composables/passive/syncPluginPassiveToDexie';

type PassiveRow = {
  acc?: number;
  provider?: string;
  route_id?: number;
  timestamp?: number;
  trigger?: string;
  uploadedAt?: number;
  lat?: number;
  lng?: number;
};

type RouteSnapshot = {
  distanceLabel: string;
  durationLabel: string;
  lastFixLabel: string;
  path: string;
  pointCountLabel: string;
  providerLabel: string;
  routeLabel: string;
  statusLabel: string;
  timeWindowLabel: string;
};

export function useHomeCurrentRoute() {
  const route = ref<RouteSnapshot | null>(null);
  const isLoading = ref(true);
  const error = ref('');

  const hasRoute = computed(() => route.value !== null);

  async function refreshRoute() {
    try {
      isLoading.value = true;
      error.value = '';
      await syncPassiveFromPluginToDexie().catch(() => ({ total: 0 }));
      const allRows = ((await db.passive_locations.toArray()) || []) as PassiveRow[];
      const validRows = allRows
        .filter(
          (row) =>
            Number.isFinite(Number(row?.route_id)) &&
            Number.isFinite(Number(row?.timestamp)) &&
            Number.isFinite(Number(row?.lat)) &&
            Number.isFinite(Number(row?.lng))
        )
        .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
      if (!validRows.length) {
        route.value = null;
        return;
      }
      const latestRow = validRows[validRows.length - 1];
      const routeId = Number(latestRow.route_id);
      const routeRows = validRows.filter((row) => Number(row.route_id) === routeId);
      route.value = buildRouteSnapshot(routeRows);
    } catch (caughtError: unknown) {
      error.value = caughtError instanceof Error ? caughtError.message : 'Unable to load route';
    } finally {
      isLoading.value = false;
    }
  }

  onMounted(refreshRoute);

  return {
    error,
    hasRoute,
    isLoading,
    refreshRoute,
    route
  };
}

function buildRouteSnapshot(rows: PassiveRow[]): RouteSnapshot {
  const sorted = [...rows].sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  const start = Number(sorted[0]?.timestamp || 0);
  const end = Number(sorted[sorted.length - 1]?.timestamp || 0);
  const distanceMeters = pathDistanceMeters(sorted);
  const provider = String(sorted[sorted.length - 1]?.provider || '').trim();
  const acc = Number(sorted[sorted.length - 1]?.acc || 0);
  const ageMinutes = (Date.now() - end) / 60000;
  return {
    distanceLabel: formatDistance(distanceMeters),
    durationLabel: formatDuration(end - start),
    lastFixLabel: ageMinutes < 1 ? 'Just now' : `${Math.round(ageMinutes)} min ago`,
    path: buildPath(sorted),
    pointCountLabel: `${sorted.length} samples`,
    providerLabel: provider ? `${provider} · ${Math.round(acc || 0)}m acc` : `${Math.round(acc || 0)}m acc`,
    routeLabel: ageMinutes <= 45 ? 'Current route travelled' : 'Latest route travelled',
    statusLabel: ageMinutes <= 45 ? 'Tracking now' : formatRouteDay(start),
    timeWindowLabel: `${formatClock(start)} - ${formatClock(end)}`
  };
}

function pathDistanceMeters(rows: PassiveRow[]) {
  let total = 0;
  for (let index = 1; index < rows.length; index += 1) {
    total += haversineMeters(rows[index - 1], rows[index]);
  }
  return total;
}

function haversineMeters(a: PassiveRow, b: PassiveRow) {
  const lat1 = toRadians(Number(a.lat));
  const lat2 = toRadians(Number(b.lat));
  const dLat = lat2 - lat1;
  const dLng = toRadians(Number(b.lng) - Number(a.lng));
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const root =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 6371000 * 2 * Math.atan2(Math.sqrt(root), Math.sqrt(1 - root));
}

function buildPath(rows: PassiveRow[]) {
  if (rows.length < 2) return '';
  const xs = rows.map((row) => Number(row.lng));
  const ys = rows.map((row) => Number(row.lat));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX || 0.0001;
  const height = maxY - minY || 0.0001;
  return rows
    .map((row, index) => {
      const x = ((Number(row.lng) - minX) / width) * 100;
      const y = 56 - ((Number(row.lat) - minY) / height) * 56;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function formatDistance(distanceMeters: number) {
  return distanceMeters >= 1000
    ? `${(distanceMeters / 1000).toFixed(distanceMeters >= 10000 ? 0 : 1)} km`
    : `${Math.round(distanceMeters)} m`;
}

function formatDuration(durationMs: number) {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

function formatClock(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(timestamp));
}

function formatRouteDay(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(new Date(timestamp));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
