<template>
  <div class="space-y-4">
    <section class="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <button
            class="w-full text-left text-lg font-semibold text-white transition hover:text-orange-300"
            @click="$emit('open-route-picker')"
          >
            {{ selectedRoute?.label || 'Choose a route' }}
          </button>
          <p class="mt-1 text-sm text-zinc-400">
            {{ selectedRoute?.timezone || 'Load a public route to see ride and walk details.' }}
          </p>
          <p class="mt-1 text-xs text-zinc-500">
            {{ estimate ? `Updated ${formatQueueTimestamp(estimate.computed_at)}` : `Last estimate ${formatQueueTimestamp(lastLoadedAtEstimate)}` }}
          </p>
        </div>

        <button
          class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-orange-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="loadingEstimate"
          @click="$emit('refresh')"
        >
          {{ loadingEstimate ? 'Refreshing' : 'Refresh' }}
        </button>
      </div>

      <p v-if="errorEstimate" class="mt-4 rounded-lg border border-rose-900 bg-rose-950 px-3 py-2 text-sm text-rose-300">
        {{ errorEstimate }}
      </p>

      <div v-else-if="estimate" class="mt-4 grid grid-cols-3 gap-2">
        <article class="rounded-lg border border-zinc-800 bg-[#111418] px-3 py-3">
          <p class="text-[11px] text-zinc-500">Wait</p>
          <p class="mt-1 text-base font-semibold text-white">
            {{ formatQueueRange(estimate.wait_minutes_estimate) }}
          </p>
          <p class="mt-1 text-xs text-zinc-500">
            Likely {{ formatQueueMinutes(estimate.wait_minutes_estimate?.likely_minutes) }}
          </p>
        </article>

        <article class="rounded-lg border border-zinc-800 bg-[#111418] px-3 py-3">
          <p class="text-[11px] text-zinc-500">Ride</p>
          <p class="mt-1 text-base font-semibold text-orange-300">
            {{ formatQueueMinutes(estimate.recommendation?.ride_total_minutes) }}
          </p>
          <p class="mt-1 text-xs text-zinc-500">
            {{ formatQueueDuration(estimate.signals?.traffic?.duration_seconds) }} in vehicle
          </p>
        </article>

        <article class="rounded-lg border border-zinc-800 bg-[#111418] px-3 py-3">
          <p class="text-[11px] text-zinc-500">Walk</p>
          <p class="mt-1 text-base font-semibold text-emerald-300">
            {{ formatQueueMinutes(estimate.recommendation?.walk_total_minutes) }}
          </p>
          <p class="mt-1 text-xs text-zinc-500">
            {{ sourceLabel(estimate.signals?.traffic?.source) }}
          </p>
        </article>
      </div>
    </section>

    <section v-if="estimate" class="grid gap-3 md:grid-cols-2">
      <article class="rounded-xl border border-orange-900/70 bg-[#17110c] px-4 py-4">
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm font-semibold text-orange-200">Ride route</p>
          <span class="rounded-md border border-orange-800 bg-orange-950 px-2 py-1 text-xs text-orange-300">
            {{ recommendationTitle(estimate.recommendation?.best_option) }}
          </span>
        </div>
        <p class="mt-3 text-2xl font-semibold text-white">
          {{ formatQueueMinutes(estimate.recommendation?.ride_total_minutes) }}
        </p>
        <dl class="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div class="rounded-lg border border-orange-950 bg-black/20 px-3 py-2">
            <dt class="text-zinc-500">Queue</dt>
            <dd class="mt-1 text-white">
              {{ formatQueueRange(estimate.wait_minutes_estimate) }}
            </dd>
          </div>
          <div class="rounded-lg border border-orange-950 bg-black/20 px-3 py-2">
            <dt class="text-zinc-500">Travel</dt>
            <dd class="mt-1 text-white">
              {{ formatQueueDuration(estimate.signals?.traffic?.duration_seconds) }}
            </dd>
          </div>
          <div class="rounded-lg border border-orange-950 bg-black/20 px-3 py-2">
            <dt class="text-zinc-500">Baseline</dt>
            <dd class="mt-1 text-white">
              {{ formatQueueDuration(estimate.signals?.traffic?.baseline_seconds) }}
            </dd>
          </div>
          <div class="rounded-lg border border-orange-950 bg-black/20 px-3 py-2">
            <dt class="text-zinc-500">Traffic</dt>
            <dd class="mt-1 text-white">{{ estimate.signals?.traffic?.ratio }}x</dd>
          </div>
        </dl>
      </article>

      <article class="rounded-xl border border-emerald-900/70 bg-[#0d1410] px-4 py-4">
        <p class="text-sm font-semibold text-emerald-200">Walk route</p>
        <p class="mt-3 text-2xl font-semibold text-white">
          {{ formatQueueMinutes(estimate.recommendation?.walk_total_minutes) }}
        </p>
        <p class="mt-2 text-sm leading-6 text-zinc-300">
          {{ estimate.recommendation?.message || 'Walking comparison is unavailable right now.' }}
        </p>
        <dl class="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div class="rounded-lg border border-emerald-950 bg-black/20 px-3 py-2">
            <dt class="text-zinc-500">Signal state</dt>
            <dd class="mt-1 text-white">{{ signalState.label }}</dd>
          </div>
          <div class="rounded-lg border border-emerald-950 bg-black/20 px-3 py-2">
            <dt class="text-zinc-500">Confidence</dt>
            <dd class="mt-1 text-white">{{ confidenceState.label }}</dd>
          </div>
          <div class="rounded-lg border border-emerald-950 bg-black/20 px-3 py-2">
            <dt class="text-zinc-500">Timing call</dt>
            <dd class="mt-1 text-white">{{ departureCall.label }}</dd>
          </div>
          <div class="rounded-lg border border-emerald-950 bg-black/20 px-3 py-2">
            <dt class="text-zinc-500">Signal path</dt>
            <dd class="mt-1 text-white">
              {{ estimate.meta?.degraded ? estimate.meta?.degraded_reason : 'Healthy' }}
            </dd>
          </div>
        </dl>
      </article>
    </section>

    <section v-if="estimate" class="grid gap-3 sm:grid-cols-3">
      <article
        class="rounded-xl border px-3.5 py-3"
        :class="queueTrustPanelClass(signalState.tone)"
      >
        <p class="text-[11px] text-zinc-500">Signal state</p>
        <p class="mt-1 text-sm font-semibold" :class="queueTrustLabelClass(signalState.tone)">
          {{ signalState.label }}
        </p>
        <p class="mt-2 text-sm leading-5 text-zinc-300">{{ signalState.detail }}</p>
      </article>

      <article
        class="rounded-xl border px-3.5 py-3"
        :class="queueTrustPanelClass(confidenceState.tone)"
      >
        <p class="text-[11px] text-zinc-500">Confidence</p>
        <p class="mt-1 text-sm font-semibold" :class="queueTrustLabelClass(confidenceState.tone)">
          {{ confidenceState.label }}
        </p>
        <p class="mt-2 text-sm leading-5 text-zinc-300">{{ confidenceState.detail }}</p>
      </article>

      <article
        class="rounded-xl border px-3.5 py-3"
        :class="queueTrustPanelClass(departureCall.tone)"
      >
        <p class="text-[11px] text-zinc-500">Timing call</p>
        <p class="mt-1 text-sm font-semibold" :class="queueTrustLabelClass(departureCall.tone)">
          {{ departureCall.label }}
        </p>
        <p class="mt-2 text-sm leading-5 text-zinc-300">{{ departureCall.detail }}</p>
      </article>
    </section>

    <QueuePersonalizationPanel
      v-if="selectedRoute"
      :disabled="!selectedRoute"
      :helper-text="personalizationHelperText"
      :personalization="selectedPersonalization"
      :route-label="selectedRoute.label"
      @reset="$emit('reset-personalization')"
      @save="$emit('save-personalization', $event)"
    />

    <section v-if="estimate" class="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-4">
      <div class="flex flex-wrap gap-2">
        <span
          class="rounded-md border px-2.5 py-1 text-xs"
          :class="levelBadgeClassDark(estimate.level)"
        >
          {{ estimate.level.replace('_', ' ') }}
        </span>
        <span
          class="rounded-md border px-2.5 py-1 text-xs"
          :class="sourceBadgeClassDark(estimate.signals?.traffic?.source)"
        >
          {{ sourceLabel(estimate.signals?.traffic?.source) }}
        </span>
        <span class="rounded-md border border-zinc-700 bg-[#111418] px-2.5 py-1 text-xs text-zinc-300">
          {{ estimate.signals?.weather?.headline || 'No weather override' }}
        </span>
        <span class="rounded-md border border-zinc-700 bg-[#111418] px-2.5 py-1 text-xs text-zinc-300">
          {{ estimate.signals?.calendar?.holiday_name || (estimate.signals?.calendar?.is_holiday ? 'Holiday schedule' : 'Regular day') }}
        </span>
        <span class="rounded-md border border-zinc-700 bg-[#111418] px-2.5 py-1 text-xs text-zinc-300">
          {{ estimate.signals?.incidents?.active?.length ?? 0 }} incidents
        </span>
      </div>
      <p class="mt-3 text-sm leading-6 text-zinc-300">
        {{ estimate.message?.reason || estimate.message?.action || 'Route guidance will appear here once a prediction is loaded.' }}
      </p>
    </section>

    <section v-if="showExpanded && heatmap?.heatmap?.length" class="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-white">Best and worst hours</p>
          <p class="mt-1 text-sm text-zinc-400">
            {{ heatmap.route?.timezone || selectedRoute?.timezone }}
          </p>
        </div>
        <div v-if="errorHeatmap" class="text-xs text-rose-300">{{ errorHeatmap }}</div>
        <div v-else-if="loadingHeatmap" class="text-xs text-zinc-400">Refreshing</div>
      </div>
      <div class="mt-4 grid grid-cols-4 gap-2">
        <article
          v-for="entry in heatmap.heatmap"
          :key="entry.hour"
          class="rounded-lg border px-2.5 py-2 text-xs"
          :style="heatmapCellStyle(entry.level, entry.hour === currentHour)"
        >
          <p class="font-medium text-zinc-200">{{ String(entry.hour).padStart(2, '0') }}:00</p>
          <p class="mt-1 text-base font-semibold text-white">{{ entry.score }}</p>
          <p class="mt-1 text-zinc-400">{{ entry.period }}</p>
        </article>
      </div>
    </section>

    <section v-if="showExpanded" class="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-white">Corridor ranking</p>
          <p class="mt-1 text-sm text-zinc-400">
            {{ comparisonRows.length ? `${comparisonRows.length} public routes ranked by the quickest current trip.` : 'Route ranking appears after corridor data loads.' }}
          </p>
        </div>
        <div v-if="errorComparison" class="text-xs text-rose-300">{{ errorComparison }}</div>
        <div v-else-if="loadingComparison" class="text-xs text-zinc-400">Refreshing</div>
        <div v-else class="text-xs text-zinc-500">
          {{ `Updated ${formatQueueTimestamp(lastLoadedAtComparison || comparison?.computed_at)}` }}
        </div>
      </div>

      <div v-if="comparisonRows.length" class="mt-4 divide-y divide-zinc-800">
        <button
          v-for="entry in comparisonRows"
          :key="entry.routeKey"
          class="flex w-full items-start gap-3 py-3 text-left transition first:pt-0 last:pb-0 hover:text-white"
          @click="$emit('select-route', entry.routeKey)"
        >
          <div class="w-6 flex-shrink-0 pt-0.5 text-sm text-zinc-500">
            {{ entry.rank }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-medium text-white">{{ entry.label }}</span>
              <span v-if="entry.routeKey === selectedRouteKey" class="text-xs text-orange-300">Selected</span>
              <span v-else-if="entry.rank === 1" class="text-xs text-emerald-300">Fastest now</span>
            </div>
            <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
              <span>{{ entry.optionLabel }} {{ entry.totalLabel }}</span>
              <span>Wait {{ entry.waitLabel }}</span>
              <span>{{ entry.confidenceLabel }}</span>
            </div>
          </div>
          <div class="flex-shrink-0 text-right">
            <p class="text-sm font-semibold text-white">{{ entry.totalLabel }}</p>
            <p class="mt-1 text-xs" :class="entry.degraded ? 'text-rose-300' : 'text-zinc-500'">
              {{ entry.signalLabel }}
            </p>
          </div>
        </button>
      </div>
    </section>

    <QueuePresetManager
      v-if="showExpanded"
      :presets="presets"
      :routes="routes"
      :save-disabled="!selectedRoute"
      :selected-preset-id="selectedPresetId"
      :selected-route-key="selectedRouteKey"
      title="Saved commute presets"
      @delete-preset="$emit('delete-preset', $event)"
      @save-preset="$emit('save-preset', $event)"
      @select-preset="$emit('select-preset', $event)"
    />

    <section v-if="showExpanded && selectedRoute" class="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-4">
      <p class="text-sm font-semibold text-white">Route details</p>
      <dl class="mt-4 grid gap-2 sm:grid-cols-2">
        <div class="rounded-lg border border-zinc-800 bg-[#111418] px-3 py-3">
          <dt class="text-xs text-zinc-500">Origin</dt>
          <dd class="mt-1 text-sm text-white">{{ formatQueueCoordinate(selectedRoute.origin) }}</dd>
        </div>
        <div class="rounded-lg border border-zinc-800 bg-[#111418] px-3 py-3">
          <dt class="text-xs text-zinc-500">Destination</dt>
          <dd class="mt-1 text-sm text-white">{{ formatQueueCoordinate(selectedRoute.destination) }}</dd>
        </div>
        <div class="rounded-lg border border-zinc-800 bg-[#111418] px-3 py-3">
          <dt class="text-xs text-zinc-500">Timezone</dt>
          <dd class="mt-1 text-sm text-white">{{ selectedRoute.timezone }}</dd>
        </div>
        <div class="rounded-lg border border-zinc-800 bg-[#111418] px-3 py-3">
          <dt class="text-xs text-zinc-500">Updated</dt>
          <dd class="mt-1 text-sm text-white">{{ updatedLabel(selectedRoute.updated_at) }}</dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import QueuePersonalizationPanel from '~/components/queue/QueuePersonalizationPanel.vue';
import QueuePresetManager from '~/components/queue/QueuePresetManager.vue';
import {
  formatQueueCoordinate,
  formatQueueDuration,
  formatQueueMinutes,
  formatQueueRange,
  formatQueueTimestamp,
  levelBadgeClassDark,
  recommendationTitle,
  sourceBadgeClassDark,
  sourceLabel
} from '~/lib/queueCommute';
import {
  buildQueueConfidenceState,
  buildQueueDepartureCall,
  buildQueueSignalState,
  queueTrustLabelClass,
  queueTrustPanelClass
} from '~/lib/queueEstimateTrust';

const props = defineProps({
  comparison: { type: Object, default: null },
  errorComparison: { type: String, default: '' },
  errorEstimate: { type: String, default: '' },
  errorHeatmap: { type: String, default: '' },
  estimate: { type: Object, default: null },
  heatmap: { type: Object, default: null },
  lastLoadedAtEstimate: { type: String, default: '' },
  lastLoadedAtComparison: { type: String, default: '' },
  loadingComparison: Boolean,
  loadingEstimate: Boolean,
  loadingHeatmap: Boolean,
  selectedPersonalization: {
    type: Object,
    default: () => ({
      access_minutes: 0,
      egress_minutes: 0,
      max_walk_minutes: null,
    }),
  },
  presets: { type: Array, default: () => [] },
  routes: { type: Array, default: () => [] },
  selectedPresetId: { type: String, default: '' },
  selectedRoute: { type: Object, default: null },
  selectedRouteKey: { type: String, default: '' },
  showExpanded: Boolean
});

defineEmits([
  'delete-preset',
  'open-route-picker',
  'refresh',
  'reset-personalization',
  'save-preset',
  'save-personalization',
  'select-preset',
  'select-route'
]);

const signalState = computed(() => buildQueueSignalState(props.estimate));
const confidenceState = computed(() => buildQueueConfidenceState(props.estimate));
const departureCall = computed(() => buildQueueDepartureCall(props.estimate));
const personalizationHelperText = computed(() => {
  const addedMinutes = Number(props.estimate?.recommendation?.personalization?.added_minutes);
  const maxWalkMinutes = Number(props.estimate?.recommendation?.personalization?.max_walk_minutes);
  const fragments = [];

  if (Number.isFinite(addedMinutes) && addedMinutes > 0) {
    fragments.push(`${Math.round(addedMinutes)} min added`);
  }

  if (Number.isFinite(maxWalkMinutes) && maxWalkMinutes > 0) {
    fragments.push(`walk cap ${Math.round(maxWalkMinutes)} min`);
  }

  return fragments.join(' · ');
});
const comparisonRows = computed(() => {
  const source = Array.isArray(props.comparison?.comparisons) ? props.comparison.comparisons : [];

  return source
    .map((entry, index) => {
      const estimate = entry?.estimate;
      const routeKey = String(estimate?.route?.route_key || '');

      if (!routeKey) {
        return null;
      }

      const option = String(estimate?.recommendation?.best_option || 'unavailable');

      return {
        confidenceLabel: buildQueueConfidenceState(estimate).label,
        degraded: Boolean(estimate?.meta?.degraded),
        label: String(estimate?.route?.label || routeKey),
        optionLabel: {
          ride: 'Ride',
          walk: 'Walk',
          either: 'Either',
          unavailable: 'Fallback',
        }[option] ?? 'Ride',
        rank: Number(entry?.rank) || index + 1,
        routeKey,
        signalLabel: buildQueueSignalState(estimate).label,
        totalLabel: formatQueueMinutes(
          entry?.recommended_total_minutes ?? estimate?.recommendation?.personalization?.recommended_total_minutes
        ),
        waitLabel: formatQueueMinutes(estimate?.wait_minutes_estimate?.likely_minutes),
      };
    })
    .filter((entry): entry is {
      confidenceLabel: string;
      degraded: boolean;
      label: string;
      optionLabel: string;
      rank: number;
      routeKey: string;
      signalLabel: string;
      totalLabel: string;
      waitLabel: string;
    } => entry !== null);
});
const currentHour = computed(() => {
  const timezone = props.heatmap?.route?.timezone || props.selectedRoute?.timezone;
  if (!timezone) {
    return new Date().getHours();
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: timezone
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  return Number.isFinite(hour) ? hour : new Date().getHours();
});

function heatmapCellStyle(level: string, active: boolean): string {
  const base = {
    low: 'background:#0d1510;border-color:#1f3325;',
    moderate: 'background:#1a140c;border-color:#3d2f18;',
    high: 'background:#20120c;border-color:#512717;',
    very_high: 'background:#23100d;border-color:#5c1f1b;'
  }[level] ?? 'background:#111418;border-color:#27272a;';

  return active ? `${base}outline:1px solid rgba(249,115,22,0.8);outline-offset:1px;` : base;
}

function updatedLabel(value: number): string {
  if (!value) return 'recently';
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
</script>
