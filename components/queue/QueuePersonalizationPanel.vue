<template>
  <section class="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-sm font-semibold text-white">Door-to-door adjustment</p>
        <p class="mt-1 text-sm text-zinc-400">
          {{ routeLabel ? `Tune access assumptions for ${routeLabel}.` : 'Pick a route to tune access assumptions.' }}
        </p>
      </div>
      <div v-if="helperText" class="text-right text-xs text-zinc-500">
        {{ helperText }}
      </div>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-3">
      <label class="grid gap-1.5 text-sm text-zinc-300">
        <span>Access to route</span>
        <input
          v-model.number="draft.access_minutes"
          :disabled="disabled"
          class="rounded-md border border-zinc-700 bg-[#111418] px-3 py-2 text-white outline-none transition focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
          min="0"
          step="1"
          type="number"
        >
      </label>

      <label class="grid gap-1.5 text-sm text-zinc-300">
        <span>Exit from route</span>
        <input
          v-model.number="draft.egress_minutes"
          :disabled="disabled"
          class="rounded-md border border-zinc-700 bg-[#111418] px-3 py-2 text-white outline-none transition focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
          min="0"
          step="1"
          type="number"
        >
      </label>

      <label class="grid gap-1.5 text-sm text-zinc-300">
        <span>Max walking time</span>
        <input
          v-model.number="draft.max_walk_minutes"
          :disabled="disabled"
          class="rounded-md border border-zinc-700 bg-[#111418] px-3 py-2 text-white outline-none transition focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
          min="0"
          step="1"
          type="number"
        >
      </label>
    </div>

    <div class="mt-4 flex items-center justify-between gap-3">
      <p class="text-xs text-zinc-500">
        Values are stored on this device per route.
      </p>
      <div class="flex items-center gap-2">
        <button
          :disabled="disabled"
          class="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          @click="$emit('reset')"
        >
          Reset
        </button>
        <button
          :disabled="disabled"
          class="rounded-md border border-orange-700 bg-orange-950 px-3 py-2 text-sm text-orange-200 transition hover:border-orange-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          @click="handleSave"
        >
          Apply
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { normalizeQueuePersonalization } from '~/lib/queuePersonalization';

const props = defineProps({
  disabled: Boolean,
  helperText: { type: String, default: '' },
  personalization: {
    type: Object,
    default: () => ({
      access_minutes: 0,
      egress_minutes: 0,
      max_walk_minutes: null,
    }),
  },
  routeLabel: { type: String, default: '' },
});

const emit = defineEmits(['reset', 'save']);

const draft = reactive(normalizeQueuePersonalization(props.personalization));

watch(
  () => props.personalization,
  (value) => {
    const normalized = normalizeQueuePersonalization(value);
    draft.access_minutes = normalized.access_minutes;
    draft.egress_minutes = normalized.egress_minutes;
    draft.max_walk_minutes = normalized.max_walk_minutes;
  },
  { deep: true, immediate: true }
);

function handleSave() {
  emit('save', normalizeQueuePersonalization(draft));
}
</script>
