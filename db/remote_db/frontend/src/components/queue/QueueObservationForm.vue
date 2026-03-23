<template>
  <div class="rounded-[24px] border border-slate-700 bg-slate-950 px-5 py-4">
    <div class="mb-4">
      <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Observed queue</p>
      <h3 class="mt-2 text-lg font-semibold text-white">Log a real queue observation</h3>
    </div>

    <div class="grid gap-4">
      <div class="grid gap-4 md:grid-cols-2">
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Observed at</span>
          <input v-model="draft.observedAt" type="datetime-local" class="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300">
        </label>
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Observed score</span>
          <input v-model.trim="draft.observedScore" type="number" min="0" max="10" step="0.1" class="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300">
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Queue level</span>
          <select v-model="draft.queueLevel" class="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300">
            <option value="">Not set</option>
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
            <option value="very_high">Very high</option>
          </select>
        </label>
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Wait minutes</span>
          <input v-model.trim="draft.waitMinutes" type="number" min="0" max="180" step="1" class="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300">
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
          {{ saving ? 'Saving...' : 'Add observation' }}
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
import { computed, reactive, watch } from 'vue'

const props = defineProps({
  routeKey: { type: String, default: '' },
  saving: Boolean,
})

const emit = defineEmits(['submit'])

const draft = reactive({
  observedAt: '',
  observedScore: '5',
  queueLevel: '',
  waitMinutes: '',
  notes: '',
})

function toDateTimeLocal(value) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function resetDraft() {
  draft.observedAt = toDateTimeLocal(new Date())
  draft.observedScore = '5'
  draft.queueLevel = ''
  draft.waitMinutes = ''
  draft.notes = ''
}

watch(() => props.routeKey, () => {
  resetDraft()
}, { immediate: true })

const canSubmit = computed(() => Boolean(
  props.routeKey
  && draft.observedAt
  && draft.observedScore.trim(),
))

function submit() {
  if (!canSubmit.value) {
    return
  }

  emit('submit', {
    route_key: props.routeKey,
    observed_at: new Date(draft.observedAt).getTime(),
    queue_level: draft.queueLevel || null,
    wait_minutes: draft.waitMinutes.trim() ? Number(draft.waitMinutes) : null,
    observed_score: Number(draft.observedScore),
    notes: draft.notes.trim(),
  })
  resetDraft()
}
</script>
