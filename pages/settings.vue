  <template>
  <div class="min-h-screen bg-black px-4 py-6 text-white">
    <div class="mx-auto w-full max-w-xl space-y-4">
      <h1 class="font-mono text-lg font-bold uppercase tracking-wider">Settings</h1>

      <div class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div class="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
          Activity Recognition
        </div>

        <div class="space-y-3">
          <div
            class="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2"
          >
            <div>
              <div class="font-mono text-[11px] uppercase tracking-wide">QIPZ Activity</div>
              <div class="text-[11px] text-zinc-400">Start/stop native background detection</div>
            </div>
            <button
              @click="toggleActivityEnabled"
              :disabled="busy"
              :class="activityEnabled ? 'bg-emerald-600' : 'bg-zinc-700'"
              class="rounded-md px-3 py-1 text-[11px] font-bold uppercase"
            >
              {{ activityEnabled ? 'ON' : 'OFF' }}
            </button>
          </div>

          <div
            class="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2"
          >
            <div>
              <div class="font-mono text-[11px] uppercase tracking-wide">
                Activity Detected Notification
              </div>
              <div class="text-[11px] text-zinc-400">
                Keep native activity notifications visible
              </div>
            </div>
            <button
              @click="toggleActivityNotification"
              :disabled="busy"
              :class="activityNotificationEnabled ? 'bg-emerald-600' : 'bg-zinc-700'"
              class="rounded-md px-3 py-1 text-[11px] font-bold uppercase"
            >
              {{ activityNotificationEnabled ? 'ON' : 'OFF' }}
            </button>
          </div>

          <div
            class="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2"
          >
            <div>
              <div class="font-mono text-[11px] uppercase tracking-wide">High Reliability Mode</div>
              <div class="text-[11px] text-zinc-400">
                Keep foreground service alive while still (persistent notification)
              </div>
            </div>
            <button
              @click="toggleHighReliabilityMode"
              :disabled="busy"
              :class="highReliabilityModeEnabled ? 'bg-amber-600' : 'bg-zinc-700'"
              class="rounded-md px-3 py-1 text-[11px] font-bold uppercase"
            >
              {{ highReliabilityModeEnabled ? 'ON' : 'OFF' }}
            </button>
          </div>

          <div
            class="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2"
          >
            <div>
              <div class="font-mono text-[11px] uppercase tracking-wide">Debug Notifications</div>
              <div class="text-[11px] text-zinc-400">Show noisy plugin debug notifications</div>
            </div>
            <button
              @click="toggleDebug"
              :disabled="busy"
              :class="debugEnabled ? 'bg-amber-600' : 'bg-zinc-700'"
              class="rounded-md px-3 py-1 text-[11px] font-bold uppercase"
            >
              {{ debugEnabled ? 'ON' : 'OFF' }}
            </button>
          </div>

          <div
            class="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2"
          >
            <div>
              <div class="font-mono text-[11px] uppercase tracking-wide">
                Activity + Location Ping
              </div>
              <div class="text-[11px] text-zinc-400">JS notif after activity location save</div>
            </div>
            <button
              @click="toggleActivityLocationNotify"
              :class="activityLocationNotifyEnabled ? 'bg-emerald-600' : 'bg-zinc-700'"
              class="rounded-md px-3 py-1 text-[11px] font-bold uppercase"
            >
              {{ activityLocationNotifyEnabled ? 'ON' : 'OFF' }}
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
            @click="refreshStatus"
            :disabled="busy"
            class="rounded-md border border-zinc-700 px-2 py-1 font-mono text-[10px] uppercase text-zinc-200"
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
import { ref, onMounted } from 'vue';
import { Capacitor } from '@capacitor/core';
import { ActivityRecognition } from '@/src/plugins/activityRecognition';
import { requestActivityPermission } from '@/permissions';

const ACTIVITY_ENABLED_KEY = 'qipz_activity_enabled';
const ACTIVITY_LOCATION_NOTIFY_KEY = 'qipz_activity_location_notify_enabled';
const FIRST_LAUNCH_KEY = 'qipz_first_launch_done';

const busy = ref(false);
const uiError = ref('');
const activityEnabled = ref(false);
const activityNotificationEnabled = ref(true);
const highReliabilityModeEnabled = ref(false);
const debugEnabled = ref(false); // debug stays OFF by default
const activityLocationNotifyEnabled = ref(false);
const canStart = ref(false);
const lastType = ref('UNKNOWN');
const lastConfidence = ref(0);
const lastEventAt = ref(0);
const lastDebugLabel = ref('');
const eventCount = ref(0);
const lastError = ref('');
const missingPermissions = ref('');

function ensureNativePluginAvailable() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('qipz-activity is native-only.');
  }
  if (!Capacitor.isPluginAvailable('qipz-activity')) {
    throw new Error('qipz-activity is not registered. Run cap sync + rebuild app.');
  }
}

function fmtTs(ts: number) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
}

async function refreshStatus() {
  try {
    uiError.value = '';
    ensureNativePluginAvailable();
    const status = await ActivityRecognition.status();
    const perms = await ActivityRecognition.checkStartPermissions();
    activityEnabled.value = !!status.enabled;
    canStart.value = !!perms.canStart;
    lastType.value = status.lastType || 'UNKNOWN';
    lastConfidence.value = Number(status.lastConfidence || 0);
    lastEventAt.value = Number(status.lastEventAt || 0);
    lastDebugLabel.value = status.lastDebugLabel || '';
    eventCount.value = Number(status.eventCount || 0);
    activityNotificationEnabled.value = status.activityNotificationsEnabled !== false;
    highReliabilityModeEnabled.value = !!status.highReliabilityModeEnabled;
    debugEnabled.value = !!status.debugEnabled;
    missingPermissions.value = Array.isArray(perms?.missingPermissions)
      ? perms.missingPermissions.join(', ')
      : '';
    lastError.value = perms?.permissionError || status.permissionError || status.lastError || '';
    if (activityEnabled.value) {
      localStorage.setItem(ACTIVITY_ENABLED_KEY, '1');
    }
  } catch (err) {
    uiError.value = String(err);
  }
}

async function toggleActivityEnabled() {
  try {
    busy.value = true;
    uiError.value = '';
    ensureNativePluginAvailable();
    if (activityEnabled.value) {
      await ActivityRecognition.stop();
      localStorage.removeItem(ACTIVITY_ENABLED_KEY);
      localStorage.setItem('qipz_activity_explicitly_disabled', '1');
    } else {
      await requestActivityPermission();
      await ActivityRecognition.start();
      localStorage.setItem(ACTIVITY_ENABLED_KEY, '1');
      localStorage.removeItem('qipz_activity_explicitly_disabled');
    }
    await refreshStatus();
  } catch (err) {
    uiError.value = String(err);
  } finally {
    busy.value = false;
  }
}

async function toggleActivityNotification() {
  try {
    busy.value = true;
    uiError.value = '';
    ensureNativePluginAvailable();
    const next = !activityNotificationEnabled.value;
    await ActivityRecognition.setActivityNotificationsEnabled({ enabled: next });
    await refreshStatus();
  } catch (err) {
    uiError.value = String(err);
  } finally {
    busy.value = false;
  }
}

async function toggleHighReliabilityMode() {
  try {
    busy.value = true;
    uiError.value = '';
    ensureNativePluginAvailable();
    const next = !highReliabilityModeEnabled.value;
    await ActivityRecognition.setHighReliabilityMode({ enabled: next });
    await refreshStatus();
  } catch (err) {
    uiError.value = String(err);
  } finally {
    busy.value = false;
  }
}

async function toggleDebug() {
  try {
    busy.value = true;
    uiError.value = '';
    ensureNativePluginAvailable();
    const next = !debugEnabled.value;
    await ActivityRecognition.setDebugEnabled({ enabled: next });
    await refreshStatus();
  } catch (err) {
    uiError.value = String(err);
  } finally {
    busy.value = false;
  }
}

function toggleActivityLocationNotify() {
  activityLocationNotifyEnabled.value = !activityLocationNotifyEnabled.value;
  if (activityLocationNotifyEnabled.value) {
    localStorage.setItem(ACTIVITY_LOCATION_NOTIFY_KEY, '1');
  } else {
    localStorage.removeItem(ACTIVITY_LOCATION_NOTIFY_KEY);
  }
}

async function applyFirstLaunchDefaults() {
  const alreadyDone = localStorage.getItem(FIRST_LAUNCH_KEY) === '1';
  if (alreadyDone) return;

  try {
    // Activity + Location Ping ON
    localStorage.setItem(ACTIVITY_LOCATION_NOTIFY_KEY, '1');
    activityLocationNotifyEnabled.value = true;

    // Activity Notifications ON (native default is already true, but force it)
    await ActivityRecognition.setActivityNotificationsEnabled({ enabled: true });

    // Debug OFF (native default, no call needed)

    // QIPZ Activity ON
    const hasExplicitlyDisabled = localStorage.getItem('qipz_activity_explicitly_disabled') === '1';
    if (!activityEnabled.value && !hasExplicitlyDisabled) {
      await requestActivityPermission();
      await ActivityRecognition.start();
      localStorage.setItem(ACTIVITY_ENABLED_KEY, '1');
    }
  } catch {
    // silent — user can enable manually from settings
  } finally {
    localStorage.setItem(FIRST_LAUNCH_KEY, '1');
  }
}

onMounted(async () => {
  activityLocationNotifyEnabled.value = localStorage.getItem(ACTIVITY_LOCATION_NOTIFY_KEY) === '1';
  await refreshStatus();
  await applyFirstLaunchDefaults();
  await refreshStatus(); // re-sync UI after defaults applied
});
</script>
