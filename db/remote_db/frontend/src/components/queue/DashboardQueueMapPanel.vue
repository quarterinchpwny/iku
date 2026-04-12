<template>
  <QueueEstimateMapPanel
    :error="error"
    :estimate="estimate"
    :loading="loading"
    :route="routeDetail"
    @refresh="refreshPanel"
  >
    <template #actions>
      <select
        class="min-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 outline-none transition focus:border-orange-500"
        :disabled="loading || routes.length === 0"
        :value="selectedRouteKey"
        @change="handleRouteChange"
      >
        <option v-if="routes.length === 0" value="">No routes</option>
        <option v-for="route in routes" :key="route.route_key" :value="route.route_key">
          {{ route.label }}
        </option>
      </select>
      <button
        type="button"
        class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-orange-500/50 hover:text-white"
        @click="goToPage('queue')"
      >
        Open Queue Tab
      </button>
    </template>
  </QueueEstimateMapPanel>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import {
  getAuthToken,
  getDefaultApiBase,
  normalizeApiBase,
  parseApiResponse,
  resolveApiErrorMessage
} from '@/lib/queueApi';
import { useAdminAppContext } from '@/composables/useAdminAppContext';
import QueueEstimateMapPanel from './QueueEstimateMapPanel.vue';

const { goToPage } = useAdminAppContext().shell;

const apiBase = ref(normalizeApiBase(getDefaultApiBase()));
const routes = ref([]);
const selectedRouteKey = ref('');
const routeDetail = ref(null);
const estimate = ref(null);
const loading = ref(false);
const error = ref('');

function buildUrl(path, params = {}) {
  if (!apiBase.value) {
    throw new Error('Queue API base is not available.');
  }

  const url = new URL(path, `${apiBase.value}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url;
}

async function requestJson(path, { auth = false, params = {} } = {}) {
  const headers = { accept: 'application/json' };
  if (auth) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path, params), { headers });
  const payload = await parseApiResponse(response);
  if (!response.ok) {
    throw new Error(resolveApiErrorMessage(response, payload, 'Queue dashboard request failed'));
  }
  return payload;
}

async function loadRouteList() {
  const payload = await requestJson('/api/puv-queue/admin/routes', { auth: true });
  routes.value = Array.isArray(payload?.routes) ? payload.routes : [];
  if (!routes.value.some((route) => route.route_key === selectedRouteKey.value)) {
    selectedRouteKey.value =
      routes.value.find((route) => route.is_default)?.route_key ?? routes.value[0]?.route_key ?? '';
  }
}

async function loadRouteState(routeKey = selectedRouteKey.value) {
  if (!routeKey) {
    routeDetail.value = null;
    estimate.value = null;
    return;
  }

  const [detailPayload, estimatePayload] = await Promise.all([
    requestJson(`/api/puv-queue/admin/routes/${routeKey}`, { auth: true }),
    requestJson('/api/puv-queue/estimate', { params: { routeKey, polyline: '1' } })
  ]);

  routeDetail.value = detailPayload;
  estimate.value = estimatePayload;
}

async function refreshAll() {
  loading.value = true;
  error.value = '';

  try {
    await loadRouteList();
    await loadRouteState();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load the queue route map.';
  } finally {
    loading.value = false;
  }
}

async function refreshPanel() {
  loading.value = true;
  error.value = '';

  try {
    if (!selectedRouteKey.value) {
      await loadRouteList();
    }
    await loadRouteState();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to refresh the queue route map.';
  } finally {
    loading.value = false;
  }
}

function handleRouteChange(event) {
  selectedRouteKey.value = event?.target?.value ?? '';
  refreshPanel().catch(() => {});
}

onMounted(() => {
  refreshAll().catch(() => {});
});
</script>
