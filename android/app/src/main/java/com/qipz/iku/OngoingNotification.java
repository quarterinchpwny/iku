package com.qipz.iku;

import android.Manifest;
import android.app.Notification;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public class OngoingNotification {
  private static final String CHANNEL_ID = "iku_heartbeat_channel";
  private static final int NOTIFICATION_ID = 4108;

  private final Context context;
  private final NotificationManagerCompat notificationManager;
  private String title = "IKU Shield";
  private String content = "Background location heartbeat active";
  private MonitoringMode monitoringMode;

  public OngoingNotification(Context context, MonitoringMode initialMode) {
    this.context = context;
    this.monitoringMode = initialMode;
    this.notificationManager = NotificationManagerCompat.from(context);
  }

  public Notification build() {
    Intent openIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    if (openIntent == null) {
      openIntent = new Intent();
    }
    PendingIntent contentIntent =
      PendingIntent.getActivity(
        context,
        0,
        openIntent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
      );

    PendingIntent publishIntent =
      PendingIntent.getService(
        context,
        0,
        new Intent(context, HeartbeatService.class).setAction(HeartbeatService.INTENT_ACTION_SEND_LOCATION_USER),
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
      );

    PendingIntent monitoringIntent =
      PendingIntent.getService(
        context,
        1,
        new Intent(context, HeartbeatService.class).setAction(HeartbeatService.INTENT_ACTION_CHANGE_MONITORING),
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
      );

    return new NotificationCompat.Builder(context, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(content)
      .setSubText("Mode: " + monitoringMode.name().toLowerCase())
      .setSmallIcon(R.mipmap.ic_launcher)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setOnlyAlertOnce(true)
      .setContentIntent(contentIntent)
      .addAction(R.mipmap.ic_launcher, "Publish", publishIntent)
      .addAction(R.mipmap.ic_launcher, "Mode", monitoringIntent)
      .build();
  }

  public void setTitle(String title) {
    this.title = title == null ? "" : title;
    update();
  }

  public void setContent(String content) {
    this.content = content == null ? "" : content;
    update();
  }

  public void setMonitoringMode(MonitoringMode mode) {
    this.monitoringMode = mode == null ? MonitoringMode.MOVE : mode;
    update();
  }

  private void update() {
    if (ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
      PackageManager.PERMISSION_GRANTED) {
      notificationManager.notify(NOTIFICATION_ID, build());
    }
  }
}
