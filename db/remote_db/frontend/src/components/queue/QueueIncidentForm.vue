<template>
  <div class="rounded-[24px] border border-slate-700 bg-slate-950 px-5 py-4">
    <div class="mb-4">
      <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Route incidents</p>
      <h3 class="mt-2 text-lg font-semibold text-white">Add event or traffic advisory</h3>
    </div>

    <div class="grid gap-4">
      <div class="grid gap-4 md:grid-cols-2">
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Category</span>
          <select v-model="draft.category" class="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300">
            <option value="event">Event</option>
            <option value="traffic_advisory">Traffic advisory</option>
          </select>
        </label>
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Source</span>
          <input v-model.trim="draft.source" type="text" class="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300">
        </label>
      </div>

      <label class="grid gap-2">
        <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Title</span>
        <input v-model.trim="draft.title" type="text" class="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300">
      </label>

      <div class="grid gap-4 md:grid-cols-2">
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Nearby venue</span>
          <select v-model="selectedVenueId" class="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300">
            <option value="">None</option>
            <option v-for="venue in venueCandidates" :key="venue.id" :value="venue.id">
              {{ venue.label }}
            </option>
          </select>
        </label>
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Venue name</span>
          <input v-model.trim="draft.venueName" type="text" class="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300">
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Starts</span>
          <input v-model="draft.startsAt" type="datetime-local" class="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300">
        </label>
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Ends</span>
          <input v-model="draft.endsAt" type="datetime-local" class="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300">
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Score delta</span>
          <input v-model.trim="draft.scoreDelta" type="number" min="-2" max="4" step="0.1" class="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300">
        </label>
        <label class="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-200">
          <input v-model="draft.isActive" type="checkbox" class="h-4 w-4 rounded border-slate-300">
          Active now
        </label>
      </div>

      <label class="grid gap-2">
        <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Notes</span>
        <textarea v-model.trim="draft.notes" rows="3" class="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300"></textarea>
      </label>

      <div class="flex flex-wrap gap-3">
        <button
          class="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="saving || !canSubmit"
          @click="submit"
        >
          {{ saving ? 'Saving...' : 'Add incident' }}
        </button>
        <button
          class="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
          :disabled="saving"
          @click="resetDraft"
        >
          Reset
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps({
  routeKey: { type: String, default: '' },
  saving: Boolean,
  venueCandidates: { type: Array, default: () => [] },
})

const emit = defineEmits(['submit'])

const selectedVenueId = ref('')
const draft = reactive({
  category: 'event',
  title: '',
  venueName: '',
  startsAt: '',
  endsAt: '',
  scoreDelta: '1.2',
  source: 'dashboard_manual',
  notes: '',
  isActive: true,
})

function toDateTimeLocal(value) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function resetDraft() {
  const now = new Date()
  const end = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  selectedVenueId.value = ''
  draft.category = 'event'
  draft.title = ''
  draft.venueName = ''
  draft.startsAt = toDateTimeLocal(now)
  draft.endsAt = toDateTimeLocal(end)
  draft.scoreDelta = '1.2'
  draft.source = 'dashboard_manual'
  draft.notes = ''
  draft.isActive = true
}

watch(() => props.routeKey, () => {
  resetDraft()
}, { immediate: true })

watch(selectedVenueId, (venueId) => {
  const venue = props.venueCandidates.find((candidate) => candidate.id === venueId)
  if (!venue) {
    return
  }

  draft.venueName = venue.label
  if (!draft.title.trim()) {
    draft.title = venue.label
  }
})

const canSubmit = computed(() => Boolean(
  props.routeKey
  && draft.title.trim()
  && draft.source.trim()
  && draft.startsAt
  && draft.endsAt
  && draft.scoreDelta.trim(),
))

function submit() {
  if (!canSubmit.value) {
    return
  }

  emit('submit', {
    route_key: props.routeKey,
    category: draft.category,
    title: draft.title.trim(),
    venue_name: draft.venueName.trim() || null,
    starts_at: new Date(draft.startsAt).toISOString(),
    ends_at: new Date(draft.endsAt).toISOString(),
    score_delta: Number(draft.scoreDelta),
    source: draft.source.trim(),
    notes: draft.notes.trim(),
    is_active: draft.isActive,
  })
  resetDraft()
}
</script>
