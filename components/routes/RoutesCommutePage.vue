<template>
  <div
    ref="pageRoot"
    class="relative flex flex-col overflow-hidden bg-[#090a0c] text-white"
    style="height: calc(100dvh - env(safe-area-inset-top))"
  >
    <div
      class="relative flex-shrink-0 overflow-hidden"
      :style="{ height: `${mapHeight}px`, transition: isDragging ? 'none' : 'height 240ms ease' }"
    >
      <RoutesCommuteMapSurface
        ref="mapSurface"
        :estimate="estimate"
        :loading="loading.estimate"
        :route="selectedRoute"
      />

      <div class="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-3">
        <div v-if="estimate" class="flex flex-wrap gap-2">
          <span class="rounded-md border border-zinc-700 bg-[#090a0c]/85 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur-sm">
            {{ estimate.message?.headline || signalState.label }}
          </span>
          <span class="rounded-md border border-zinc-700 bg-[#090a0c]/85 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur-sm">
            {{ estimate.recommendation?.best_option === 'walk' ? 'Walk is faster' : 'Ride is faster' }}
          </span>
        </div>
      </div>
    </div>

    <div
      class="relative z-30 flex h-8 flex-shrink-0 cursor-row-resize items-center justify-center bg-zinc-950"
      style="touch-action: none"
      @mousedown="startDrag"
      @touchstart.prevent="startDrag"
    >
      <div class="flex items-center gap-2">
        <div class="h-1 rounded-full transition-all duration-200" :class="panelSnap === 'map' ? 'w-6 bg-orange-400' : 'w-2 bg-zinc-700'"></div>
        <div class="h-1 rounded-full transition-all duration-200" :class="panelSnap === 'split' ? 'w-6 bg-orange-400' : 'w-2 bg-zinc-700'"></div>
        <div class="h-1 rounded-full transition-all duration-200" :class="panelSnap === 'details' ? 'w-6 bg-orange-400' : 'w-2 bg-zinc-700'"></div>
      </div>
    </div>

    <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[20px] border-t border-zinc-800 bg-zinc-950">
      <div class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-white">
            {{ selectedRoute?.label || 'Public commute routes' }}
          </p>
          <p class="mt-1 text-xs text-zinc-500">
            {{ panelSnap === 'map' ? 'Drag up for the route sheet' : panelSnap === 'split' ? 'Pull down for more map or up for route details' : 'Full route details' }}
          </p>
        </div>
        <button
          class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-orange-500 hover:text-white"
          @click="routePickerOpen = true"
        >
          Routes
        </button>
      </div>

      <div
        class="flex-1 overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom)+5rem)] pt-3"
        style="scrollbar-width: thin; scrollbar-color: #3f3f46 transparent"
      >
        <RoutesCommuteSheetDetails
          :error-estimate="errors.estimate"
          :error-heatmap="errors.heatmap"
          :estimate="estimate"
          :heatmap="heatmap"
          :last-loaded-at-estimate="lastLoadedAt.estimate"
          :loading-estimate="loading.estimate"
          :loading-heatmap="loading.heatmap"
          :presets="presets"
          :routes="routes"
          :selected-preset-id="selectedPresetId"
          :selected-route="selectedRoute"
          :selected-route-key="selectedRouteKey"
          :show-expanded="panelSnap !== 'map'"
          @delete-preset="deletePreset"
          @open-route-picker="routePickerOpen = true"
          @refresh="refreshPredictions"
          @save-preset="saveCurrentPreset($event.label, $event.is_default)"
          @select-preset="selectPreset"
        />
      </div>
    </div>
  </div>

  <div
    v-if="routePickerOpen"
    class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    @click="routePickerOpen = false"
  >
    <div
      class="w-full max-w-lg overflow-hidden rounded-[20px] border border-zinc-800 bg-[#111418] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      @click.stop
    >
      <div class="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <div>
          <p class="text-sm font-semibold text-white">Choose a route</p>
          <p class="mt-1 text-sm text-zinc-500">Public commute corridors</p>
        </div>
      <div class="flex items-center gap-2">
          <button
            v-if="isAdmin"
            class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-orange-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!createTemplateRouteKey || busy"
            @click="openCreateRouteModal"
          >
            New route
          </button>
          <button
            class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-orange-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="busy"
            @click="refreshAll"
          >
            {{ busy ? 'Refreshing' : 'Refresh all' }}
          </button>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-400 transition hover:border-zinc-500 hover:text-white"
            @click="routePickerOpen = false"
          >
            ✕
          </button>
        </div>
      </div>

      <p
        v-if="errors.routes"
        class="mx-5 mt-4 rounded-lg border border-rose-900 bg-rose-950 px-4 py-3 text-sm text-rose-300"
      >
        {{ errors.routes }}
      </p>

      <div
        v-else-if="routes.length"
        class="max-h-[60vh] divide-y divide-zinc-800/70 overflow-y-auto"
        style="scrollbar-width: thin; scrollbar-color: #3f3f46 transparent"
      >
        <button
          v-for="route in routes"
          :key="route.route_key"
          class="flex w-full items-center justify-between px-5 py-4 text-left transition"
          :class="route.route_key === selectedRouteKey ? 'bg-[#18120d]' : 'hover:bg-zinc-900/60'"
          @click="handleSelectRoute(route.route_key)"
        >
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-base font-semibold" :class="route.route_key === selectedRouteKey ? 'text-orange-300' : 'text-white'">
                {{ route.label }}
              </span>
              <span
                v-if="route.is_default"
                class="rounded-md border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300"
              >
                Default
              </span>
              <span
                v-if="route.route_key === selectedRouteKey"
                class="rounded-md border border-orange-700 bg-orange-950 px-2 py-0.5 text-[10px] text-orange-300"
              >
                Active
              </span>
            </div>
            <p class="mt-1 text-xs text-zinc-500">{{ route.timezone }}</p>
            <p class="mt-1 text-xs text-zinc-600">Updated {{ updatedLabel(route.updated_at) }}</p>
          </div>

          <div
            class="ml-4 flex h-5 w-5 items-center justify-center rounded-full border"
            :class="route.route_key === selectedRouteKey ? 'border-orange-500 bg-orange-500' : 'border-zinc-700'"
          >
            <span v-if="route.route_key === selectedRouteKey" class="text-[10px] font-bold text-white">✓</span>
          </div>
        </button>
      </div>

      <div v-else class="px-5 py-10 text-center text-sm text-zinc-500">
        No public commute routes are available yet.
      </div>
    </div>
  </div>

  <RoutesAdminRouteCreateModal
    :open="createRouteOpen"
    :template-route-key="createTemplateRouteKey"
    @close="createRouteOpen = false"
    @created="handleRouteCreated"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import RoutesAdminRouteCreateModal from '~/components/routes/RoutesAdminRouteCreateModal.vue';
import RoutesCommuteMapSurface from '~/components/routes/RoutesCommuteMapSurface.vue';
import RoutesCommuteSheetDetails from '~/components/routes/RoutesCommuteSheetDetails.vue';
import { useQueueCommute } from '~/composables/routes/useQueueCommute';
import { buildQueueSignalState } from '~/lib/queueEstimateTrust';
import { useAuthStore } from '~/stores/auth';

type Snap = 'map' | 'split' | 'details';

const routePickerOpen = ref(false);
const createRouteOpen = ref(false);
const pageRoot = ref<HTMLElement | null>(null);
const mapSurface = ref<InstanceType<typeof RoutesCommuteMapSurface> | null>(null);
const panelSnap = ref<Snap>('split');
const mapHeight = ref(0);
const isDragging = ref(false);
const authStore = useAuthStore();

const HANDLE_HEIGHT = 32;
const DRAG_ACTIVATION = 14;
const SNAP_RATIOS: Record<Snap, number> = {
  map: 0.8,
  split: 0.52,
  details: 0.18
};

const {
  busy,
  deletePreset,
  errors,
  estimate,
  heatmap,
  lastLoadedAt,
  loading,
  presets,
  refreshAll,
  refreshPredictions,
  routes,
  saveCurrentPreset,
  selectedPresetId,
  selectPreset,
  selectedRoute,
  selectedRouteKey,
  selectRoute
} = useQueueCommute();

const signalState = computed(() => buildQueueSignalState(estimate.value));
const isAdmin = computed(() => authStore.user?.role === 'admin');
const createTemplateRouteKey = computed(() => selectedRouteKey.value || routes.value[0]?.route_key || '');

function usableHeight() {
  const rootHeight = pageRoot.value?.clientHeight ?? window.innerHeight;
  return Math.max(rootHeight - HANDLE_HEIGHT, 320);
}

function snapToHeight(snap: Snap) {
  return Math.round(usableHeight() * SNAP_RATIOS[snap]);
}

function invalidateMapSoon() {
  nextTick(() => mapSurface.value?.invalidateMap());
}

function applySnap(snap: Snap, animate = true) {
  panelSnap.value = snap;
  mapHeight.value = snapToHeight(snap);
  if (animate) {
    window.setTimeout(() => invalidateMapSoon(), 260);
    return;
  }
  invalidateMapSoon();
}

let dragStartY = 0;
let dragStartHeight = 0;
let dragMoved = false;

function startDrag(event: MouseEvent | TouchEvent) {
  isDragging.value = true;
  dragMoved = false;
  dragStartY = 'touches' in event ? event.touches[0].clientY : event.clientY;
  dragStartHeight = mapHeight.value;

  const onMove = (moveEvent: MouseEvent | TouchEvent) => {
    const clientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
    const delta = clientY - dragStartY;
    if (!dragMoved && Math.abs(delta) < DRAG_ACTIVATION) {
      return;
    }
    dragMoved = true;
    if ('touches' in moveEvent && moveEvent.cancelable) {
      moveEvent.preventDefault();
    }

    const correctedDelta = delta > 0 ? delta - DRAG_ACTIVATION : delta + DRAG_ACTIVATION;
    const nextHeight = Math.max(
      snapToHeight('details') - 24,
      Math.min(snapToHeight('map') + 24, dragStartHeight + correctedDelta)
    );
    mapHeight.value = nextHeight;
    const fraction = nextHeight / usableHeight();

    if (fraction > (SNAP_RATIOS.map + SNAP_RATIOS.split) / 2) {
      panelSnap.value = 'map';
    } else if (fraction > (SNAP_RATIOS.split + SNAP_RATIOS.details) / 2) {
      panelSnap.value = 'split';
    } else {
      panelSnap.value = 'details';
    }
  };

  const onEnd = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onEnd);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onEnd);
    isDragging.value = false;

    if (!dragMoved) {
      return;
    }

    const fraction = mapHeight.value / usableHeight();
    const closest = (Object.keys(SNAP_RATIOS) as Snap[]).reduce((current, candidate) =>
      Math.abs(SNAP_RATIOS[current] - fraction) < Math.abs(SNAP_RATIOS[candidate] - fraction)
        ? current
        : candidate
    );
    applySnap(closest, true);
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
}

function updatedLabel(value: number): string {
  if (!value) return 'recently';
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function handleResize() {
  applySnap(panelSnap.value, false);
}

function handleSelectRoute(key: string) {
  selectRoute(key);
  routePickerOpen.value = false;
}

function openCreateRouteModal() {
  if (!createTemplateRouteKey.value) {
    return;
  }
  routePickerOpen.value = false;
  createRouteOpen.value = true;
}

async function handleRouteCreated(routeKey: string) {
  createRouteOpen.value = false;
  await refreshAll();
  if (routes.value.some((route) => route.route_key === routeKey)) {
    await selectRoute(routeKey);
  }
}

onMounted(() => {
  applySnap('split', false);
  window.addEventListener('resize', handleResize);
});

watch(
  () => selectedRouteKey.value,
  () => invalidateMapSoon()
);

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});
</script>
