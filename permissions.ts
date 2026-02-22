import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ActivityRecognition } from '@/src/plugins/activityRecognition';

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
