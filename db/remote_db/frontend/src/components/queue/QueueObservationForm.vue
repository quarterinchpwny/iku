<template>
  <div class="rounded-[1rem] border border-zinc-800 bg-zinc-950 px-5 py-4">
    <div class="mb-4">
      <p class="text-xs uppercase tracking-[0.18em] text-zinc-500">Observed queue</p>
      <h3 class="mt-2 text-lg font-semibold text-white">Log a real queue observation</h3>
    </div>

    <div class="grid gap-4">
      <div class="grid gap-4 md:grid-cols-2">
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Observed at</span>
          <input v-model="draft.observedAt" type="datetime-local" class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500">
        </label>
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Observed score</span>
          <input v-model.trim="draft.observedScore" type="number" min="0" max="10" step="0.1" class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500">
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Queue level</span>
          <select v-model="draft.queueLevel" class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500">
            <option value="">Not set</option>
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
            <option value="very_high">Very high</option>
          </select>
        </label>
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Wait minutes</span>
          <input v-model.trim="draft.waitMinutes" type="number" min="0" max="180" step="1" class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500">
        </label>
      </div>

      <label class="grid gap-2">
        <span class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Notes</span>
        <textarea v-model.trim="draft.notes" rows="3" class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500"></textarea>
      </label>

      <div class="flex flex-wrap gap-3">
        <button
          class="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="saving || !canSubmit"
          @click="submit"
        >
          {{ saving ? 'Saving...' : 'Add observation' }}
        </button>
        <button
          class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
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
