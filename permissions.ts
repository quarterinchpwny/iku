import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Heartbeat } from '@/src/plugins/heartbeat';
import { ActivityRecognition } from '@/src/plugins/activityRecognition';

export async function requestHeartbeatPermission() {
  if (Capacitor.getPlatform() !== 'android') return;
  if (!Capacitor.isPluginAvailable('qipz-heartbeat')) {
    throw new Error('qipz-heartbeat plugin is not available in this native build. Run "npx cap sync android" and rebuild.');
  }

  await Heartbeat.requestStartPermissions();
}

export async function requestActivityPermission() {
  if (Capacitor.getPlatform() !== 'android') return;
  if (!Capacitor.isPluginAvailable('qipz-activity')) {
    throw new Error('qipz-activity plugin is not available in this native build. Run "npx cap sync android" and rebuild.');
  }

  const precheck = await ActivityRecognition.checkStartPermissions();
  if (!precheck.canStart) {
    const requested = await ActivityRecognition.requestStartPermissions();
    if (!requested.canStart) {
      throw new Error(requested.permissionError || 'Activity recognition permission denied');
    }
  }
  await LocalNotifications.requestPermissions();
}
