<template>
  <section class="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p class="text-sm font-semibold text-white">{{ title }}</p>
        <p class="mt-1 text-sm text-zinc-400">
          {{ subtitle }}
        </p>
      </div>
      <button
        class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="saveDisabled"
        @click="openComposer"
      >
        Save current route
      </button>
    </div>

    <form
      v-if="composerOpen"
      class="mt-4 grid gap-3 rounded-lg border border-zinc-800 bg-zinc-900/80 p-3"
      @submit.prevent="submitPreset"
    >
      <label class="grid gap-1.5 text-sm text-zinc-300">
        <span>Name</span>
        <input
          v-model="draftLabel"
          class="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400"
          maxlength="48"
          placeholder="Work commute"
          type="text"
        >
      </label>

      <label class="flex items-center gap-2 text-sm text-zinc-300">
        <input
          v-model="draftDefault"
          class="h-4 w-4 rounded border-zinc-600 bg-zinc-950"
          type="checkbox"
        >
        Make this the default preset
      </label>

      <div class="flex gap-2">
        <button
          class="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-black transition hover:bg-orange-400"
          type="submit"
        >
          Save preset
        </button>
        <button
          class="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          type="button"
          @click="closeComposer"
        >
          Cancel
        </button>
      </div>
    </form>

    <div v-if="presets.length" class="mt-4 grid gap-2">
      <div
        v-for="preset in presets"
        :key="preset.id"
        class="flex items-center justify-between gap-3 rounded-lg border px-3 py-3"
        :class="preset.id === selectedPresetId ? 'border-orange-500 bg-[#1b140b]' : 'border-zinc-800 bg-zinc-900/70'"
      >
        <button
          class="min-w-0 flex-1 text-left"
          type="button"
          @click="$emit('select-preset', preset.id)"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-semibold" :class="preset.id === selectedPresetId ? 'text-orange-300' : 'text-white'">
              {{ preset.label }}
            </span>
            <span
              v-if="preset.is_default"
              class="rounded-md border border-zinc-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-300"
            >
              Default
            </span>
            <span
              v-if="preset.id === selectedPresetId"
              class="rounded-md border border-orange-500/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-300"
            >
              Active
            </span>
          </div>
          <p class="mt-1 text-xs text-zinc-500">
            {{ routeLabel(preset.route_key) }}
          </p>
        </button>

        <button
          class="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-rose-500 hover:text-rose-300"
          type="button"
          @click="$emit('delete-preset', preset.id)"
        >
          Remove
        </button>
      </div>
    </div>

    <p v-else class="mt-4 text-sm text-zinc-500">
      No presets saved yet.
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PropType } from 'vue';

type QueueCommutePreset = {
  id: string;
  is_default: boolean;
  label: string;
  route_key: string;
};

type QueueRouteSummary = {
  label: string;
  route_key: string;
};

const props = defineProps({
  presets: {
    type: Array as PropType<QueueCommutePreset[]>,
    default: () => []
  },
  routes: {
    type: Array as PropType<QueueRouteSummary[]>,
    default: () => []
  },
  saveDisabled: Boolean,
  selectedPresetId: {
    type: String,
    default: ''
  },
  selectedRouteKey: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: 'Saved presets'
  }
});

const emit = defineEmits<{
  'delete-preset': [presetId: string];
  'save-preset': [payload: { is_default: boolean; label: string }];
  'select-preset': [presetId: string];
}>();

const composerOpen = ref(false);
const draftDefault = ref(false);
const draftLabel = ref('');

const subtitle = computed(() => {
  const route = props.routes.find((candidate) => candidate.route_key === props.selectedRouteKey);
  if (!route) {
    return 'Pick a route first, then save it as a named preset.';
  }

  return `Current route: ${route.label}`;
});

function routeLabel(routeKey: string): string {
  return props.routes.find((route) => route.route_key === routeKey)?.label ?? routeKey;
}

function openComposer() {
  if (props.saveDisabled) {
    return;
  }

  draftLabel.value = routeLabel(props.selectedRouteKey);
  draftDefault.value = props.presets.length === 0;
  composerOpen.value = true;
}

function closeComposer() {
  composerOpen.value = false;
  draftLabel.value = '';
  draftDefault.value = false;
}

function submitPreset() {
  const label = draftLabel.value.trim();
  if (!label) {
    return;
  }

  emit('save-preset', {
    is_default: draftDefault.value,
    label
  });
  closeComposer();
}
</script>
