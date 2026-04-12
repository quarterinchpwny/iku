<template>
  <div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
    <div class="mb-2 flex items-center justify-between">
      <div class="font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
        Plugin Logs
      </div>
      <div class="flex items-center gap-2">
        <button
          class="rounded-md border border-zinc-700 px-2 py-1 font-mono text-[10px] uppercase text-zinc-200"
          :disabled="loading || !available"
          @click="refreshLogs"
        >
          Refresh
        </button>
        <button
          class="rounded-md border border-zinc-700 px-2 py-1 font-mono text-[10px] uppercase text-zinc-200"
          :disabled="loading || !available"
          @click="clearLogs"
        >
          Clear
        </button>
        <button
          class="rounded-md border border-orange-700 px-2 py-1 font-mono text-[10px] uppercase text-orange-200"
          :disabled="loading || uploading || !available"
          @click="uploadLogs"
        >
          {{ uploading ? 'Uploading...' : 'Upload' }}
        </button>
      </div>
    </div>

    <div v-if="!available" class="font-mono text-[11px] text-zinc-500">
      Plugin logs are available on native builds only.
    </div>

    <div v-else class="space-y-2">
      <div v-if="error" class="rounded-md border border-red-900/40 bg-red-900/20 px-2 py-1 text-[11px] text-red-300">
        {{ error }}
      </div>
      <div v-if="uploadResult" class="rounded-md border border-emerald-900/40 bg-emerald-900/20 px-2 py-1 text-[11px] text-emerald-300">
        {{ uploadResult }}
      </div>
      <div class="max-h-64 overflow-y-auto rounded-md border border-zinc-800 bg-black/40 p-2">
        <div v-if="logs.length === 0" class="font-mono text-[11px] text-zinc-500">
          No plugin logs yet.
        </div>
        <div v-for="(entry, index) in logs" :key="`${entry.timestamp}-${index}`" class="mb-2 border-b border-zinc-800 pb-2 last:mb-0 last:border-b-0 last:pb-0">
          <div class="font-mono text-[10px] text-zinc-400">
            {{ fmtTs(entry.timestamp) }} · {{ entry.source }} · {{ entry.level }}
          </div>
          <div class="font-mono text-[11px] text-zinc-200">
            {{ entry.message }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { ActivityRecognition } from '@/src/plugins/activityRecognition';
import type { PluginLogEntry } from '@/src/plugins/activityRecognition';

const logs = ref<PluginLogEntry[]>([]);
const loading = ref(false);
const uploading = ref(false);
const error = ref('');
const uploadResult = ref('');
const available = computed(
  () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('qipz-activity')
);
const apiBase = import.meta.env.VITE_CF_API_URL || '';

function fmtTs(ts: number) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
}

async function refreshLogs() {
  if (!available.value) return;
  try {
    loading.value = true;
    error.value = '';
    uploadResult.value = '';
    const result = await ActivityRecognition.getPluginLogs({ limit: 300 });
    logs.value = Array.isArray(result?.logs) ? result.logs : [];
  } catch (err) {
    error.value = String(err);
  } finally {
    loading.value = false;
  }
}

async function clearLogs() {
  if (!available.value) return;
  try {
    loading.value = true;
    error.value = '';
    uploadResult.value = '';
    await ActivityRecognition.clearPluginLogs();
    logs.value = [];
  } catch (err) {
    error.value = String(err);
  } finally {
    loading.value = false;
  }
}

async function uploadLogs() {
  if (!available.value) return;
  try {
    uploading.value = true;
    error.value = '';
    uploadResult.value = '';
    if (!logs.value.length) {
      await refreshLogs();
    }
    if (!logs.value.length) {
      uploadResult.value = 'No logs to upload.';
      return;
    }

    const status = await ActivityRecognition.status();
    const accountKey = typeof status?.accountKey === 'string' ? status.accountKey.trim() : '';
    const endpoint = `${apiBase}/api/location/logs/upload`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accountKey ? { Authorization: `Bearer ${accountKey}` } : {})
      },
      body: JSON.stringify({
        accountKey: accountKey || null,
        logs: logs.value,
        meta: {
          platform: Capacitor.getPlatform(),
          lastType: status?.lastType || 'UNKNOWN',
          lastEventAt: Number(status?.lastEventAt || 0),
          eventCount: Number(status?.eventCount || 0)
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success !== true) {
      throw new Error(data?.error || `Upload failed (HTTP ${response.status})`);
    }
    uploadResult.value = `Uploaded ${Number(data?.insertedCount || 0)} log rows.`;
  } catch (err) {
    error.value = String(err);
  } finally {
    uploading.value = false;
  }
}

onMounted(async () => {
  await refreshLogs();
});
</script>
