<template>
  <section class="rounded-[1rem] border border-zinc-800 bg-zinc-950 p-5">
    <div class="mb-5 flex items-start justify-between gap-4">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Demand Context</p>
        <h2 class="text-2xl font-semibold text-white">Rain, calendar, events, observations</h2>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs text-zinc-200">
          <span>Year</span>
          <input v-model.trim="draftYear" type="number" min="2020" max="2100" class="w-20 bg-transparent text-right text-white outline-none">
        </label>
        <button
          class="rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-xs font-medium text-orange-200 transition hover:border-orange-400 hover:text-orange-100"
          :disabled="loadingHolidays"
          @click="$emit('sync-holidays', Number(draftYear))"
        >
          {{ loadingHolidays ? 'Syncing...' : 'Sync official holidays' }}
        </button>
        <button
          class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-orange-500/50 hover:text-white"
          :disabled="loadingVenues || !routeDetail"
          @click="$emit('discover-venues', radiusMeters)"
        >
          {{ loadingVenues ? 'Scanning...' : 'Discover nearby venues' }}
        </button>
      </div>
    </div>

    <div class="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-lg border border-zinc-800 bg-[#111418] px-4 py-3">
        <p class="text-xs uppercase tracking-[0.18em] text-zinc-500">Weather</p>
        <p class="mt-2 text-lg font-semibold text-white">{{ weatherTitle }}</p>
        <p class="mt-1 text-sm text-zinc-300">{{ weatherDetail }}</p>
      </div>
      <div class="rounded-lg border border-zinc-800 bg-[#111418] px-4 py-3">
        <p class="text-xs uppercase tracking-[0.18em] text-zinc-500">Calendar</p>
        <p class="mt-2 text-lg font-semibold text-white">{{ calendarTitle }}</p>
        <p class="mt-1 text-sm text-zinc-300">{{ calendarDetail }}</p>
      </div>
      <div class="rounded-lg border border-zinc-800 bg-[#111418] px-4 py-3">
        <p class="text-xs uppercase tracking-[0.18em] text-zinc-500">Active incidents</p>
        <p class="mt-2 text-lg font-semibold text-white">{{ incidents.length }}</p>
        <p class="mt-1 text-sm text-zinc-300">{{ incidentDetail }}</p>
      </div>
      <div class="rounded-lg border border-zinc-800 bg-[#111418] px-4 py-3">
        <p class="text-xs uppercase tracking-[0.18em] text-zinc-500">Observation delta</p>
        <p class="mt-2 text-lg font-semibold text-white">{{ observationTitle }}</p>
        <p class="mt-1 text-sm text-zinc-300">{{ observationDetail }}</p>
      </div>
    </div>

    <div class="mb-5 grid gap-3">
      <p v-if="holidayError || contextError || venueError" class="rounded-lg border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">
        {{ holidayError || contextError || venueError }}
      </p>
      <p v-else-if="contextMessage" class="rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
        {{ contextMessage }}
      </p>
    </div>

    <div class="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <div class="space-y-4">
        <div class="rounded-[1rem] border border-zinc-800 bg-zinc-950 px-5 py-4">
          <div class="mb-4 flex items-start justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-[0.18em] text-zinc-500">Nearby venues</p>
              <h3 class="mt-2 text-lg font-semibold text-white">Discovery results</h3>
            </div>
            <div class="flex items-center gap-3">
              <label class="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs text-zinc-200">
                <span>Radius</span>
                <input v-model.trim="radiusMeters" type="number" min="250" max="10000" step="250" class="w-20 bg-transparent text-right text-white outline-none">
                <span>m</span>
              </label>
              <button
                class="rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-xs font-medium text-orange-200 transition hover:border-orange-400 hover:text-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="!routeDetail"
                @click="incidentModalOpen = true"
              >
                Add incident
              </button>
            </div>
          </div>
          <div v-if="venueCandidates.length" class="grid gap-3">
            <div v-for="venue in venueCandidates" :key="venue.id" class="rounded-lg border border-zinc-800 bg-[#111418] px-4 py-3">
              <p class="text-sm font-semibold text-white">{{ venue.label }}</p>
              <p class="mt-1 text-sm text-zinc-300">{{ venue.address || 'No address returned' }}</p>
            </div>
          </div>
          <p v-else class="text-sm text-zinc-500">Run venue discovery to find stadiums, halls, and other event anchors near the route endpoints.</p>
        </div>

        <div class="rounded-[1rem] border border-zinc-800 bg-zinc-950 px-5 py-4">
          <div class="mb-4 flex items-center justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-[0.18em] text-zinc-500">Configured incidents</p>
              <h3 class="mt-2 text-lg font-semibold text-white">Active and scheduled overrides</h3>
            </div>
            <span v-if="loadingContext" class="text-xs text-zinc-500">Updating...</span>
          </div>

          <div v-if="incidents.length" class="grid gap-3">
            <div v-for="incident in incidents" :key="incident.id" class="rounded-lg border border-zinc-800 bg-[#111418] px-4 py-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-white">{{ incident.title }}</p>
                  <p class="mt-1 text-sm text-zinc-300">{{ incident.venue_name || incident.category.replace('_', ' ') }}</p>
                  <p class="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                    {{ formatTimestamp(incident.starts_at) }} to {{ formatTimestamp(incident.ends_at) }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
                    {{ formatSigned(incident.score_delta) }}
                  </span>
                  <button
                    class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-200 transition hover:border-rose-400 hover:text-white"
                    :disabled="loadingContext"
                    @click="$emit('delete-incident', incident.id)"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-zinc-500">No route incidents recorded yet.</p>
        </div>
      </div>

      <div class="space-y-4">
        <div class="rounded-[1rem] border border-zinc-800 bg-zinc-950 px-5 py-4">
          <div class="mb-4 flex items-center justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-[0.18em] text-zinc-500">Recent observations</p>
              <h3 class="mt-2 text-lg font-semibold text-white">Calibration inputs</h3>
            </div>
            <div class="flex items-center gap-3">
              <span v-if="loadingContext" class="text-xs text-zinc-500">Updating...</span>
              <button
                class="rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-xs font-medium text-orange-200 transition hover:border-orange-400 hover:text-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="!routeDetail"
                @click="observationModalOpen = true"
              >
                Add observation
              </button>
            </div>
          </div>

          <div v-if="observations.length" class="grid gap-3">
            <div v-for="observation in observations" :key="observation.id" class="rounded-lg border border-zinc-800 bg-[#111418] px-4 py-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-white">Score {{ observation.observed_score }}</p>
                  <p class="mt-1 text-sm text-zinc-300">
                    {{ observation.queue_level ? observation.queue_level.replace('_', ' ') : 'Queue level not set' }}
                    <span v-if="observation.wait_minutes != null"> • {{ observation.wait_minutes }} min wait</span>
                  </p>
                  <p class="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-500">{{ formatTimestamp(observation.observed_at) }}</p>
                  <p v-if="observation.notes" class="mt-2 text-sm text-zinc-300">{{ observation.notes }}</p>
                </div>
                <button
                  class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-200 transition hover:border-rose-400 hover:text-white"
                  :disabled="loadingContext"
                  @click="$emit('delete-observation', observation.id)"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-zinc-500">No observations logged yet.</p>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="incidentModalOpen"
        class="fixed inset-0 z-[2200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        @click="incidentModalOpen = false"
      >
        <div
          class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[20px] border border-zinc-800 bg-[#111418] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          @click.stop
        >
          <div class="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4 sm:px-6">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Route Incident</p>
              <h3 class="mt-2 text-2xl font-semibold text-white">Add event or traffic advisory</h3>
            </div>
            <button
              class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
              :disabled="loadingContext"
              @click="incidentModalOpen = false"
            >
              Close
            </button>
          </div>

          <div class="px-5 py-5 sm:px-6">
            <QueueIncidentForm
              :route-key="routeDetail?.route_key ?? ''"
              :saving="loadingContext"
              :venue-candidates="venueCandidates"
              @submit="handleCreateIncident"
            />
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="observationModalOpen"
        class="fixed inset-0 z-[2200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        @click="observationModalOpen = false"
      >
        <div
          class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[20px] border border-zinc-800 bg-[#111418] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          @click.stop
        >
          <div class="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4 sm:px-6">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Queue Observation</p>
              <h3 class="mt-2 text-2xl font-semibold text-white">Log a real queue observation</h3>
            </div>
            <button
              class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
              :disabled="loadingContext"
              @click="observationModalOpen = false"
            >
              Close
            </button>
          </div>

          <div class="px-5 py-5 sm:px-6">
            <QueueObservationForm
              :route-key="routeDetail?.route_key ?? ''"
              :saving="loadingContext"
              @submit="handleCreateObservation"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

import QueueIncidentForm from './QueueIncidentForm.vue'
import QueueObservationForm from './QueueObservationForm.vue'
import { formatTimestamp } from '@/lib/queuePrediction'

const props = defineProps({
  contextError: { type: String, default: '' },
  contextMessage: { type: String, default: '' },
  estimate: { type: Object, default: null },
  holidayError: { type: String, default: '' },
  holidayYear: { type: Number, default: new Date().getFullYear() },
  incidents: { type: Array, default: () => [] },
  loadingContext: Boolean,
  loadingHolidays: Boolean,
  loadingVenues: Boolean,
  observations: { type: Array, default: () => [] },
  routeDetail: { type: Object, default: null },
  venueCandidates: { type: Array, default: () => [] },
  venueError: { type: String, default: '' },
})

const emit = defineEmits([
  'create-incident',
  'create-observation',
  'delete-incident',
  'delete-observation',
  'discover-venues',
  'sync-holidays',
])

const draftYear = ref(String(props.holidayYear))
const radiusMeters = ref('2500')
const incidentModalOpen = ref(false)
const observationModalOpen = ref(false)

watch(() => props.holidayYear, (value) => {
  draftYear.value = String(value)
}, { immediate: true })

const weatherSignal = computed(() => props.estimate?.signals?.weather ?? null)
const calendarSignal = computed(() => props.estimate?.signals?.calendar ?? null)
const incidentSignal = computed(() => props.estimate?.signals?.incidents ?? null)
const observationSignal = computed(() => props.estimate?.signals?.observations ?? null)

const weatherTitle = computed(() => {
  const severity = weatherSignal.value?.severity
  if (severity === 'heavy_rain') return 'Heavy rain'
  if (severity === 'moderate_rain') return 'Moderate rain'
  if (severity === 'light_rain') return 'Light rain'
  return 'Dry conditions'
})

const weatherDetail = computed(() => {
  if (!weatherSignal.value) return 'No weather signal yet.'
  const probability = weatherSignal.value.precipitation_probability
  const rainfall = weatherSignal.value.precipitation_mm
  const parts = []
  if (typeof probability === 'number') parts.push(`${probability}% precip chance`)
  if (typeof rainfall === 'number') parts.push(`${rainfall} mm precip`)
  parts.push(formatSigned(weatherSignal.value.score_delta))
  return parts.join(' • ')
})

const calendarTitle = computed(() => {
  if (calendarSignal.value?.holiday_name) return calendarSignal.value.holiday_name
  if (calendarSignal.value?.is_holiday) return 'Holiday schedule'
  return 'Regular workday'
})

const calendarDetail = computed(() => {
  if (!calendarSignal.value) return 'No calendar signal yet.'
  if (calendarSignal.value.source === 'holiday_calendar') return 'Official holiday calendar'
  if (calendarSignal.value.source === 'route_config') return 'Route-config fallback'
  return 'No holiday adjustment'
})

const incidentDetail = computed(() => {
  if (!incidentSignal.value) return 'No route incidents loaded.'
  return `${formatSigned(incidentSignal.value.score_delta)} total score delta`
})

const observationTitle = computed(() => {
  if (!observationSignal.value) return 'No observation signal'
  return formatSigned(observationSignal.value.score_delta)
})

const observationDetail = computed(() => {
  if (!observationSignal.value) return 'No observations loaded.'
  if (!observationSignal.value.sample_count) return 'No matching samples yet'
  return `${observationSignal.value.sample_count} samples • avg ${observationSignal.value.average_score ?? 'n/a'}`
})

function formatSigned(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 'n/a'
  }
  return `${numeric > 0 ? '+' : ''}${numeric}`
}

function handleCreateIncident(payload) {
  incidentModalOpen.value = false
  emit('create-incident', payload)
}

function handleCreateObservation(payload) {
  observationModalOpen.value = false
  emit('create-observation', payload)
}
</script>
