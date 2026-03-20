import { onMounted, ref, computed, watch } from 'vue';
import { usePedometerStore } from '~/stores/pedometer';
import { useGeolocationStore } from '~/stores/geolocation';
import { useWaitForAuth } from '~/composables/useWaitForAuth';
import { syncPassiveFromPluginToDexie } from '~/composables/passive/syncPluginPassiveToDexie';
import { buildLocalPassiveTimelineData, utcDayKeyFromTimestamp } from '@/composables/community/localPassiveRoutes';
import { db } from '@/db/index.js';
import { syncDownFromCloudflare } from '~/db';
import * as TimelineUtils from '~/lib/timeline';

export function useHomeDashboard() {
  const pedometerStore = usePedometerStore();
  const geoStore = useGeolocationStore();
  const waitForAuth = useWaitForAuth();

  const trackingRoutes = ref<any[]>([]);
  const trackingPoints = ref<any[]>([]);
  const passiveLocations = ref<any[]>([]);
  const dashboardTimelineDayKey = ref('');
  const isHydrating = ref(true);
  const isCloudSyncing = ref(false);
  const pageError = ref('');
  const syncIssue = ref('');
  const lastPluginRefreshAt = ref(0);
  const lastCloudRefreshAt = ref(0);

  const normalizedPassiveLocations = computed(() =>
    passiveLocations.value
      .map((row: any) => ({
        ...row,
        route_id: Number(row?.route_id ?? row?.routeId),
        lat: Number(row?.lat),
        lng: Number(row?.lng),
        timestamp: Number(row?.timestamp || 0)
      }))
      .filter(
        (row: any) =>
          Number.isFinite(row.route_id) &&
          Number.isFinite(row.lat) &&
          Number.isFinite(row.lng) &&
          Number.isFinite(row.timestamp) &&
          row.timestamp > 0
      )
  );

  const timelinePoints = computed(() => {
    const activePoints = trackingPoints.value.filter(
      (point: any) => String(point?.source || '').toUpperCase() !== 'PASSIVE'
    );
    const passivePoints = normalizedPassiveLocations.value.map((row: any) => ({
      lat: Number(row.lat),
      lng: Number(row.lng),
      timestamp: Number(row.timestamp || 0),
      routeId: Number(row.route_id),
      source: 'PASSIVE'
    }));
    return [...activePoints, ...passivePoints];
  });

  const routeSummaries = computed(() =>
    TimelineUtils.buildRouteSummaries(
      trackingRoutes.value,
      timelinePoints.value,
      normalizedPassiveLocations.value
    )
  );

  const passiveDayTimeline = computed(() => TimelineUtils.buildPassiveDayTimeline(routeSummaries.value));

  const dashboardTimelineActiveDay = computed(() => {
    const days = passiveDayTimeline.value;
    if (!days.length) return null;
    return days.find((day) => day.dayKey === dashboardTimelineDayKey.value) || days[0];
  });

  const dashboardTimelineActiveSegments = computed(() => {
    const day = dashboardTimelineActiveDay.value;
    if (!day?.routeIds?.length) return [];
    const points = day.routeIds
      .flatMap((routeId: number) => timelinePoints.value.filter((point) => Number(point.routeId) === Number(routeId)))
      .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
    return TimelineUtils.buildDayTripSegments(points);
  });

  const dashboardTimelineRows = computed(() =>
    dashboardTimelineActiveSegments.value.map((segment: any, index: number) => ({
      ...segment,
      timelineIndex: index + 1,
      startPlace: TimelineUtils.segmentStartPlace(segment.startStory),
      endPlace: TimelineUtils.segmentEndPlace(segment.endStory),
      mode: TimelineUtils.segmentTravelMode(segment),
      rangeLabel: `${segment.startTime} - ${segment.endTime}`,
      story: `${TimelineUtils.segmentTravelMode(segment)} movement over ${Math.round(Number(segment.displacementMeters || 0))}m`
    }))
  );

  const dashboardTimelineStats = computed(() => {
    const displacementMeters = dashboardTimelineActiveSegments.value.reduce(
      (sum: number, segment: any) => sum + Number(segment.displacementMeters || 0),
      0
    );
    const durationMs = dashboardTimelineActiveSegments.value.reduce(
      (sum: number, segment: any) => sum + Number(segment.durationMs || 0),
      0
    );
    return {
      tripCount: dashboardTimelineActiveSegments.value.length,
      displacementLabel: `${Math.round(displacementMeters)}m`,
      durationLabel: TimelineUtils.formatDurationLabel(durationMs)
    };
  });

  const activeDayPoints = computed(() =>
    dashboardTimelineActiveSegments.value.flatMap((segment: any) => segment.points || [])
  );

  const syncLabel = computed(() => {
    if (syncIssue.value) return syncIssue.value;
    if (isHydrating.value && !lastPluginRefreshAt.value) return 'Plugin loading';
    if (isCloudSyncing.value) return 'Plugin first, cloud syncing';
    if (lastCloudRefreshAt.value) return `Cloud merged ${formatAgeLabel(lastCloudRefreshAt.value)}`;
    if (lastPluginRefreshAt.value) return `Plugin live ${formatAgeLabel(lastPluginRefreshAt.value)}`;
    return 'Waiting';
  });

  const overviewHeading = computed(() =>
    dashboardTimelineActiveDay.value?.label ? `${dashboardTimelineActiveDay.value.label} At A Glance` : 'Today At A Glance'
  );

  const overviewSummary = computed(() => {
    if (!dashboardTimelineRows.value.length) return 'No movement story has been assembled yet.';
    return `${dashboardTimelineStats.value.tripCount} trips logged across ${dashboardTimelineStats.value.displacementLabel} with ${dashboardTimelineStats.value.durationLabel} of movement. ${dominantModeLabel()} is leading today.`;
  });

  const overviewStats = computed(() => [
    {
      label: 'First Move',
      value: dashboardTimelineRows.value[0]?.startTime || '--',
      detail: dashboardTimelineRows.value[0]?.startPlace || 'No origin yet'
    },
    {
      label: 'Last Move',
      value: dashboardTimelineRows.value[dashboardTimelineRows.value.length - 1]?.endTime || '--',
      detail: dashboardTimelineRows.value[dashboardTimelineRows.value.length - 1]?.endPlace || 'No destination yet'
    },
    {
      label: 'Primary Mode',
      value: dominantModeLabel(),
      detail: `${dashboardTimelineStats.value.tripCount} trip segments`
    },
    {
      label: 'Coverage',
      value: coverageLabel(),
      detail: `${dashboardTimelineActiveDay.value?.routeCount || 0} routes on this day`
    }
  ]);

  const statusItems = computed(() => [
    {
      label: 'Steps',
      value: pedometerStore.isSupported ? pedometerStore.steps.toLocaleString() : 'Unavailable',
      detail: pedometerStore.isSupported ? 'Today' : 'Device not supported'
    },
    {
      label: 'Base',
      value: geoStore.isAtHome ? 'Home' : 'Away',
      detail: geoStore.currentPosition
        ? `${Number(geoStore.currentPosition.lat).toFixed(3)}, ${Number(geoStore.currentPosition.lng).toFixed(3)}`
        : 'No fix yet'
    },
    {
      label: 'Routes',
      value: String(dashboardTimelineActiveDay.value?.routeCount || 0),
      detail: `${dashboardTimelineStats.value.tripCount} trips for ${dashboardTimelineActiveDay.value?.label || 'today'}`
    },
    {
      label: 'Feed',
      value: lastCloudRefreshAt.value ? 'Merged' : lastPluginRefreshAt.value ? 'Plugin' : 'Idle',
      detail: syncLabel.value
    }
  ]);

  function formatAgeLabel(timestamp: number) {
    const ageMs = Math.max(0, Date.now() - Number(timestamp || 0));
    if (ageMs < 60_000) return `${Math.floor(ageMs / 1000)}s ago`;
    if (ageMs < 3_600_000) return `${Math.floor(ageMs / 60_000)}m ago`;
    return `${Math.floor(ageMs / 3_600_000)}h ago`;
  }

  function dominantModeLabel() {
    if (!dashboardTimelineRows.value.length) return '--';
    const counts = new Map<string, number>();
    for (const row of dashboardTimelineRows.value) {
      counts.set(String(row.mode), (counts.get(String(row.mode)) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '--';
  }

  function coverageLabel() {
    if (activeDayPoints.value.length < 2) return '--';
    const start = Number(activeDayPoints.value[0]?.timestamp || 0);
    const end = Number(activeDayPoints.value[activeDayPoints.value.length - 1]?.timestamp || 0);
    if (!start || !end || end <= start) return '--';
    return TimelineUtils.formatDurationLabel(end - start);
  }

  async function fetchTimelineData() {
    const [routes, points, passive] = await Promise.all([
      db.routes.toArray(),
      db.points.toArray(),
      db.passive_locations.toArray()
    ]);
    const passiveDayKeys = new Set<string>();
    for (const row of passive) {
      const timestamp = Number(row?.timestamp || 0);
      if (Number.isFinite(timestamp) && timestamp > 0) passiveDayKeys.add(utcDayKeyFromTimestamp(timestamp));
    }
    for (const route of routes) {
      if (String(route?.source || '').toUpperCase() !== 'PASSIVE') continue;
      const timestamp = Number(route?.timestamp || 0);
      if (Number.isFinite(timestamp) && timestamp > 0) passiveDayKeys.add(utcDayKeyFromTimestamp(timestamp));
    }
    const localTimeline = await buildLocalPassiveTimelineData(passiveDayKeys);
    trackingRoutes.value = [...routes, ...localTimeline.routes];
    trackingPoints.value = [...points, ...localTimeline.points];
    passiveLocations.value = [...passive, ...localTimeline.passiveLocations];
  }

  async function hydrateStepCount() {
    await pedometerStore.checkSupport();
    if (!pedometerStore.isSupported) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    pedometerStore.steps = await pedometerStore.querySteps(today, new Date());
  }

  function selectDashboardTimelineDay(dayKey: string) {
    dashboardTimelineDayKey.value = String(dayKey || '');
  }

  watch(
    passiveDayTimeline,
    (days) => {
      if (!days.length) {
        dashboardTimelineDayKey.value = '';
        return;
      }
      if (!days.some((day) => day.dayKey === dashboardTimelineDayKey.value)) {
        dashboardTimelineDayKey.value = days[0].dayKey;
      }
    },
    { immediate: true }
  );

  onMounted(async () => {
    try {
      await waitForAuth();
      await Promise.all([syncPassiveFromPluginToDexie(), hydrateStepCount()]);
      await fetchTimelineData();
      lastPluginRefreshAt.value = Date.now();
      isHydrating.value = false;
      isCloudSyncing.value = true;
    } catch (err: any) {
      pageError.value = err?.message ? String(err.message) : 'Failed to load home dashboard';
      isHydrating.value = false;
      isCloudSyncing.value = false;
      return;
    }
    try {
      await syncDownFromCloudflare({ includeGeofences: false, scope: 'account' });
      await fetchTimelineData();
      lastCloudRefreshAt.value = Date.now();
    } catch (err: any) {
      syncIssue.value = err?.message ? `Cloud sync issue: ${String(err.message)}` : 'Cloud sync issue';
    } finally {
      isCloudSyncing.value = false;
    }
  });

  return {
    dashboardTimelineDayKey,
    isHydrating,
    pageError,
    passiveDayTimeline,
    dashboardTimelineActiveDay,
    dashboardTimelineRows,
    dashboardTimelineStats,
    syncLabel,
    overviewHeading,
    overviewSummary,
    overviewStats,
    statusItems,
    selectDashboardTimelineDay
  };
}
