<template>
  <div :class="editorMode === 'create' ? 'rounded-[1rem] border border-zinc-800 bg-zinc-950 p-4 text-zinc-100' : 'mt-5 rounded-[1rem] border border-zinc-800 bg-zinc-950 p-4 text-zinc-100'">
    <div class="mb-4 flex items-start justify-between gap-3">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Route editor</p>
        <h3 class="text-lg font-semibold text-white">{{ editorMode === 'create' ? 'Create a new route key' : 'Change origin and destination' }}</h3>
      </div>
      <button
        class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
        :disabled="!sourceRoute"
        @click="resetDraft"
      >
        Reset
      </button>
    </div>

    <p v-if="saveError" class="mb-4 rounded-lg border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">
      {{ saveError }}
    </p>
    <p v-else-if="saveMessage" class="mb-4 rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
      {{ saveMessage }}
    </p>

    <div v-if="sourceRoute" class="grid gap-4">
      <label v-if="editorMode === 'create'" class="grid gap-2">
        <span class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Route key</span>
        <input
          :value="draft.routeKey"
          type="text"
          class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500"
          @input="updateRouteKey"
        >
        <span class="text-xs text-zinc-500">Lowercase letters, numbers, and hyphens only.</span>
      </label>

      <div class="grid gap-4 sm:grid-cols-2">
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Label</span>
          <input v-model.trim="draft.label" type="text" class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500">
        </label>
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Timezone</span>
          <input v-model.trim="draft.timezone" type="text" class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500">
        </label>
      </div>

      <div class="grid gap-4 xl:grid-cols-2">
        <button class="rounded-lg border border-zinc-800 bg-[#111418] p-4 text-left transition hover:border-orange-500/50" @click="openPicker('origin')">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Origin</p>
          <p class="mt-2 text-base font-semibold text-white">{{ coordinateLabel('origin') }}</p>
          <p class="mt-1 text-xs text-zinc-500">Search a place or click on the map to select.</p>
        </button>

        <button class="rounded-lg border border-zinc-800 bg-[#111418] p-4 text-left transition hover:border-orange-500/50" @click="openPicker('destination')">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Destination</p>
          <p class="mt-2 text-base font-semibold text-white">{{ coordinateLabel('destination') }}</p>
          <p class="mt-1 text-xs text-zinc-500">Search a place or click on the map to select.</p>
        </button>
      </div>

      <div class="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Cache TTL in minutes</span>
          <input v-model.trim="draft.cacheTtlMinutes" type="number" min="1" step="1" class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500">
        </label>
        <label class="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">
          <input v-model="draft.isActive" type="checkbox" class="h-4 w-4 rounded border-zinc-300">
          Active
        </label>
        <label class="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">
          <input v-model="draft.isDefault" type="checkbox" class="h-4 w-4 rounded border-zinc-300">
          Default
        </label>
      </div>

      <div class="flex flex-wrap gap-3">
        <button
          class="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="savingRoute || !canSave"
          @click="submitRoute"
        >
          {{ savingRoute ? (editorMode === 'create' ? 'Creating...' : 'Saving...') : (editorMode === 'create' ? 'Create route' : 'Save route') }}
        </button>
        <p class="self-center text-xs text-zinc-500">
          {{ editorMode === 'create'
            ? 'Hourly baselines, score bands, and holidays are copied from the selected template route.'
            : 'Baselines, score bands, and holidays stay unchanged unless updated from a dedicated route-config surface.' }}
        </p>
      </div>
    </div>

    <p v-else class="text-sm text-zinc-500">Select a route to edit its prediction profile.</p>

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
import { slugifyRouteKey } from '@/lib/queuePrediction'

const props = defineProps({
  createTemplate: { type: Object, default: null },
  editorMode: { type: String, default: 'edit' },
  routeDetail: { type: Object, default: null },
  saveError: { type: String, default: '' },
  saveMessage: { type: String, default: '' },
  savingRoute: Boolean,
})

const emit = defineEmits(['create-route', 'save-route'])

const draft = reactive({
  routeKey: '',
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
const routeKeyTouched = ref(false)

const sourceRoute = computed(() => (
  props.editorMode === 'create'
    ? props.createTemplate
    : props.routeDetail
))

function syncDraft(route) {
  const createMode = props.editorMode === 'create'
  const initialLabel = createMode
    ? route?.label ? `${route.label} Variant` : ''
    : route?.label ?? ''
  draft.routeKey = createMode ? slugifyRouteKey(initialLabel) : ''
  routeKeyTouched.value = false
  draft.label = initialLabel
  draft.timezone = route?.timezone ?? ''
  draft.originLat = route ? String(route.origin[1]) : ''
  draft.originLng = route ? String(route.origin[0]) : ''
  draft.destinationLat = route ? String(route.destination[1]) : ''
  draft.destinationLng = route ? String(route.destination[0]) : ''
  draft.cacheTtlMinutes = route ? String(Math.round(route.cache_ttl_ms / 60000)) : ''
  draft.isActive = route?.is_active ?? true
  draft.isDefault = route?.is_default ?? false
}

watch([() => props.editorMode, sourceRoute], ([, route]) => {
  syncDraft(route)
}, { immediate: true })

watch(() => draft.label, (label) => {
  if (props.editorMode !== 'create' || routeKeyTouched.value) {
    return
  }

  draft.routeKey = slugifyRouteKey(label)
})

const canSave = computed(() => Boolean(
  sourceRoute.value
  && (props.editorMode !== 'create' || draft.routeKey.trim())
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
  syncDraft(sourceRoute.value)
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

function updateRouteKey(event) {
  routeKeyTouched.value = true
  draft.routeKey = slugifyRouteKey(event.target.value)
}

function submitRoute() {
  if (!sourceRoute.value) {
    return
  }

  const payload = {
    label: draft.label.trim(),
    origin: [Number(draft.originLng), Number(draft.originLat)],
    destination: [Number(draft.destinationLng), Number(draft.destinationLat)],
    timezone: draft.timezone.trim(),
    cache_ttl_ms: Number(draft.cacheTtlMinutes) * 60_000,
    baseline_by_hour: sourceRoute.value.baseline_by_hour,
    tod_score_by_hour: sourceRoute.value.tod_score_by_hour,
    holidays: sourceRoute.value.holidays,
    is_active: draft.isActive,
    is_default: draft.isDefault,
  }

  if (props.editorMode === 'create') {
    emit('create-route', {
      route_key: draft.routeKey.trim(),
      ...payload,
    })
    return
  }

  emit('save-route', payload)
}
</script>
