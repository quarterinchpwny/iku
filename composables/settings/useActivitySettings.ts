import { ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { ActivityRecognition } from '@/src/plugins/activityRecognition';
import { requestActivityPermission } from '@/permissions';
import { syncDownFromCloudflare } from '~/db';
import { syncPassiveFromPluginToDexie } from '~/composables/passive/syncPluginPassiveToDexie';

const ACTIVITY_ENABLED_KEY = 'qipz_activity_enabled';
const ACTIVITY_LOCATION_NOTIFY_KEY = 'qipz_activity_location_notify_enabled';
const FIRST_LAUNCH_KEY = 'qipz_first_launch_done';

export function useActivitySettings() {
  const busy = ref(false);
  const uiError = ref('');
  const activityEnabled = ref(false);
  const activityNotificationEnabled = ref(true);
  const highReliabilityModeEnabled = ref(false);
  const debugEnabled = ref(false);
  const activityLocationNotifyEnabled = ref(false);
  const canStart = ref(false);
  const lastType = ref('UNKNOWN');
  const lastConfidence = ref(0);
  const lastEventAt = ref(0);
  const lastDebugLabel = ref('');
  const eventCount = ref(0);
  const lastError = ref('');
  const missingPermissions = ref('');
  const manualSyncing = ref(false);
  const manualSyncError = ref('');
  const lastManualSyncAt = ref(0);

  function ensureNativePluginAvailable() {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('qipz-activity is native-only.');
    }
    if (!Capacitor.isPluginAvailable('qipz-activity')) {
      throw new Error('qipz-activity is not registered. Run cap sync + rebuild app.');
    }
  }

  function fmtTs(ts: number) {
    if (!ts) {
      return '-';
    }
    return new Date(ts).toLocaleString();
  }

  async function refreshStatus() {
    try {
      uiError.value = '';
      ensureNativePluginAvailable();
      const status = await ActivityRecognition.status();
      const permissions = await ActivityRecognition.checkStartPermissions();
      activityEnabled.value = Boolean(status.enabled);
      canStart.value = Boolean(permissions.canStart);
      lastType.value = status.lastType || 'UNKNOWN';
      lastConfidence.value = Number(status.lastConfidence || 0);
      lastEventAt.value = Number(status.lastEventAt || 0);
      lastDebugLabel.value = status.lastDebugLabel || '';
      eventCount.value = Number(status.eventCount || 0);
      activityNotificationEnabled.value = status.activityNotificationsEnabled !== false;
      highReliabilityModeEnabled.value = Boolean(status.highReliabilityModeEnabled);
      debugEnabled.value = Boolean(status.debugEnabled);
      missingPermissions.value = Array.isArray(permissions?.missingPermissions)
        ? permissions.missingPermissions.join(', ')
        : '';
      lastError.value = permissions?.permissionError || status.permissionError || status.lastError || '';
      if (activityEnabled.value) {
        localStorage.setItem(ACTIVITY_ENABLED_KEY, '1');
      }
    } catch (error) {
      uiError.value = String(error);
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
    } catch (error) {
      uiError.value = String(error);
    } finally {
      busy.value = false;
    }
  }

  async function toggleActivityNotification() {
    try {
      busy.value = true;
      uiError.value = '';
      ensureNativePluginAvailable();
      await ActivityRecognition.setActivityNotificationsEnabled({
        enabled: !activityNotificationEnabled.value,
      });
      await refreshStatus();
    } catch (error) {
      uiError.value = String(error);
    } finally {
      busy.value = false;
    }
  }

  async function toggleHighReliabilityMode() {
    try {
      busy.value = true;
      uiError.value = '';
      ensureNativePluginAvailable();
      await ActivityRecognition.setHighReliabilityMode({
        enabled: !highReliabilityModeEnabled.value,
      });
      await refreshStatus();
    } catch (error) {
      uiError.value = String(error);
    } finally {
      busy.value = false;
    }
  }

  async function toggleDebug() {
    try {
      busy.value = true;
      uiError.value = '';
      ensureNativePluginAvailable();
      await ActivityRecognition.setDebugEnabled({ enabled: !debugEnabled.value });
      await refreshStatus();
    } catch (error) {
      uiError.value = String(error);
    } finally {
      busy.value = false;
    }
  }

  function toggleActivityLocationNotify() {
    activityLocationNotifyEnabled.value = !activityLocationNotifyEnabled.value;
    if (activityLocationNotifyEnabled.value) {
      localStorage.setItem(ACTIVITY_LOCATION_NOTIFY_KEY, '1');
      return;
    }
    localStorage.removeItem(ACTIVITY_LOCATION_NOTIFY_KEY);
  }

  async function reRegisterActivity() {
    try {
      busy.value = true;
      uiError.value = '';
      ensureNativePluginAvailable();
      await ActivityRecognition.stop();
      await ActivityRecognition.start();
      await refreshStatus();
    } catch (error) {
      uiError.value = String(error);
    } finally {
      busy.value = false;
    }
  }

  async function runManualSync() {
    if (manualSyncing.value) {
      return;
    }
    manualSyncing.value = true;
    manualSyncError.value = '';
    try {
      await syncPassiveFromPluginToDexie();
      await syncDownFromCloudflare({ includeGeofences: false, scope: 'account' });
      lastManualSyncAt.value = Date.now();
    } catch (error) {
      manualSyncError.value = String(error);
    } finally {
      manualSyncing.value = false;
    }
  }

  async function applyFirstLaunchDefaults() {
    if (localStorage.getItem(FIRST_LAUNCH_KEY) === '1') {
      return;
    }

    try {
      activityLocationNotifyEnabled.value = true;
      localStorage.setItem(ACTIVITY_LOCATION_NOTIFY_KEY, '1');
      await ActivityRecognition.setActivityNotificationsEnabled({ enabled: true });
      const hasExplicitlyDisabled = localStorage.getItem('qipz_activity_explicitly_disabled') === '1';
      if (!activityEnabled.value && !hasExplicitlyDisabled) {
        await requestActivityPermission();
        await ActivityRecognition.start();
        localStorage.setItem(ACTIVITY_ENABLED_KEY, '1');
      }
    } catch (error) {
      console.warn('[Settings] first-launch defaults failed', error);
    } finally {
      localStorage.setItem(FIRST_LAUNCH_KEY, '1');
    }
  }

  async function initializeSettings() {
    activityLocationNotifyEnabled.value = localStorage.getItem(ACTIVITY_LOCATION_NOTIFY_KEY) === '1';
    await refreshStatus();
    await applyFirstLaunchDefaults();
    await refreshStatus();
  }

  return {
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
  };
}
