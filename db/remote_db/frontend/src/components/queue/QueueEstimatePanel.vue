<template>
  <section class="rounded-[28px] border border-slate-700/70 bg-slate-950/80 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur">
    <div class="mb-5 flex items-start justify-between gap-4">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Live Estimate</p>
        <h2 class="text-2xl font-semibold text-white">Queue Signal</h2>
      </div>
      <button
        class="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-amber-300 hover:text-white"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        {{ loading ? 'Refreshing...' : 'Refresh estimate' }}
      </button>
    </div>

    <p v-if="error" class="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </p>

    <div v-else-if="estimate" class="space-y-4">
      <div class="rounded-[24px] border border-stone-200 bg-[linear-gradient(135deg,#1c1917_0%,#44403c_55%,#d97706_100%)] p-5 text-white">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <p class="text-sm text-stone-200">{{ estimate.route.label }}</p>
            <h3 class="mt-1 text-3xl font-semibold capitalize">{{ estimate.message?.headline ?? estimate.level.replace('_', ' ') }}</h3>
          </div>
          <div class="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold">
            Score {{ estimate.score }}
          </div>
        </div>
        <p class="max-w-xl text-sm leading-6 text-stone-100">{{ estimate.message?.action ?? 'Live traffic estimate loaded.' }}</p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div class="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Wait estimate</p>
          <p class="mt-2 text-lg font-semibold text-white">{{ formatWaitEstimate(estimate.wait_minutes_estimate) }}</p>
        </div>
        <div class="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">In-vehicle time</p>
          <p class="mt-2 text-lg font-semibold text-white">{{ formatDuration(estimate.signals.traffic.duration_seconds) }}</p>
        </div>
        <div class="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Ride total</p>
          <p class="mt-2 text-lg font-semibold text-white">{{ formatMinutes(estimate.recommendation?.ride_total_minutes) }}</p>
        </div>
        <div class="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Ride ETA</p>
          <p class="mt-2 text-lg font-semibold text-white">{{ formatRideEta(estimate) }}</p>
        </div>
        <div class="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Baseline</p>
          <p class="mt-2 text-lg font-semibold text-white">{{ formatDuration(estimate.signals.traffic.baseline_seconds) }}</p>
        </div>
        <div class="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Traffic ratio</p>
          <p class="mt-2 text-lg font-semibold text-white">{{ estimate.signals.traffic.ratio }}x</p>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <span class="rounded-full border px-3 py-1.5 text-xs font-semibold" :class="levelClasses(estimate.level)">
          {{ estimate.level.replace('_', ' ') }}
        </span>
        <span class="rounded-full border px-3 py-1.5 text-xs font-semibold" :class="sourceClasses(estimate.signals.traffic.source)">
          {{ sourceLabel(estimate.signals.traffic.source) }}
        </span>
        <span class="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200">
          {{ estimate.signals.traffic.label }}
        </span>
        <span
          class="rounded-full border px-3 py-1.5 text-xs font-semibold"
          :class="estimate.meta.degraded ? 'border-rose-400/40 bg-rose-500/10 text-rose-200' : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'"
        >
          {{ estimate.meta.degraded ? `Degraded: ${estimate.meta.degraded_reason}` : 'Healthy signal path' }}
        </span>
        <span class="rounded-full border px-3 py-1.5 text-xs font-semibold" :class="weatherClasses(estimate.signals.weather?.severity)">
          {{ weatherTitle(estimate.signals.weather) }}
        </span>
        <span
          class="rounded-full border px-3 py-1.5 text-xs font-semibold"
          :class="estimate.signals.calendar?.is_holiday ? 'border-amber-400/40 bg-amber-500/10 text-amber-200' : 'border-slate-600 bg-slate-800 text-slate-200'"
        >
          {{ estimate.signals.calendar?.holiday_name ?? (estimate.signals.calendar?.is_holiday ? 'Holiday schedule' : 'Regular day') }}
        </span>
        <span class="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200">
          {{ estimate.signals.incidents?.active?.length ?? 0 }} active incidents
        </span>
        <span class="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200">
          {{ observationChip(estimate.signals.observations) }}
        </span>
      </div>

      <div v-if="estimate.message" class="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
        <div class="rounded-[24px] border border-slate-700 bg-slate-950 px-5 py-4">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Why this signal</p>
          <p class="mt-3 text-sm leading-6 text-slate-100">{{ estimate.message.reason }}</p>
          <p class="mt-3 text-sm leading-6 text-slate-200">{{ estimate.message.action }}</p>
          <p class="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-amber-300">{{ estimate.message.confidence_note }}</p>
        </div>

        <div class="rounded-[24px] border border-slate-700 bg-slate-950 px-5 py-4">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Best option</p>
          <p class="mt-3 text-lg font-semibold text-white">{{ recommendationTitle(estimate.recommendation) }}</p>
          <p class="mt-2 text-sm leading-6 text-slate-200">{{ estimate.recommendation?.message ?? 'No comparison available.' }}</p>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3">
              <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Ride total</p>
              <p class="mt-1 text-sm font-medium text-white">{{ formatMinutes(estimate.recommendation?.ride_total_minutes) }}</p>
            </div>
            <div class="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3">
              <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Walk total</p>
              <p class="mt-1 text-sm font-medium text-white">{{ formatMinutes(estimate.recommendation?.walk_total_minutes) }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-[24px] border border-slate-700 bg-slate-950 px-5 py-4">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Weather multiplier</p>
          <p class="mt-3 text-lg font-semibold text-white">{{ weatherTitle(estimate.signals.weather) }}</p>
          <p class="mt-2 text-sm leading-6 text-slate-200">
            {{ weatherDetail(estimate.signals.weather) }}
          </p>
        </div>
        <div class="rounded-[24px] border border-slate-700 bg-slate-950 px-5 py-4">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Calendar source</p>
          <p class="mt-3 text-lg font-semibold text-white">{{ calendarTitle(estimate.signals.calendar) }}</p>
          <p class="mt-2 text-sm leading-6 text-slate-200">{{ calendarDetail(estimate.signals.calendar) }}</p>
        </div>
        <div class="rounded-[24px] border border-slate-700 bg-slate-950 px-5 py-4">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Incident override</p>
          <p class="mt-3 text-lg font-semibold text-white">{{ signedValue(estimate.signals.incidents?.score_delta) }}</p>
          <p class="mt-2 text-sm leading-6 text-slate-200">{{ incidentDetail(estimate.signals.incidents) }}</p>
        </div>
        <div class="rounded-[24px] border border-slate-700 bg-slate-950 px-5 py-4">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Observation drift</p>
          <p class="mt-3 text-lg font-semibold text-white">{{ signedValue(estimate.signals.observations?.score_delta) }}</p>
          <p class="mt-2 text-sm leading-6 text-slate-200">{{ observationDetail(estimate.signals.observations) }}</p>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Cache hit</p>
          <p class="mt-1 text-sm font-medium text-white">{{ estimate.meta.cache.hit ? 'Yes' : 'No' }}</p>
        </div>
        <div class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Cache age</p>
          <p class="mt-1 text-sm font-medium text-white">{{ formatDuration(estimate.meta.cache.age_ms ? estimate.meta.cache.age_ms / 1000 : 0) }}</p>
        </div>
        <div class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Commute points</p>
          <p class="mt-1 text-sm font-medium text-white">{{ Array.isArray(estimate.polyline) ? estimate.polyline.length : 0 }}</p>
        </div>
        <div class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Walking points</p>
          <p class="mt-1 text-sm font-medium text-white">{{ Array.isArray(estimate.walking_polyline) ? estimate.walking_polyline.length : 0 }}</p>
        </div>
        <div class="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Computed</p>
          <p class="mt-1 text-sm font-medium text-white">{{ formatTimestamp(estimate.computed_at) }}</p>
        </div>
      </div>
    </div>

    <p v-else class="text-sm text-slate-400">Select a route and fetch an estimate to inspect the live queue response.</p>
  </section>
</template>

<script setup>
import { formatDuration, formatTimestamp, levelClasses, sourceClasses, sourceLabel } from '@/lib/queuePrediction'

function formatWaitEstimate(waitEstimate) {
  if (!waitEstimate) return 'Unavailable'
  return `${waitEstimate.min_minutes}-${waitEstimate.max_minutes} min`
}

function formatMinutes(minutes) {
  if (typeof minutes !== 'number' || Number.isNaN(minutes)) return 'Unavailable'
  return `${minutes} min`
}

function formatRideEta(estimate) {
  const totalMinutes = Number(estimate?.recommendation?.ride_total_minutes)
  if (!Number.isFinite(totalMinutes)) return 'Unavailable'

  const computedAtMs = Date.parse(String(estimate?.computed_at || ''))
  const baseMs = Number.isFinite(computedAtMs) ? computedAtMs : Date.now()
  return new Date(baseMs + totalMinutes * 60_000).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function recommendationTitle(recommendation) {
  if (!recommendation) return 'Recommendation unavailable'
  if (recommendation.best_option === 'walk') return 'Walking looks faster'
  if (recommendation.best_option === 'ride') return 'Riding still looks faster'
  if (recommendation.best_option === 'either') return 'Either option looks similar'
  return 'Recommendation unavailable'
}

function weatherTitle(weather) {
  if (!weather) return 'No weather signal'
  return {
    clear: 'Dry conditions',
    light_rain: 'Light rain',
    moderate_rain: 'Moderate rain',
    heavy_rain: 'Heavy rain',
  }[weather.severity] ?? 'Weather unavailable'
}

function weatherDetail(weather) {
  if (!weather) return 'No weather signal available.'
  const parts = []
  if (typeof weather.precipitation_probability === 'number') parts.push(`${weather.precipitation_probability}% chance`)
  if (typeof weather.precipitation_mm === 'number') parts.push(`${weather.precipitation_mm} mm`)
  parts.push(`${signedValue(weather.score_delta)} score`)
  return parts.join(' • ')
}

function weatherClasses(severity) {
  return {
    clear: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
    light_rain: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200',
    moderate_rain: 'border-sky-400/40 bg-sky-500/10 text-sky-200',
    heavy_rain: 'border-indigo-400/40 bg-indigo-500/10 text-indigo-200',
  }[severity] ?? 'border-slate-600 bg-slate-800 text-slate-200'
}

function calendarTitle(calendar) {
  if (!calendar) return 'No calendar signal'
  if (calendar.holiday_name) return calendar.holiday_name
  if (calendar.is_holiday) return 'Holiday schedule'
  return 'Regular day'
}

function calendarDetail(calendar) {
  if (!calendar) return 'No calendar context available.'
  if (calendar.source === 'holiday_calendar') return 'Matched against the synced PH holiday calendar.'
  if (calendar.source === 'route_config') return 'Matched against the route-config fallback holiday list.'
  return 'No holiday adjustment applied.'
}

function incidentDetail(incidents) {
  if (!incidents?.active?.length) return 'No active event or traffic overrides.'
  if (incidents.active.length === 1) return incidents.active[0].title
  return `${incidents.active.length} active overrides are contributing to the score.`
}

function observationDetail(observations) {
  if (!observations) return 'No observation context available.'
  if (!observations.sample_count) return 'No matching observations for this hour band yet.'
  return `${observations.sample_count} samples • average score ${observations.average_score ?? 'n/a'}`
}

function observationChip(observations) {
  if (!observations?.sample_count) return '0 observation samples'
  return `${observations.sample_count} observation samples`
}

function signedValue(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 'n/a'
  return `${numeric > 0 ? '+' : ''}${numeric}`
}

defineProps({
  error: {
    type: String,
    default: '',
  },
  estimate: {
    type: Object,
    default: null,
  },
  loading: Boolean,
})

defineEmits(['refresh'])
</script>
