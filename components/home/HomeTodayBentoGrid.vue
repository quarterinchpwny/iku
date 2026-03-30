<template>
  <section class="grid gap-4 md:grid-cols-2">
    <article
      class="rounded-[1rem] border border-white/10 bg-black/60 px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(255,255,255,0.05)] md:col-span-2"
    >
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
        <div class="space-y-2">
          <p class="text-sm font-semibold text-white">Today</p>
          <div class="flex flex-wrap items-end gap-3">
            <p class="text-3xl font-bold leading-none text-orange-400">{{ commute.durationLabel.value }}</p>
            <p class="pb-0.5 text-sm font-medium text-zinc-300">ETA {{ commute.etaLabel.value }}</p>
          </div>
          <p class="text-sm text-zinc-200">{{ currentRouteLabel }}</p>
          <p class="text-xs leading-5 text-zinc-400">{{ todayStripDetail }}</p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div class="rounded-[0.9rem] border border-white/10 bg-[#141414] px-3 py-3">
            <p class="text-[11px] font-medium text-zinc-500">Weather impact</p>
            <p class="mt-1 text-sm font-semibold text-white">{{ weatherImpactLabel }}</p>
            <p class="mt-1 text-[11px] text-zinc-500">{{ precipitationLabel }}</p>
          </div>
          <div class="rounded-[0.9rem] border border-white/10 bg-[#141414] px-3 py-3">
            <p class="text-[11px] font-medium text-zinc-500">Traffic vs usual</p>
            <p class="mt-1 text-sm font-semibold text-white">{{ trafficTrendLabel }}</p>
            <p class="mt-1 text-[11px] text-zinc-500">{{ trafficTrendDetail }}</p>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div class="rounded-[0.9rem] border px-3 py-3" :class="queueTrustPanelClass(commute.signalState.value.tone)">
            <p class="text-[11px] font-medium text-zinc-500">Freshness</p>
            <p class="mt-1 text-sm font-semibold" :class="queueTrustLabelClass(commute.signalState.value.tone)">
              {{ commute.signalState.value.label }}
            </p>
            <p class="mt-1 text-[11px] leading-5 text-zinc-300">{{ commute.signalState.value.detail }}</p>
          </div>
          <div class="rounded-[0.9rem] border px-3 py-3" :class="queueTrustPanelClass(commute.confidenceState.value.tone)">
            <p class="text-[11px] font-medium text-zinc-500">Confidence</p>
            <p class="mt-1 text-sm font-semibold" :class="queueTrustLabelClass(commute.confidenceState.value.tone)">
              {{ commute.confidenceState.value.label }}
            </p>
            <p class="mt-1 text-[11px] leading-5 text-zinc-300">{{ commute.confidenceState.value.detail }}</p>
          </div>
        </div>
      </div>
    </article>

    <article
      class="rounded-[1rem] border border-white/10 bg-black/60 px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(255,255,255,0.05)]"
    >
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-semibold text-white">Routines</p>
        <p class="text-[11px] text-zinc-500">One tap</p>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button
          v-for="routine in routines"
          :key="routine.id"
          type="button"
          class="rounded-[0.9rem] border px-3 py-3 text-left transition-colors"
          :class="routineCardClass(routine)"
          :disabled="!routine.target"
          @click="activateRoutine(routine)"
        >
          <p class="text-sm font-semibold">{{ routine.label }}</p>
          <p class="mt-1 text-[11px] leading-5 text-zinc-400">{{ routine.detail }}</p>
        </button>
      </div>
    </article>

    <article
      class="rounded-[1rem] border border-white/10 bg-black/60 px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(255,255,255,0.05)]"
    >
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-semibold text-white">Passive timeline</p>
        <p class="text-[11px] text-zinc-500">{{ dashboard.syncLabel.value }}</p>
      </div>
      <div class="mt-3 space-y-3">
        <div class="rounded-[0.9rem] border border-white/10 bg-[#141414] px-3 py-3">
          <p class="text-[11px] font-medium text-zinc-500">Last place</p>
          <p class="mt-1 text-sm font-semibold text-white">{{ lastPlaceLabel }}</p>
          <p class="mt-1 text-[11px] text-zinc-500">{{ lastPlaceDetail }}</p>
        </div>
        <div class="rounded-[0.9rem] border border-white/10 bg-[#141414] px-3 py-3">
          <div class="flex items-center justify-between gap-3">
            <p class="text-[11px] font-medium text-zinc-500">Last movement</p>
            <p class="text-[11px] font-medium text-orange-300">{{ passiveStateLabel }}</p>
          </div>
          <p class="mt-1 text-sm font-semibold text-white">{{ lastMovementLabel }}</p>
          <p class="mt-1 text-[11px] leading-5 text-zinc-500">{{ lastMovementDetail }}</p>
        </div>
      </div>
    </article>

    <article
      class="rounded-[1rem] border border-white/10 bg-black/60 px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(255,255,255,0.05)]"
    >
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-semibold text-white">Anomalies</p>
        <p class="text-[11px] text-zinc-500">{{ anomalies.length ? `${anomalies.length} active` : 'Clear' }}</p>
      </div>
      <div v-if="anomalies.length" class="mt-3 space-y-2">
        <div
          v-for="anomaly in anomalies"
          :key="anomaly.label"
          class="rounded-[0.9rem] border px-3 py-3"
          :class="anomalyClass(anomaly.tone)"
        >
          <p class="text-sm font-semibold text-white">{{ anomaly.label }}</p>
          <p class="mt-1 text-[11px] leading-5 text-zinc-300">{{ anomaly.detail }}</p>
        </div>
      </div>
      <div v-else class="mt-3 rounded-[0.9rem] border border-white/10 bg-[#141414] px-3 py-3">
        <p class="text-sm font-semibold text-white">Nothing unusual right now</p>
        <p class="mt-1 text-[11px] leading-5 text-zinc-500">
          Weather, queue wait, and routing freshness all look stable for the current trip.
        </p>
      </div>
    </article>

    <article
      class="rounded-[1rem] border border-white/10 bg-black/60 px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(255,255,255,0.05)] md:col-span-2"
    >
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-semibold text-white">Recent places</p>
        <p class="text-[11px] text-zinc-500">{{ recentPlaces.length ? `${recentPlaces.length} places` : 'No places yet' }}</p>
      </div>
      <div v-if="recentPlaces.length" class="mt-3 flex flex-wrap gap-2">
        <div
          v-for="place in recentPlaces"
          :key="place.key"
          class="min-w-[9rem] rounded-[0.9rem] border border-white/10 bg-[#141414] px-3 py-3"
        >
          <p class="text-sm font-semibold text-white">{{ place.label }}</p>
          <p class="mt-1 text-[11px] text-zinc-500">{{ place.detail }}</p>
        </div>
      </div>
      <div v-else class="mt-3 rounded-[0.9rem] border border-white/10 bg-[#141414] px-3 py-3">
        <p class="text-sm font-semibold text-white">No recent places yet</p>
        <p class="mt-1 text-[11px] leading-5 text-zinc-500">
          Place history will appear here once passive location segments are available.
        </p>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useHomeCommuteHero } from '~/composables/home/useHomeCommuteHero';
import { useHomeDashboard } from '~/composables/home/useHomeDashboard';
import { useHomeWeatherBento } from '~/composables/home/useHomeWeatherBento';
import { formatPlaceName } from '~/lib/places';
import { queueTrustLabelClass, queueTrustPanelClass } from '~/lib/queueEstimateTrust';

type RoutineTile = {
  active: boolean;
  detail: string;
  id: string;
  label: string;
  target: { presetId?: string; routeKey?: string } | null;
};

const props = defineProps<{
  commute?: ReturnType<typeof useHomeCommuteHero>;
  dashboard?: ReturnType<typeof useHomeDashboard>;
  weather?: ReturnType<typeof useHomeWeatherBento>;
}>();

const commute = props.commute ?? useHomeCommuteHero();
const dashboard = props.dashboard ?? useHomeDashboard();
const weather = props.weather ?? useHomeWeatherBento();

const safeHourlyItems = computed(() => {
  if (weather.isLoading.value || weather.error.value) return [];
  try {
    return weather.hourlyItems.value;
  } catch {
    return [];
  }
});

const safeConditionLabel = computed(() => {
  if (weather.isLoading.value || weather.error.value) return 'Weather settling';
  try {
    return weather.currentCondition.value.label;
  } catch {
    return 'Weather settling';
  }
});

const currentRouteLabel = computed(
  () => commute.selectedRoute.value?.label || commute.routeParts.value.title || 'No route selected'
);

const nextHourPrecipitation = computed(() => {
  const raw = safeHourlyItems.value[0]?.precipitationLabel || '';
  const parsed = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
});

const precipitationLabel = computed(() => {
  if (!safeHourlyItems.value.length) return 'No hourly weather yet';
  return `${nextHourPrecipitation.value}% rain chance next hour`;
});

const weatherImpactLabel = computed(() => {
  if (nextHourPrecipitation.value >= 60) return 'Rain likely on the next leg';
  if (nextHourPrecipitation.value >= 30) return 'Some weather friction likely';
  return `${safeConditionLabel.value} with light impact`;
});

const trafficTrendLabel = computed(() => {
  const ratio = Number(commute.estimate.value?.signals?.traffic?.ratio);
  const level = String(commute.estimate.value?.level || '').toLowerCase();
  if (Number.isFinite(ratio)) {
    if (ratio >= 1.35) return 'Worse than usual';
    if (ratio <= 1.05) return 'Better than usual';
    return 'Close to usual';
  }
  if (level === 'high' || level === 'very_high') return 'Worse than usual';
  if (level === 'low') return 'Better than usual';
  return 'Still settling';
});

const trafficTrendDetail = computed(() => {
  const ratio = Number(commute.estimate.value?.signals?.traffic?.ratio);
  if (Number.isFinite(ratio)) {
    return `${ratio.toFixed(2)}x corridor pressure`;
  }
  return commute.departureCall.value.detail;
});

const todayStripDetail = computed(() => {
  const action = commute.predictionMessages.value?.action;
  if (action) return action;
  return commute.departureCall.value.detail;
});

const anomalies = computed(() => {
  const items: Array<{ detail: string; label: string; tone: 'critical' | 'muted' | 'strong' | 'warning' }> = [];
  const likelyWait = Number(commute.estimate.value?.wait_minutes_estimate?.likely_minutes);
  const routeReason = String(
    commute.estimate.value?.message?.reason || commute.estimate.value?.message?.confidence_note || ''
  ).toLowerCase();

  if (nextHourPrecipitation.value >= 60) {
    items.push({
      detail: 'Rain is likely soon, so the next trip may run slower than the current dry baseline.',
      label: 'Rain building',
      tone: 'warning'
    });
  }

  if (commute.estimate.value?.meta?.degraded) {
    items.push({
      detail: commute.signalState.value.detail,
      label: 'Routing fallback',
      tone: 'critical'
    });
  }

  if (Number.isFinite(likelyWait) && likelyWait >= 20) {
    items.push({
      detail: `Queue wait is running at roughly ${Math.round(likelyWait)} minutes right now.`,
      label: 'Queue running long',
      tone: 'warning'
    });
  }

  if (routeReason.includes('holiday')) {
    items.push({
      detail: 'This estimate is being shaped by a holiday-aligned observation pattern.',
      label: 'Holiday pattern',
      tone: 'muted'
    });
  }

  if (!items.length && commute.estimate.value?.level === 'very_high') {
    items.push({
      detail: 'Current corridor pressure is elevated even without a specific incident flag.',
      label: 'Heavy corridor',
      tone: 'warning'
    });
  }

  return items.slice(0, 3);
});

const latestTimelineRow = computed(() => {
  const rows = dashboard.dashboardTimelineRows.value;
  return rows.length ? rows[rows.length - 1] : null;
});

const latestPlaceRow = computed(() => {
  const rows = [...dashboard.dashboardTimelineRows.value].reverse();
  return rows.find((row: any) => row.segmentType === 'place') || null;
});

const latestTripRow = computed(() => {
  const rows = [...dashboard.dashboardTimelineRows.value].reverse();
  return rows.find((row: any) => row.segmentType === 'trip') || null;
});

const passiveStateLabel = computed(() => {
  if (!latestTimelineRow.value) return 'Idle';
  return latestTimelineRow.value.segmentType === 'place' ? 'Stationary' : 'In transit';
});

const lastPlaceLabel = computed(() => latestPlaceRow.value?.title || 'No place story yet');
const lastPlaceDetail = computed(
  () => latestPlaceRow.value?.rangeLabel || dashboard.overviewSummary.value
);
const lastMovementLabel = computed(() => {
  if (!latestTripRow.value) return 'No movement story yet';
  return latestTripRow.value.story || latestTripRow.value.title;
});
const lastMovementDetail = computed(() => {
  if (!latestTripRow.value) return dashboard.syncLabel.value;
  return `${latestTripRow.value.rangeLabel} · ${latestTripRow.value.durationLabel}`;
});

const recentPlaces = computed(() =>
  dashboard.topPlaces.value.slice(0, 6).map((place) => ({
    key: place.key,
    label: formatPlaceName(place.labelName, place.autoLabel),
    detail: `${place.visitCount} visits · ${formatRecentPlaceTime(place.lastSeenMs)}`
  }))
);

const routines = computed<RoutineTile[]>(() => {
  const definitions = [
    { id: 'home-work', label: 'Home -> Work', toKeywords: ['work'], fromKeywords: ['home'] },
    { id: 'work-home', label: 'Work -> Home', toKeywords: ['home'], fromKeywords: ['work'] },
    { id: 'school', label: 'School', keywords: ['school'] },
    { id: 'gym', label: 'Gym', keywords: ['gym'] }
  ];

  return definitions.map((definition) => {
    const target = resolveRoutineTarget(definition);
    const active =
      (target?.presetId && target.presetId === commute.selectedPresetId.value) ||
      (target?.routeKey && target.routeKey === commute.selectedRouteKey.value);

    return {
      active,
      detail: target?.detail || 'Add a matching preset or route label',
      id: definition.id,
      label: definition.label,
      target: target ? { presetId: target.presetId, routeKey: target.routeKey } : null
    };
  });
});

function resolveRoutineTarget(definition: {
  id: string;
  label: string;
  keywords?: string[];
  fromKeywords?: string[];
  toKeywords?: string[];
}) {
  const presetMatch = commute.presets.value.find((preset) =>
    matchesRoutineDefinition(preset.label, definition)
  );
  if (presetMatch) {
    return {
      detail: presetMatch.label,
      presetId: presetMatch.id
    };
  }

  const routeMatch = commute.routes.value.find((route) =>
    matchesRoutineDefinition(route.label, definition)
  );
  if (routeMatch) {
    return {
      detail: routeMatch.label,
      routeKey: routeMatch.route_key
    };
  }

  return null;
}

function matchesRoutineDefinition(
  value: string,
  definition: {
    keywords?: string[];
    fromKeywords?: string[];
    toKeywords?: string[];
  }
) {
  const normalized = normalizeText(value);
  if (definition.fromKeywords?.length && definition.toKeywords?.length && normalized.includes('->')) {
    const [fromPart, toPart] = normalized.split('->').map((part) => normalizeText(part));
    return (
      definition.fromKeywords.every((keyword) => fromPart.includes(normalizeText(keyword))) &&
      definition.toKeywords.every((keyword) => toPart.includes(normalizeText(keyword)))
    );
  }
  if (definition.keywords?.length) {
    return definition.keywords.every((keyword) => normalized.includes(normalizeText(keyword)));
  }
  return false;
}

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function activateRoutine(routine: RoutineTile) {
  if (!routine.target) return;
  if (routine.target.presetId) {
    await commute.selectPreset(routine.target.presetId);
    return;
  }
  if (routine.target.routeKey) {
    await commute.selectRoute(routine.target.routeKey);
  }
}

function anomalyClass(tone: 'critical' | 'muted' | 'strong' | 'warning') {
  return {
    strong: 'border-emerald-900 bg-emerald-950/60',
    warning: 'border-amber-900 bg-amber-950/50',
    critical: 'border-rose-900 bg-rose-950/50',
    muted: 'border-white/10 bg-[#141414]'
  }[tone];
}

function routineCardClass(routine: RoutineTile) {
  if (routine.active) return 'border-orange-500/40 bg-orange-500/10 text-white';
  if (routine.target) return 'border-white/10 bg-[#141414] text-white hover:border-white/20';
  return 'border-white/5 bg-[#111111] text-zinc-500';
}

function formatRecentPlaceTime(timestamp: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'recently';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(timestamp));
}
</script>
