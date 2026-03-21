<template>
  <div class="mt-5 rounded-[24px] border border-stone-200 bg-stone-950 p-4 text-stone-100">
    <div class="mb-4 flex items-start justify-between gap-3">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">Route editor</p>
        <h3 class="text-lg font-semibold text-white">Change origin and destination</h3>
      </div>
      <button
        class="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-stone-200 transition hover:border-white hover:text-white"
        :disabled="!routeDetail"
        @click="resetDraft"
      >
        Reset
      </button>
    </div>

    <p v-if="saveError" class="mb-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
      {{ saveError }}
    </p>
    <p v-else-if="saveMessage" class="mb-4 rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
      {{ saveMessage }}
    </p>

    <div v-if="routeDetail" class="grid gap-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Label</span>
          <input v-model.trim="draft.label" type="text" class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300">
        </label>
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Timezone</span>
          <input v-model.trim="draft.timezone" type="text" class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300">
        </label>
      </div>

      <div class="grid gap-4 xl:grid-cols-2">
        <button class="rounded-[22px] border border-white/10 bg-white/5 p-4 text-left transition hover:border-amber-300 hover:bg-white/10" @click="openPicker('origin')">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Origin</p>
          <p class="mt-2 text-base font-semibold text-white">{{ coordinateLabel('origin') }}</p>
          <p class="mt-1 text-xs text-stone-400">Search a place or click on the map to select.</p>
        </button>

        <button class="rounded-[22px] border border-white/10 bg-white/5 p-4 text-left transition hover:border-amber-300 hover:bg-white/10" @click="openPicker('destination')">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Destination</p>
          <p class="mt-2 text-base font-semibold text-white">{{ coordinateLabel('destination') }}</p>
          <p class="mt-1 text-xs text-stone-400">Search a place or click on the map to select.</p>
        </button>
      </div>

      <div class="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Cache TTL in minutes</span>
          <input v-model.trim="draft.cacheTtlMinutes" type="number" min="1" step="1" class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300">
        </label>
        <label class="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-200">
          <input v-model="draft.isActive" type="checkbox" class="h-4 w-4 rounded border-stone-300">
          Active
        </label>
        <label class="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-200">
          <input v-model="draft.isDefault" type="checkbox" class="h-4 w-4 rounded border-stone-300">
          Default
        </label>
      </div>

      <div class="flex flex-wrap gap-3">
        <button
          class="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="savingRoute || !canSave"
          @click="submitRoute"
        >
          {{ savingRoute ? 'Saving...' : 'Save route' }}
        </button>
        <p class="self-center text-xs text-stone-400">
          Baselines, score bands, and holidays stay unchanged unless updated from a dedicated route-config surface.
        </p>
      </div>
    </div>

    <p v-else class="text-sm text-stone-400">Select a route to edit its prediction profile.</p>

    <QueueLocationPickerModal
      :coordinate="pickerTarget === 'origin' ? originCoordinate : destinationCoordinate"
      :open="pickerOpen"
      :title="pickerTarget === 'origin' ? 'Pick origin' : 'Pick destination'"
      @close="pickerOpen = false"
      @select="applyCoordinate"
    />
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'

import QueueLocationPickerModal from './QueueLocationPickerModal.vue'

const props = defineProps({
  routeDetail: { type: Object, default: null },
  saveError: { type: String, default: '' },
  saveMessage: { type: String, default: '' },
  savingRoute: Boolean,
})

const emit = defineEmits(['save-route'])

const draft = reactive({
  label: '',
  timezone: '',
  originLat: '',
  originLng: '',
  destinationLat: '',
  destinationLng: '',
  cacheTtlMinutes: '',
  isActive: true,
  isDefault: false,
})
const pickerOpen = ref(false)
const pickerTarget = ref('origin')

function syncDraft(route) {
  draft.label = route?.label ?? ''
  draft.timezone = route?.timezone ?? ''
  draft.originLat = route ? String(route.origin[1]) : ''
  draft.originLng = route ? String(route.origin[0]) : ''
  draft.destinationLat = route ? String(route.destination[1]) : ''
  draft.destinationLng = route ? String(route.destination[0]) : ''
  draft.cacheTtlMinutes = route ? String(Math.round(route.cache_ttl_ms / 60000)) : ''
  draft.isActive = route?.is_active ?? true
  draft.isDefault = route?.is_default ?? false
}

watch(() => props.routeDetail, syncDraft, { immediate: true })

const canSave = computed(() => Boolean(
  props.routeDetail
  && draft.label.trim()
  && draft.timezone.trim()
  && draft.originLat.trim()
  && draft.originLng.trim()
  && draft.destinationLat.trim()
  && draft.destinationLng.trim()
  && draft.cacheTtlMinutes.trim(),
))
const originCoordinate = computed(() => [Number(draft.originLng), Number(draft.originLat)])
const destinationCoordinate = computed(() => [Number(draft.destinationLng), Number(draft.destinationLat)])

function resetDraft() {
  syncDraft(props.routeDetail)
}

function coordinateLabel(target) {
  const lat = target === 'origin' ? draft.originLat : draft.destinationLat
  const lng = target === 'origin' ? draft.originLng : draft.destinationLng
  if (!lat || !lng) return 'No location selected'
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`
}

function openPicker(target) {
  pickerTarget.value = target
  pickerOpen.value = true
}

function applyCoordinate([lng, lat]) {
  if (pickerTarget.value === 'origin') {
    draft.originLat = String(lat)
    draft.originLng = String(lng)
    return
  }
  draft.destinationLat = String(lat)
  draft.destinationLng = String(lng)
}

function submitRoute() {
  if (!props.routeDetail) {
    return
  }

  emit('save-route', {
    label: draft.label.trim(),
    origin: [Number(draft.originLng), Number(draft.originLat)],
    destination: [Number(draft.destinationLng), Number(draft.destinationLat)],
    timezone: draft.timezone.trim(),
    cache_ttl_ms: Number(draft.cacheTtlMinutes) * 60_000,
    baseline_by_hour: props.routeDetail.baseline_by_hour,
    tod_score_by_hour: props.routeDetail.tod_score_by_hour,
    holidays: props.routeDetail.holidays,
    is_active: draft.isActive,
    is_default: draft.isDefault,
  })
}
</script>
