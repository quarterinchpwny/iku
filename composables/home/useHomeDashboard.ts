import { computed, onMounted, ref, watch } from 'vue';
import { usePedometerStore } from '~/stores/pedometer';
import { useGeolocationStore } from '~/stores/geolocation';
import { useWaitForAuth } from '~/composables/useWaitForAuth';
import { syncPassiveFromPluginToDexie } from '~/composables/passive/syncPluginPassiveToDexie';
import { syncDownFromCloudflare } from '~/db';
import { buildTimelineDays, formatPlaceName, type PlaceRecord, type TimelineSegment } from '~/lib/places';
import { buildDayStats, buildTimelineRows } from '~/lib/placeTimelineRows';
import { usePlaceDataSource } from '~/composables/home/usePlaceDataSource';

export function useHomeDashboard() {
  const pedometerStore = usePedometerStore();
  const geoStore = useGeolocationStore();
  const waitForAuth = useWaitForAuth();
  const placeDataSource = usePlaceDataSource();

  const timelineSegments = ref<TimelineSegment[]>([]);
  const topPlaces = ref<PlaceRecord[]>([]);
  const dashboardTimelineDayKey = ref('');
  const isHydrating = ref(true);
  const isCloudSyncing = ref(false);
  const pageError = ref('');
  const syncIssue = ref('');
  const lastPluginRefreshAt = ref(0);
  const lastCloudRefreshAt = ref(0);
  const savingPlaceKey = ref('');

  const passiveDayTimeline = computed(() => buildTimelineDays(timelineSegments.value));

  const dashboardTimelineActiveDay = computed<any | null>(() => {
    const days = passiveDayTimeline.value;
    if (!days.length) return null;
    return days.find((day) => day.dayKey === dashboardTimelineDayKey.value) || days[0];
  });

  const dashboardTimelineRows = computed(() => buildTimelineRows(dashboardTimelineActiveDay.value));
  const dashboardTimelineStats = computed(() => buildDayStats(dashboardTimelineActiveDay.value));

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
    return `${dashboardTimelineStats.value.placeCount} places and ${dashboardTimelineStats.value.tripCount} trips were detected across ${dashboardTimelineStats.value.durationLabel}. ${dominantPlaceLabel()} is the most meaningful stop in view.`;
  });

  const overviewStats = computed(() => [
    {
      label: 'First Stop',
      value: firstPlaceLabel(),
      detail: dashboardTimelineRows.value.find((row: any) => row.segmentType === 'place')?.rangeLabel || 'No place visit yet'
    },
    {
      label: 'Last Stop',
      value: lastPlaceLabel(),
      detail: [...dashboardTimelineRows.value].reverse().find((row: any) => row.segmentType === 'place')?.rangeLabel || 'No recent stop yet'
    },
    {
      label: 'Primary Place',
      value: dominantPlaceLabel(),
      detail: `${dashboardTimelineStats.value.placeCount} place visits`
    },
    {
      label: 'Coverage',
      value: dashboardTimelineStats.value.durationLabel,
      detail: `${dashboardTimelineActiveDay.value?.segmentCount || 0} timeline segments`
    }
  ]);

  const stepValue = computed(() => {
    if (!pedometerStore.isSupported) return 'Unavailable';
    if (!pedometerStore.supportsHistory) return pedometerStore.isTracking ? pedometerStore.steps.toLocaleString() : 'Live only';
    return pedometerStore.steps.toLocaleString();
  });

  const stepDetail = computed(() => {
    if (!pedometerStore.isSupported) return 'Device not supported';
    if (!pedometerStore.supportsHistory) {
      return pedometerStore.platform === 'android'
        ? 'Capgo Android exposes live session steps only'
        : 'Historical step query unavailable';
    }
    return 'Today';
  });

  const statusItems = computed(() => [
    {
      label: 'Steps',
      value: stepValue.value,
      detail: stepDetail.value
    },
    {
      label: 'Base',
      value: geoStore.isAtHome ? 'Home' : 'Away',
      detail: geoStore.currentPosition
        ? `${Number(geoStore.currentPosition.lat).toFixed(3)}, ${Number(geoStore.currentPosition.lng).toFixed(3)}`
        : 'No fix yet'
    },
    {
      label: 'Places',
      value: String(dashboardTimelineStats.value.placeCount || 0),
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

  function dominantPlaceLabel() {
    if (!topPlaces.value.length) return '--';
    return formatPlaceName(topPlaces.value[0].labelName, topPlaces.value[0].autoLabel);
  }

  function firstPlaceLabel() {
    const placeRow = dashboardTimelineRows.value.find((row: any) => row.segmentType === 'place');
    return placeRow?.title || '--';
  }

  function lastPlaceLabel() {
    const placeRow = [...dashboardTimelineRows.value].reverse().find((row: any) => row.segmentType === 'place');
    return placeRow?.title || '--';
  }

  function setSnapshot(segments: TimelineSegment[], places: PlaceRecord[]) {
    timelineSegments.value = segments;
    topPlaces.value = places.slice(0, 6);
  }

  function timelineWindow() {
    const toMs = Date.now();
    return {
      fromMs: toMs - 7 * 24 * 60 * 60 * 1000,
      toMs
    };
  }

  async function renamePlace(placeKey: string, name: string) {
    const place = topPlaces.value.find((entry) => entry.key === placeKey);
    if (!place) return;
    savingPlaceKey.value = placeKey;
    try {
      await placeDataSource.renamePlace(place, name);
      const nextName = String(name || '').trim();
      if (!nextName) return;
      topPlaces.value = topPlaces.value.map((entry) =>
        entry.key === placeKey ? { ...entry, labelName: nextName } : entry
      );
      timelineSegments.value = timelineSegments.value.map((segment) => {
        if (segment.segmentType !== 'place') return segment;
        if (segment.source !== place.source || segment.labelId !== place.id) return segment;
        return { ...segment, labelName: nextName };
      });
    } finally {
      savingPlaceKey.value = '';
    }
  }

  async function hydrateStepCount() {
    await pedometerStore.checkSupport();
    if (!pedometerStore.isSupported || !pedometerStore.supportsHistory) return;
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
      const { fromMs, toMs } = timelineWindow();
      const localSnapshot = await placeDataSource.loadLocalSnapshot(fromMs, toMs);
      if (localSnapshot.segments.length || localSnapshot.places.length) {
        setSnapshot(localSnapshot.segments, localSnapshot.places);
      }
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
      const { fromMs, toMs } = timelineWindow();
      const remoteSnapshot = await placeDataSource.loadRemoteSnapshot(fromMs, toMs);
      if (remoteSnapshot.segments.length || remoteSnapshot.places.length) {
        setSnapshot(remoteSnapshot.segments, remoteSnapshot.places);
      }
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
    topPlaces,
    savingPlaceKey,
    selectDashboardTimelineDay,
    renamePlace
  };
}
