<template>
  <section class="border-white/8 overflow-hidden rounded-[28px] border bg-[#111418] shadow-[0_24px_70px_rgba(0,0,0,0.4)]">
    <div class="bg-[linear-gradient(135deg,#0e0e10_0%,#1a1208_38%,#E8922A_100%)] px-4 py-5 sm:px-5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.32em] text-orange-300">
            Live commute read
          </p>
          <p v-if="estimate" class="mt-2 text-sm text-orange-100/80">{{ estimate.route?.label }}</p>
          <h2 class="mt-1.5 text-[28px] font-semibold tracking-tight text-white sm:text-3xl">
            {{ estimate?.message?.headline || 'Queue signal' }}
          </h2>
          <p class="mt-2.5 max-w-2xl text-[13px] leading-5 text-orange-100/80 sm:text-sm sm:leading-6">
            {{ estimate?.message?.action || 'Choose a route to load the latest queue prediction.' }}
          </p>
        </div>

        <button
          class="rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          @click="$emit('refresh')"
        >
          {{ loading ? 'Refreshing' : 'Refresh' }}
        </button>
      </div>

      <div v-if="estimate" class="mt-4 flex flex-wrap gap-2">
        <span class="rounded-full border px-3 py-1.5 text-xs font-semibold capitalize" :class="levelBadgeClassDark(estimate.level)">
          {{ estimate.level.replace('_', ' ') }}
        </span>
        <span class="rounded-full border px-3 py-1.5 text-xs font-semibold" :class="sourceBadgeClassDark(estimate.signals?.traffic?.source)">
          {{ sourceLabel(estimate.signals?.traffic?.source) }}
        </span>
        <span class="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
          {{ estimate.signals?.traffic?.label || 'Traffic unavailable' }}
        </span>
        <span class="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
          Score {{ estimate.score }}
        </span>
      </div>
    </div>

    <div class="space-y-3.5 px-4 py-4 sm:px-5">
      <p v-if="error" class="rounded-2xl border border-rose-800 bg-rose-950 px-4 py-3 text-sm text-rose-400">
        {{ error }}
      </p>

      <div v-else-if="estimate" class="space-y-3.5">
        <div class="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
          <div class="rounded-2xl border border-zinc-800 bg-zinc-900 px-3.5 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Wait estimate</p>
            <p class="mt-1.5 text-base font-semibold text-orange-400 sm:text-lg">
              {{ formatQueueRange(estimate.wait_minutes_estimate) }}
            </p>
            <p class="mt-1 text-[11px] text-zinc-600">
              Likely {{ formatQueueMinutes(estimate.wait_minutes_estimate?.likely_minutes) }}
            </p>
          </div>
          <div class="rounded-2xl border border-zinc-800 bg-zinc-900 px-3.5 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">In-vehicle</p>
            <p class="mt-1.5 text-base font-semibold text-white sm:text-lg">
              {{ formatQueueDuration(estimate.signals?.traffic?.duration_seconds) }}
            </p>
          </div>
          <div class="rounded-2xl border border-zinc-800 bg-zinc-900 px-3.5 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Ride total</p>
            <p class="mt-1.5 text-base font-semibold text-white sm:text-lg">
              {{ formatQueueMinutes(estimate.recommendation?.ride_total_minutes) }}
            </p>
          </div>
          <div class="rounded-2xl border border-zinc-800 bg-zinc-900 px-3.5 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Ride ETA</p>
            <p class="mt-1.5 text-base font-semibold text-white sm:text-lg">
              {{ formatRideEta(estimate) }}
            </p>
          </div>
          <div class="rounded-2xl border border-zinc-800 bg-zinc-900 px-3.5 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Baseline</p>
            <p class="mt-1.5 text-base font-semibold text-white sm:text-lg">
              {{ formatQueueDuration(estimate.signals?.traffic?.baseline_seconds) }}
            </p>
          </div>
          <div class="rounded-2xl border border-zinc-800 bg-zinc-900 px-3.5 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Traffic ratio</p>
            <p class="mt-1.5 text-base font-semibold text-orange-400 sm:text-lg">
              {{ estimate.signals?.traffic?.ratio }}x
            </p>
          </div>
        </div>

        <div class="grid gap-2.5 md:grid-cols-3">
          <div
            class="rounded-[20px] border px-3.5 py-3"
            :class="queueTrustPanelClass(signalState.tone)"
          >
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Signal state</p>
            <p class="mt-1.5 text-sm font-semibold" :class="queueTrustLabelClass(signalState.tone)">
              {{ signalState.label }}
            </p>
            <p class="mt-1.5 text-[12px] leading-5 text-zinc-300 sm:text-[13px]">
              {{ signalState.detail }}
            </p>
          </div>

          <div
            class="rounded-[20px] border px-3.5 py-3"
            :class="queueTrustPanelClass(confidenceState.tone)"
          >
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Confidence</p>
            <p class="mt-1.5 text-sm font-semibold" :class="queueTrustLabelClass(confidenceState.tone)">
              {{ confidenceState.label }}
            </p>
            <p class="mt-1.5 text-[12px] leading-5 text-zinc-300 sm:text-[13px]">
              {{ confidenceState.detail }}
            </p>
          </div>

          <div
            class="rounded-[20px] border px-3.5 py-3"
            :class="queueTrustPanelClass(departureCall.tone)"
          >
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Timing call</p>
            <p class="mt-1.5 text-sm font-semibold" :class="queueTrustLabelClass(departureCall.tone)">
              {{ departureCall.label }}
            </p>
            <p class="mt-1.5 text-[12px] leading-5 text-zinc-300 sm:text-[13px]">
              {{ departureCall.detail }}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <span class="rounded-full border px-3 py-1.5 text-xs font-semibold" :class="weatherClasses(estimate.signals?.weather?.severity)">
            {{ weatherTitle(estimate.signals?.weather) }}
          </span>
          <span
            class="rounded-full border px-3 py-1.5 text-xs font-semibold"
            :class="estimate.signals?.calendar?.is_holiday ? 'border-amber-800 bg-amber-950 text-amber-300' : 'border-zinc-700 bg-zinc-900 text-zinc-300'"
          >
            {{ estimate.signals?.calendar?.holiday_name ?? (estimate.signals?.calendar?.is_holiday ? 'Holiday schedule' : 'Regular day') }}
          </span>
          <span class="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300">
            {{ estimate.signals?.incidents?.active?.length ?? 0 }} active incidents
          </span>
          <span class="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300">
            {{ observationChip(estimate.signals?.observations) }}
          </span>
          <span
            class="rounded-full border px-3 py-1.5 text-xs font-semibold"
            :class="estimate.meta?.degraded ? 'border-rose-800 bg-rose-950 text-rose-300' : 'border-emerald-800 bg-emerald-950 text-emerald-300'"
          >
            {{ estimate.meta?.degraded ? `Degraded: ${estimate.meta?.degraded_reason}` : 'Healthy signal path' }}
          </span>
        </div>

        <div v-if="estimate.message" class="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
          <div class="rounded-[24px] border border-zinc-800 bg-zinc-950 px-4 py-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.26em] text-zinc-500">Why this signal</p>
            <p class="mt-2.5 text-sm font-semibold leading-6 text-white">{{ estimate.message.reason }}</p>
            <div v-if="contextBadges.length" class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="badge in contextBadges"
                :key="badge.label"
                class="rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                :class="queueContextBadgeClass(badge.tone)"
              >
                {{ badge.label }}
              </span>
            </div>
            <p v-if="contextSummary" class="mt-3 text-[13px] leading-5 text-zinc-400 sm:text-sm sm:leading-6">{{ contextSummary }}</p>
            <p class="mt-3 text-[13px] leading-5 text-zinc-400 sm:text-sm sm:leading-6">{{ estimate.message.action }}</p>
            <p class="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-400">
              {{ estimate.message.confidence_note }}
            </p>
          </div>

          <div class="rounded-[24px] border border-[#1e4028] bg-[#0d1f12] px-4 py-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.26em] text-green-600">Best option</p>
            <h3 class="mt-2.5 text-xl font-semibold tracking-tight text-green-100">
              {{ recommendationTitle(estimate.recommendation?.best_option) }}
            </h3>
            <p class="mt-2 text-[13px] leading-5 text-zinc-300 sm:text-sm sm:leading-6">
              {{ estimate.recommendation?.message || 'Comparison unavailable.' }}
            </p>
            <div class="mt-3 grid grid-cols-2 gap-2.5">
              <div class="rounded-2xl border border-[#1e4028] bg-[#0a1a10] px-3.5 py-3">
                <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Ride total</p>
                <p class="mt-1 text-sm font-semibold text-green-400">
                  {{ formatQueueMinutes(estimate.recommendation?.ride_total_minutes) }}
                </p>
              </div>
              <div class="rounded-2xl border border-[#1e4028] bg-[#0a1a10] px-3.5 py-3">
                <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Walk total</p>
                <p class="mt-1 text-sm font-semibold text-zinc-300">
                  {{ formatQueueMinutes(estimate.recommendation?.walk_total_minutes) }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <div class="rounded-[20px] border border-zinc-800 bg-zinc-950 px-3.5 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Weather multiplier</p>
            <p class="mt-2 text-sm font-semibold text-white sm:text-base">{{ weatherTitle(estimate.signals?.weather) }}</p>
            <p class="mt-1.5 text-[12px] leading-5 text-zinc-400 sm:text-[13px]">{{ weatherDetail(estimate.signals?.weather) }}</p>
          </div>
          <div class="rounded-[20px] border border-zinc-800 bg-zinc-950 px-3.5 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Calendar source</p>
            <p class="mt-2 text-sm font-semibold text-white sm:text-base">{{ calendarTitle(estimate.signals?.calendar) }}</p>
            <p class="mt-1.5 text-[12px] leading-5 text-zinc-400 sm:text-[13px]">{{ calendarDetail(estimate.signals?.calendar) }}</p>
          </div>
          <div class="rounded-[20px] border border-zinc-800 bg-zinc-950 px-3.5 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Incident override</p>
            <p class="mt-2 text-sm font-semibold text-white sm:text-base">{{ signedValue(estimate.signals?.incidents?.score_delta) }}</p>
            <p class="mt-1.5 text-[12px] leading-5 text-zinc-400 sm:text-[13px]">{{ incidentDetail(estimate.signals?.incidents) }}</p>
          </div>
          <div class="rounded-[20px] border border-zinc-800 bg-zinc-950 px-3.5 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Observation drift</p>
            <p class="mt-2 text-sm font-semibold text-white sm:text-base">{{ signedValue(estimate.signals?.observations?.score_delta) }}</p>
            <p class="mt-1.5 text-[12px] leading-5 text-zinc-400 sm:text-[13px]">{{ observationDetail(estimate.signals?.observations) }}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
          <div class="rounded-2xl border border-zinc-800 bg-zinc-950 px-3.5 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Cache hit</p>
            <p class="mt-1 text-[13px] font-medium text-white sm:text-sm">{{ estimate.meta?.cache?.hit ? 'Yes' : 'No' }}</p>
          </div>
          <div class="rounded-2xl border border-zinc-800 bg-zinc-950 px-3.5 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Cache age</p>
            <p class="mt-1 text-[13px] font-medium text-white sm:text-sm">{{ formatCacheAge(estimate.meta?.cache?.age_ms) }}</p>
          </div>
          <div class="rounded-2xl border border-zinc-800 bg-zinc-950 px-3.5 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Commute points</p>
            <p class="mt-1 text-[13px] font-medium text-white sm:text-sm">{{ Array.isArray(estimate.polyline) ? estimate.polyline.length : 0 }}</p>
          </div>
          <div class="rounded-2xl border border-zinc-800 bg-zinc-950 px-3.5 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Walking points</p>
            <p class="mt-1 text-[13px] font-medium text-white sm:text-sm">{{ Array.isArray(estimate.walking_polyline) ? estimate.walking_polyline.length : 0 }}</p>
          </div>
          <div class="rounded-2xl border border-zinc-800 bg-zinc-950 px-3.5 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Computed</p>
            <p class="mt-1 text-[13px] font-medium text-white sm:text-sm">{{ formatQueueTimestamp(estimate.computed_at) }}</p>
          </div>
        </div>

        <div class="rounded-[24px] border border-zinc-800 bg-zinc-950 px-4 py-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.26em] text-zinc-500">Time window</p>
          <div class="mt-3 grid grid-cols-2 gap-2.5">
            <div class="rounded-2xl border border-zinc-800 bg-zinc-900 px-3.5 py-3">
              <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Current period</p>
              <p class="mt-1.5 text-sm font-semibold capitalize text-white sm:text-base">{{ estimate.signals?.time_of_day?.period }}</p>
            </div>
            <div class="rounded-2xl border border-zinc-800 bg-zinc-900 px-3.5 py-3">
              <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Hour band</p>
              <p class="mt-1.5 text-sm font-semibold text-white sm:text-base">{{ formatHourBand(estimate.signals?.time_of_day?.hour) }}</p>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="rounded-[24px] border border-dashed border-zinc-800 bg-zinc-900 px-4 py-6 text-center text-sm text-zinc-600">
        Pick a route to load the live commute signal.
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import {
  buildQueueContextBadges,
  buildQueueContextSummary,
  formatQueueDuration,
  formatQueueMinutes,
  formatQueueRange,
  formatQueueTimestamp,
  levelBadgeClassDark,
  recommendationTitle,
  queueContextBadgeClass,
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
  error: { type: String, default: '' },
  estimate: { type: Object, default: null },
  loading: Boolean
});

defineEmits(['refresh']);

const contextBadges = computed(() => buildQueueContextBadges(props.estimate));
const contextSummary = computed(() => buildQueueContextSummary(props.estimate));
const signalState = computed(() => buildQueueSignalState(props.estimate));
const confidenceState = computed(() => buildQueueConfidenceState(props.estimate));
const departureCall = computed(() => buildQueueDepartureCall(props.estimate));

function formatRideEta(estimate: Record<string, any> | null | undefined): string {
  const totalMinutes = Number(estimate?.recommendation?.ride_total_minutes);
  if (!Number.isFinite(totalMinutes)) return 'Unavailable';
  const computedAtMs = Date.parse(String(estimate?.computed_at || ''));
  const baseMs = Number.isFinite(computedAtMs) ? computedAtMs : Date.now();
  return new Date(baseMs + totalMinutes * 60_000).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCacheAge(ageMs: number | null | undefined): string {
  if (typeof ageMs !== 'number' || Number.isNaN(ageMs) || ageMs <= 0) return 'Fresh';
  return formatQueueDuration(ageMs / 1000);
}

function formatHourBand(hour: number | null | undefined): string {
  if (typeof hour !== 'number' || !Number.isFinite(hour)) return 'Unavailable';
  return `${String(hour).padStart(2, '0')}:00`;
}

function weatherTitle(weather: Record<string, any> | null | undefined): string {
  if (!weather) return 'No weather signal';
  return {
    clear: 'Dry conditions',
    light_rain: 'Light rain',
    moderate_rain: 'Moderate rain',
    heavy_rain: 'Heavy rain',
  }[weather.severity] ?? 'Weather unavailable';
}

function weatherDetail(weather: Record<string, any> | null | undefined): string {
  if (!weather) return 'No weather signal available.';
  const parts: string[] = [];
  if (typeof weather.precipitation_probability === 'number') parts.push(`${weather.precipitation_probability}% chance`);
  if (typeof weather.precipitation_mm === 'number') parts.push(`${weather.precipitation_mm} mm`);
  parts.push(`${signedValue(weather.score_delta)} score`);
  return parts.join(' • ');
}

function weatherClasses(severity: string | null | undefined): string {
  return {
    clear: 'border-emerald-800 bg-emerald-950 text-emerald-300',
    light_rain: 'border-cyan-800 bg-cyan-950 text-cyan-300',
    moderate_rain: 'border-sky-800 bg-sky-950 text-sky-300',
    heavy_rain: 'border-indigo-800 bg-indigo-950 text-indigo-300',
  }[severity || ''] ?? 'border-zinc-700 bg-zinc-900 text-zinc-300';
}

function calendarTitle(calendar: Record<string, any> | null | undefined): string {
  if (!calendar) return 'No calendar signal';
  if (calendar.holiday_name) return calendar.holiday_name;
  if (calendar.is_holiday) return 'Holiday schedule';
  return 'Regular day';
}

function calendarDetail(calendar: Record<string, any> | null | undefined): string {
  if (!calendar) return 'No calendar context available.';
  if (calendar.source === 'holiday_calendar') return 'Matched against the synced PH holiday calendar.';
  if (calendar.source === 'route_config') return 'Matched against the route-config fallback holiday list.';
  return 'No holiday adjustment applied.';
}

function incidentDetail(incidents: Record<string, any> | null | undefined): string {
  if (!incidents?.active?.length) return 'No active event or traffic overrides.';
  if (incidents.active.length === 1) return incidents.active[0].title;
  return `${incidents.active.length} active overrides are contributing to the score.`;
}

function observationDetail(observations: Record<string, any> | null | undefined): string {
  if (!observations) return 'No observation context available.';
  if (!observations.sample_count) return 'No matching observations for this hour band yet.';
  return `${observations.sample_count} samples • average score ${observations.average_score ?? 'n/a'}`;
}

function observationChip(observations: Record<string, any> | null | undefined): string {
  if (!observations?.sample_count) return '0 observation samples';
  return `${observations.sample_count} observation samples`;
}

function signedValue(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'n/a';
  return `${value > 0 ? '+' : ''}${value}`;
}
</script>
