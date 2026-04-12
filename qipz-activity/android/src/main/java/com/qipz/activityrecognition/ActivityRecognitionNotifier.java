package com.qipz.activityrecognition;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

public final class ActivityRecognitionNotifier {
  private static final String CHANNEL_ID = "qipz_activity_debug_channel";
  private static final int NOTIFICATION_ID = 5202;
  private static final int PROGRESS_NOTIFICATION_ID = 5204;
  private static final int GEOFENCE_NOTIFICATION_BASE_ID = 5300;

  private ActivityRecognitionNotifier() {}

  public static void debug(Context context, String message) {
    if (context == null || message == null || message.isEmpty()) {
      return;
    }
    if (!ActivityRecognitionDebug.isDebugEnabled(context)) {
      return;
    }
    createChannel(context);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
      && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
      != PackageManager.PERMISSION_GRANTED) {
      return;
    }

    Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle("qipz-activity debug")
      .setContentText(message)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setAutoCancel(true)
      .build();

    NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification);
  }

  public static void showProgress(Context context, String message) {
    if (context == null || message == null || message.isEmpty()) {
      return;
    }
    if (!ActivityRecognitionDebug.isDebugEnabled(context)) {
      return;
    }
    createChannel(context);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
      && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
      != PackageManager.PERMISSION_GRANTED) {
      return;
    }

    Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_popup_sync)
      .setContentTitle("qipz-activity")
      .setContentText(message)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setOngoing(true)
      .setAutoCancel(false)
      .build();

    NotificationManagerCompat.from(context).notify(PROGRESS_NOTIFICATION_ID, notification);
  }

  public static void hideProgress(Context context) {
    if (context == null) {
      return;
    }
    NotificationManagerCompat.from(context).cancel(PROGRESS_NOTIFICATION_ID);
  }

  public static void geofenceTransition(Context context, String geofenceId, String contentText) {
    if (context == null || contentText == null || contentText.isEmpty()) {
      return;
    }
    if (!ActivityRecognitionDebug.isActivityNotificationsEnabled(context)) {
      return;
    }
    createChannel(context);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
      && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
      != PackageManager.PERMISSION_GRANTED) {
      return;
    }
    int idHash = geofenceId == null ? 0 : Math.abs(geofenceId.hashCode() % 1000);
    Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentTitle("Geofence")
      .setContentText(contentText)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(contentText))
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setAutoCancel(true)
      .build();
    NotificationManagerCompat.from(context).notify(GEOFENCE_NOTIFICATION_BASE_ID + idHash, notification);
  }

  private static void createChannel(Context context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return;
    }
    NotificationManager manager = context.getSystemService(NotificationManager.class);
    if (manager == null) {
      return;
    }
    NotificationChannel channel = new NotificationChannel(
      CHANNEL_ID,
      "QIPZ Activity Debug",
      NotificationManager.IMPORTANCE_DEFAULT
    );
    channel.setDescription("Debug notifications for qipz-activity plugin state");
    manager.createNotificationChannel(channel);
  }
}
