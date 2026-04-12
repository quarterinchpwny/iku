<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[2200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      @click.self="closeModal"
    >
      <div class="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[20px] border border-zinc-800 bg-[#111418] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div class="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4">
          <div>
            <p class="text-sm font-semibold text-white">Create route</p>
            <p class="mt-1 text-sm text-zinc-500">
              {{ templateRoute ? `Template: ${templateRoute.label}` : 'Load a template route first.' }}
            </p>
          </div>
          <button
            class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            :disabled="saving"
            @click="closeModal"
          >
            Close
          </button>
        </div>

        <div class="px-5 py-5">
          <p v-if="loadError" class="mb-4 rounded-lg border border-rose-900 bg-rose-950 px-4 py-3 text-sm text-rose-300">
            {{ loadError }}
          </p>
          <p v-else-if="loadingTemplate" class="mb-4 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
            Loading template route...
          </p>

          <div v-if="templateRoute" class="grid gap-4">
            <p v-if="saveError" class="rounded-lg border border-rose-900 bg-rose-950 px-4 py-3 text-sm text-rose-300">
              {{ saveError }}
            </p>

            <label class="grid gap-2 text-sm text-zinc-300">
              <span>Route key</span>
              <input
                :value="draft.routeKey"
                type="text"
                class="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400"
                @input="updateRouteKey"
              >
              <span class="text-xs text-zinc-500">Lowercase letters, numbers, and hyphens only.</span>
            </label>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="grid gap-2 text-sm text-zinc-300">
                <span>Label</span>
                <input v-model.trim="draft.label" type="text" class="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400">
              </label>
              <label class="grid gap-2 text-sm text-zinc-300">
                <span>Timezone</span>
                <input v-model.trim="draft.timezone" type="text" class="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400">
              </label>
            </div>

            <div class="grid gap-4 xl:grid-cols-2">
              <button class="rounded-[16px] border border-zinc-800 bg-zinc-950 p-4 text-left transition hover:border-orange-400" @click="openPicker('origin')">
                <p class="text-sm font-semibold text-white">Origin</p>
                <p class="mt-2 text-sm text-zinc-300">{{ coordinateLabel('origin') }}</p>
                <p class="mt-1 text-xs text-zinc-500">Search a place or click on the map.</p>
              </button>

              <button class="rounded-[16px] border border-zinc-800 bg-zinc-950 p-4 text-left transition hover:border-orange-400" @click="openPicker('destination')">
                <p class="text-sm font-semibold text-white">Destination</p>
                <p class="mt-2 text-sm text-zinc-300">{{ coordinateLabel('destination') }}</p>
                <p class="mt-1 text-xs text-zinc-500">Search a place or click on the map.</p>
              </button>
            </div>

            <div class="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <label class="grid gap-2 text-sm text-zinc-300">
                <span>Cache TTL in minutes</span>
                <input v-model.trim="draft.cacheTtlMinutes" type="number" min="1" step="1" class="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400">
              </label>
              <label class="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
                <input v-model="draft.isActive" type="checkbox" class="h-4 w-4 rounded border-zinc-600 bg-zinc-950">
                Active
              </label>
              <label class="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
                <input v-model="draft.isDefault" type="checkbox" class="h-4 w-4 rounded border-zinc-600 bg-zinc-950">
                Default
              </label>
            </div>

            <div class="flex flex-wrap gap-3">
              <button
                class="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="saving || !canSave"
                @click="submitRoute"
              >
                {{ saving ? 'Creating...' : 'Create route' }}
              </button>
              <button
                class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                :disabled="saving"
                @click="resetDraft"
              >
                Reset
              </button>
              <p class="self-center text-xs text-zinc-500">
                Baselines, score bands, and holidays are copied from the template route.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <RoutesLocationPickerModal
    :coordinate="pickerTarget === 'origin' ? originCoordinate : destinationCoordinate"
    :open="pickerOpen"
    :title="pickerTarget === 'origin' ? 'Pick origin' : 'Pick destination'"
    @close="pickerOpen = false"
    @select="applyCoordinate"
  />
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import RoutesLocationPickerModal from '~/components/routes/RoutesLocationPickerModal.vue';
import { slugifyQueueRouteKey, trimQueueRouteApiBase } from '~/lib/queueRouteAdmin';
import { useAuthStore } from '~/stores/auth';

type QueueRouteTemplate = {
  route_key: string;
  label: string;
  timezone: string;
  origin: [number, number];
  destination: [number, number];
  cache_ttl_ms: number;
  baseline_by_hour: number[];
  tod_score_by_hour: number[];
  holidays: string[];
  is_active: boolean;
  is_default: boolean;
};

const props = defineProps({
  open: Boolean,
  templateRouteKey: {
    type: String,
    default: ''
  }
});

const emit = defineEmits<{
  close: [];
  created: [routeKey: string];
}>();

const authStore = useAuthStore();
const config = useRuntimeConfig();
const templateRoute = ref<QueueRouteTemplate | null>(null);
const loadingTemplate = ref(false);
const loadError = ref('');
const saveError = ref('');
const saving = ref(false);
const pickerOpen = ref(false);
const pickerTarget = ref<'origin' | 'destination'>('origin');
const routeKeyTouched = ref(false);

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
  isDefault: false
});

const originCoordinate = computed<[number, number]>(() => [
  Number(draft.originLng),
  Number(draft.originLat)
]);
const destinationCoordinate = computed<[number, number]>(() => [
  Number(draft.destinationLng),
  Number(draft.destinationLat)
]);
const canSave = computed(() => Boolean(
  templateRoute.value &&
    draft.routeKey.trim() &&
    draft.label.trim() &&
    draft.timezone.trim() &&
    draft.originLat.trim() &&
    draft.originLng.trim() &&
    draft.destinationLat.trim() &&
    draft.destinationLng.trim() &&
    draft.cacheTtlMinutes.trim()
));

function apiBase(): string {
  const configured = String(config.public.cfURL || '').trim();
  if (configured) return trimQueueRouteApiBase(configured);
  if (import.meta.client && window.location.origin) return trimQueueRouteApiBase(window.location.origin);
  return '';
}

function buildUrl(path: string): URL {
  const base = apiBase();
  if (!base) throw new Error('Queue API base URL is unavailable.');
  return new URL(path, `${base}/`);
}

async function parseResponse(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function resolveErrorMessage(response: Response, payload: any, fallback: string): string {
  if (payload && typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }
  return response.statusText || fallback;
}

function syncDraft(route: QueueRouteTemplate | null) {
  const initialLabel = route?.label ? `${route.label} Variant` : '';
  draft.routeKey = slugifyQueueRouteKey(initialLabel);
  routeKeyTouched.value = false;
  draft.label = initialLabel;
  draft.timezone = route?.timezone ?? '';
  draft.originLat = route ? String(route.origin[1]) : '';
  draft.originLng = route ? String(route.origin[0]) : '';
  draft.destinationLat = route ? String(route.destination[1]) : '';
  draft.destinationLng = route ? String(route.destination[0]) : '';
  draft.cacheTtlMinutes = route ? String(Math.round(route.cache_ttl_ms / 60_000)) : '';
  draft.isActive = route?.is_active ?? true;
  draft.isDefault = route?.is_default ?? false;
}

function closeModal() {
  emit('close');
}

async function loadTemplateRoute() {
  if (!props.templateRouteKey) {
    templateRoute.value = null;
    loadError.value = 'Choose a template route first.';
    return;
  }

  loadingTemplate.value = true;
  loadError.value = '';
  saveError.value = '';

  try {
    const response = await fetch(buildUrl(`/api/puv-queue/routes/${props.templateRouteKey}`), {
      headers: { accept: 'application/json' }
    });
    const payload = await parseResponse(response);
    if (!response.ok) {
      throw new Error(resolveErrorMessage(response, payload, 'Failed to load template route.'));
    }
    templateRoute.value = payload as QueueRouteTemplate;
    syncDraft(templateRoute.value);
  } catch (error) {
    templateRoute.value = null;
    loadError.value = error instanceof Error ? error.message : 'Failed to load template route.';
  } finally {
    loadingTemplate.value = false;
  }
}

function coordinateLabel(target: 'origin' | 'destination'): string {
  const lat = target === 'origin' ? draft.originLat : draft.destinationLat;
  const lng = target === 'origin' ? draft.originLng : draft.destinationLng;
  if (!lat || !lng) return 'No location selected';
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
}

function openPicker(target: 'origin' | 'destination') {
  pickerTarget.value = target;
  pickerOpen.value = true;
}

function applyCoordinate([lng, lat]: [number, number]) {
  if (pickerTarget.value === 'origin') {
    draft.originLat = String(lat);
    draft.originLng = String(lng);
    return;
  }
  draft.destinationLat = String(lat);
  draft.destinationLng = String(lng);
}

function updateRouteKey(event: Event) {
  routeKeyTouched.value = true;
  draft.routeKey = slugifyQueueRouteKey((event.target as HTMLInputElement).value);
}

function resetDraft() {
  syncDraft(templateRoute.value);
}

async function submitRoute() {
  if (!templateRoute.value) return;
  saveError.value = '';
  saving.value = true;

  try {
    const token = String(authStore.token || '').trim();
    if (!token) {
      throw new Error('Admin login is required to create routes.');
    }

    const response = await fetch(buildUrl('/api/puv-queue/admin/routes'), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        route_key: draft.routeKey.trim(),
        label: draft.label.trim(),
        origin: [Number(draft.originLng), Number(draft.originLat)],
        destination: [Number(draft.destinationLng), Number(draft.destinationLat)],
        timezone: draft.timezone.trim(),
        cache_ttl_ms: Number(draft.cacheTtlMinutes) * 60_000,
        baseline_by_hour: templateRoute.value.baseline_by_hour,
        tod_score_by_hour: templateRoute.value.tod_score_by_hour,
        holidays: templateRoute.value.holidays,
        is_active: draft.isActive,
        is_default: draft.isDefault
      })
    });
    const payload = await parseResponse(response);
    if (!response.ok) {
      throw new Error(resolveErrorMessage(response, payload, 'Failed to create route.'));
    }
    emit('created', String(payload?.route_key || draft.routeKey.trim()));
    emit('close');
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : 'Failed to create route.';
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    await loadTemplateRoute();
  }
);

watch(
  () => props.templateRouteKey,
  async (routeKey, previous) => {
    if (!props.open || !routeKey || routeKey === previous) return;
    await loadTemplateRoute();
  }
);

watch(
  () => draft.label,
  (label) => {
    if (routeKeyTouched.value) return;
    draft.routeKey = slugifyQueueRouteKey(label);
  }
);
</script>
