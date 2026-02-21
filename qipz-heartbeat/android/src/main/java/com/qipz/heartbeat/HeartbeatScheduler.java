package com.qipz.heartbeat;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

public final class HeartbeatScheduler {
  private static final String PREFS = "iku_heartbeat";
  private static final String KEY_ENABLED = "enabled";
  private static final String KEY_INTERVAL_MINUTES = "interval_minutes";
  private static final String KEY_MONITORING_MODE = "monitoring_mode";
  private static final String KEY_LAST_LOCATION_WAKE_AT = "last_location_wake_at";
  private static final int LEGACY_ALARM_REQUEST_CODE = 4107;

  private HeartbeatScheduler() {}

  public static void enable(Context context, int intervalMinutes) {
    int normalizedMinutes = Math.max(intervalMinutes, 5);
    SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    prefs.edit()
      .putBoolean(KEY_ENABLED, true)
      .putInt(KEY_INTERVAL_MINUTES, normalizedMinutes)
      .apply();
    cancelLegacyAlarm(context);
    ActivityTransitionScheduler.enable(context);
    LocationWakeScheduler.enable(context);
  }

  public static void disable(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    prefs.edit().putBoolean(KEY_ENABLED, false).apply();
    cancelLegacyAlarm(context);
    ActivityTransitionScheduler.disable(context);
    LocationWakeScheduler.disable(context);
  }

  public static boolean isEnabled(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    return prefs.getBoolean(KEY_ENABLED, false);
  }

  public static int getIntervalMinutes(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    return Math.max(5, prefs.getInt(KEY_INTERVAL_MINUTES, 15));
  }

  public static MonitoringMode getMonitoringMode(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    return MonitoringMode.fromValue(prefs.getInt(KEY_MONITORING_MODE, MonitoringMode.MOVE.getValue()));
  }

  public static void setMonitoringMode(Context context, MonitoringMode mode) {
    SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    prefs.edit().putInt(KEY_MONITORING_MODE, mode.getValue()).apply();
    ActivityTransitionScheduler.enable(context);
    LocationWakeScheduler.enable(context);
  }

  public static MonitoringMode cycleMonitoringMode(Context context) {
    MonitoringMode next = getMonitoringMode(context).next();
    setMonitoringMode(context, next);
    return next;
  }

  public static void scheduleNext(Context context) {
    if (!isEnabled(context)) {
      return;
    }
    HeartbeatDebug.markScheduled(context);
  }

  public static void rescheduleIfEnabled(Context context) {
    if (isEnabled(context)) {
      ActivityTransitionScheduler.enable(context);
      LocationWakeScheduler.enable(context);
      HeartbeatDebug.markScheduled(context);
    }
  }

  public static boolean tryAcquireLocationWake(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    long now = System.currentTimeMillis();
    long lastWakeAt = prefs.getLong(KEY_LAST_LOCATION_WAKE_AT, 0L);
    long minSpacingMs = 500L;
    if ((now - lastWakeAt) < minSpacingMs) {
      return false;
    }
    prefs.edit().putLong(KEY_LAST_LOCATION_WAKE_AT, now).apply();
    return true;
  }

  public static boolean canScheduleExactAlarms(Context context) {
    return true;
  }

  public static boolean requestExactAlarmPermission(Context context) {
    return true;
  }

  private static void cancelLegacyAlarm(Context context) {
    AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (alarmManager == null) {
      return;
    }

    Intent intent = new Intent(context, HeartbeatReceiver.class);
    PendingIntent pendingIntent = PendingIntent.getBroadcast(
      context,
      LEGACY_ALARM_REQUEST_CODE,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    alarmManager.cancel(pendingIntent);
  }
}
