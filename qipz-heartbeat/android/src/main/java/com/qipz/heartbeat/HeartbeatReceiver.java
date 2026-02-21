package com.qipz.heartbeat;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public class HeartbeatReceiver extends BroadcastReceiver {
  private static final String HEALTH_CHANNEL_ID = "iku_heartbeat_health";
  private static final int HEALTH_NOTIFICATION_ID = 4110;

  @Override
  public void onReceive(Context context, Intent intent) {
    maybeNotifyMissedHeartbeat(context);
    HeartbeatDebug.markAlarmFired(context);
    HeartbeatScheduler.scheduleNext(context);

    Intent serviceIntent = new Intent(context, HeartbeatService.class);
    serviceIntent.putExtra("reason", "alarm");
    serviceIntent.setAction(HeartbeatService.INTENT_ACTION_ALARM);
    ContextCompat.startForegroundService(context, serviceIntent);
  }

  private void maybeNotifyMissedHeartbeat(Context context) {
    long now = System.currentTimeMillis();
    long lastServiceAt = HeartbeatDebug.getLong(context, HeartbeatDebug.Keys.LAST_SERVICE_START_AT);
    int intervalMinutes = HeartbeatScheduler.getIntervalMinutes(context);
    long missThreshold = Math.max(2L * intervalMinutes * 60_000L, 15L * 60_000L);

    if (lastServiceAt <= 0 || (now - lastServiceAt) <= missThreshold) {
      return;
    }

    createChannel(context);
    Notification notification = new NotificationCompat.Builder(context, HEALTH_CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentTitle("IKU heartbeat delayed")
      .setContentText("Background heartbeat appears delayed. Check battery/exact alarm settings.")
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setAutoCancel(true)
      .build();

    try {
      NotificationManagerCompat.from(context).notify(HEALTH_NOTIFICATION_ID, notification);
      HeartbeatDebug.markHealthAlert(context);
    } catch (SecurityException ignored) {
      // Notification permission may be denied.
    }
  }

  private void createChannel(Context context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationManager manager = context.getSystemService(NotificationManager.class);
      if (manager == null) return;
      NotificationChannel channel = new NotificationChannel(
        HEALTH_CHANNEL_ID,
        "IKU Heartbeat Health",
        NotificationManager.IMPORTANCE_DEFAULT
      );
      channel.setDescription("Alerts for delayed heartbeat runs");
      manager.createNotificationChannel(channel);
    }
  }
}
