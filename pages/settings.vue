<template>
  <div class="min-h-screen bg-black px-4 py-6 text-white">
    <div class="mx-auto w-full max-w-xl space-y-4">
      <h1 class="font-mono text-lg font-bold uppercase tracking-wider">Settings</h1>

      <div class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div class="mb-2 flex items-center justify-between">
          <div class="font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
            Cloud Sync
          </div>
          <button
            :disabled="busy || manualSyncing"
            class="rounded-md border border-zinc-700 px-2 py-1 font-mono text-[10px] uppercase text-zinc-200"
            @click="runManualSync"
          >
            {{ manualSyncing ? 'Syncing' : 'Sync Now' }}
          </button>
        </div>
        <div class="font-mono text-[10px] text-zinc-300">
          <div>Last sync: {{ fmtTs(lastManualSyncAt) }}</div>
          <div v-if="manualSyncError" class="mt-1 text-red-400">
            Error: {{ manualSyncError }}
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div class="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
          Account
        </div>

        <div class="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2">
          <div>
            <div class="font-mono text-[11px] uppercase tracking-wide">Log Out</div>
            <div class="text-[11px] text-zinc-400">End the current session on this device</div>
          </div>
          <button
            :disabled="loggingOut"
            class="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-1 text-[11px] font-bold uppercase text-red-200 transition hover:border-red-700/60 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            @click="handleLogout"
          >
            {{ loggingOut ? 'Logging Out' : 'Log Out' }}
          </button>
        </div>
      </div>

      <SettingsOtaPanel />

      <div class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div class="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
          Activity Recognition
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2">
            <div>
              <div class="font-mono text-[11px] uppercase tracking-wide">QIPZ Activity</div>
              <div class="text-[11px] text-zinc-400">Start/stop native background detection</div>
            </div>
            <button
              :class="activityEnabled ? 'bg-emerald-600' : 'bg-zinc-700'"
              :disabled="busy"
              class="rounded-md px-3 py-1 text-[11px] font-bold uppercase"
              @click="toggleActivityEnabled"
            >
              {{ activityEnabled ? 'ON' : 'OFF' }}
            </button>
          </div>

          <div class="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2">
            <div>
              <div class="font-mono text-[11px] uppercase tracking-wide">
                Activity Detected Notification
              </div>
              <div class="text-[11px] text-zinc-400">
                Keep native activity notifications visible
              </div>
            </div>
            <button
              :class="activityNotificationEnabled ? 'bg-emerald-600' : 'bg-zinc-700'"
              :disabled="busy"
              class="rounded-md px-3 py-1 text-[11px] font-bold uppercase"
              @click="toggleActivityNotification"
            >
              {{ activityNotificationEnabled ? 'ON' : 'OFF' }}
            </button>
          </div>

          <div class="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2">
            <div>
              <div class="font-mono text-[11px] uppercase tracking-wide">High Reliability Mode</div>
              <div class="text-[11px] text-zinc-400">
                Keep foreground service alive while still (persistent notification)
              </div>
            </div>
            <button
              :class="highReliabilityModeEnabled ? 'bg-amber-600' : 'bg-zinc-700'"
              :disabled="busy"
              class="rounded-md px-3 py-1 text-[11px] font-bold uppercase"
              @click="toggleHighReliabilityMode"
            >
              {{ highReliabilityModeEnabled ? 'ON' : 'OFF' }}
            </button>
          </div>

          <div class="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2">
            <div>
              <div class="font-mono text-[11px] uppercase tracking-wide">Debug Notifications</div>
              <div class="text-[11px] text-zinc-400">Show noisy plugin debug notifications</div>
            </div>
            <button
              :class="debugEnabled ? 'bg-amber-600' : 'bg-zinc-700'"
              :disabled="busy"
              class="rounded-md px-3 py-1 text-[11px] font-bold uppercase"
              @click="toggleDebug"
            >
              {{ debugEnabled ? 'ON' : 'OFF' }}
            </button>
          </div>

          <div class="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2">
            <div>
              <div class="font-mono text-[11px] uppercase tracking-wide">
                Activity + Location Ping
              </div>
              <div class="text-[11px] text-zinc-400">JS notif after activity location save</div>
            </div>
            <button
              :class="activityLocationNotifyEnabled ? 'bg-emerald-600' : 'bg-zinc-700'"
              class="rounded-md px-3 py-1 text-[11px] font-bold uppercase"
              @click="toggleActivityLocationNotify"
            >
              {{ activityLocationNotifyEnabled ? 'ON' : 'OFF' }}
            </button>
          </div>

          <div class="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2">
            <div>
              <div class="font-mono text-[11px] uppercase tracking-wide">Re-register Activity</div>
              <div class="text-[11px] text-zinc-400">Force stop/start native activity updates</div>
            </div>
            <button
              :disabled="busy"
              class="rounded-md bg-amber-600 px-3 py-1 text-[11px] font-bold uppercase"
              @click="reRegisterActivity"
            >
              RUN
            </button>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div class="mb-2 flex items-center justify-between">
          <div class="font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
            Status
          </div>
          <button
            :disabled="busy"
            class="rounded-md border border-zinc-700 px-2 py-1 font-mono text-[10px] uppercase text-zinc-200"
            @click="refreshStatus"
          >
            Refresh
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2 font-mono text-[10px] text-zinc-300">
          <div>Enabled: {{ activityEnabled ? 'true' : 'false' }}</div>
          <div>Can start: {{ canStart ? 'true' : 'false' }}</div>
          <div class="col-span-2">Missing perms: {{ missingPermissions || '-' }}</div>
          <div>Type: {{ lastType }}</div>
          <div>Confidence: {{ lastConfidence }}</div>
          <div class="col-span-2">Last event: {{ fmtTs(lastEventAt) }}</div>
          <div class="col-span-2">Debug label: {{ lastDebugLabel || '-' }}</div>
          <div class="col-span-2">Event count: {{ eventCount }}</div>
          <div class="col-span-2 text-red-400">Error: {{ lastError || '-' }}</div>
        </div>
      </div>

      <PluginLogsPanel />

      <div
        v-if="uiError"
        class="rounded-lg border border-red-900/40 bg-red-900/20 px-3 py-2 text-xs text-red-300"
      >
        {{ uiError }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import PluginLogsPanel from '@/components/settings/PluginLogsPanel.vue';
import SettingsOtaPanel from '@/components/settings/SettingsOtaPanel.vue';
import { useActivitySettings } from '~/composables/settings/useActivitySettings';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
const loggingOut = ref(false);

const {
  busy,
  uiError,
  activityEnabled,
  activityNotificationEnabled,
  highReliabilityModeEnabled,
  debugEnabled,
  activityLocationNotifyEnabled,
  canStart,
  lastType,
  lastConfidence,
  lastEventAt,
  lastDebugLabel,
  eventCount,
  lastError,
  missingPermissions,
  manualSyncing,
  manualSyncError,
  lastManualSyncAt,
  fmtTs,
  refreshStatus,
  toggleActivityEnabled,
  toggleActivityNotification,
  toggleHighReliabilityMode,
  toggleDebug,
  toggleActivityLocationNotify,
  reRegisterActivity,
  runManualSync,
  initializeSettings,
} = useActivitySettings();

async function handleLogout() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  try {
    await authStore.logout();
  } finally {
    loggingOut.value = false;
  }
}

onMounted(() => {
  void initializeSettings();
});
</script>
