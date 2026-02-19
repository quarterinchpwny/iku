package com.qipz.iku;

import android.content.Context;
import android.content.SharedPreferences;

public final class HeartbeatDebug {
  private static final String PREFS = "iku_heartbeat_debug";

  private static final String KEY_LAST_SCHEDULED_AT = "last_scheduled_at";
  private static final String KEY_LAST_ALARM_AT = "last_alarm_at";
  private static final String KEY_LAST_SERVICE_START_AT = "last_service_start_at";
  private static final String KEY_LAST_LOCATION_AT = "last_location_at";
  private static final String KEY_LAST_UPLOAD_AT = "last_upload_at";
  private static final String KEY_LAST_UPLOAD_CODE = "last_upload_code";
  private static final String KEY_LAST_ERROR = "last_error";
  private static final String KEY_LAST_REASON = "last_reason";
  private static final String KEY_LAST_LAT = "last_lat";
  private static final String KEY_LAST_LNG = "last_lng";
  private static final String KEY_PENDING_QUEUE_COUNT = "pending_queue_count";
  private static final String KEY_LAST_HEALTH_ALERT_AT = "last_health_alert_at";

  private HeartbeatDebug() {}

  private static SharedPreferences prefs(Context context) {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  public static void markScheduled(Context context) {
    prefs(context).edit()
      .putLong(KEY_LAST_SCHEDULED_AT, System.currentTimeMillis())
      .apply();
  }

  public static void markAlarmFired(Context context) {
    prefs(context).edit()
      .putLong(KEY_LAST_ALARM_AT, System.currentTimeMillis())
      .apply();
  }

  public static void markServiceStart(Context context, String reason) {
    prefs(context).edit()
      .putLong(KEY_LAST_SERVICE_START_AT, System.currentTimeMillis())
      .putString(KEY_LAST_REASON, reason == null ? "unknown" : reason)
      .apply();
  }

  public static void markLocation(Context context, double lat, double lng) {
    prefs(context).edit()
      .putLong(KEY_LAST_LOCATION_AT, System.currentTimeMillis())
      .putString(KEY_LAST_LAT, Double.toString(lat))
      .putString(KEY_LAST_LNG, Double.toString(lng))
      .apply();
  }

  public static void markUploadResult(Context context, int code) {
    prefs(context).edit()
      .putLong(KEY_LAST_UPLOAD_AT, System.currentTimeMillis())
      .putInt(KEY_LAST_UPLOAD_CODE, code)
      .apply();
  }

  public static void markError(Context context, String error) {
    prefs(context).edit()
      .putString(KEY_LAST_ERROR, error)
      .apply();
  }

  public static void markQueueCount(Context context, int count) {
    prefs(context).edit()
      .putInt(KEY_PENDING_QUEUE_COUNT, count)
      .apply();
  }

  public static void markHealthAlert(Context context) {
    prefs(context).edit()
      .putLong(KEY_LAST_HEALTH_ALERT_AT, System.currentTimeMillis())
      .apply();
  }

  public static void clearError(Context context) {
    prefs(context).edit()
      .remove(KEY_LAST_ERROR)
      .apply();
  }

  public static void clear(Context context) {
    prefs(context).edit().clear().apply();
  }

  public static long getLong(Context context, String key) {
    return prefs(context).getLong(key, 0L);
  }

  public static int getInt(Context context, String key) {
    return prefs(context).getInt(key, 0);
  }

  public static String getString(Context context, String key) {
    return prefs(context).getString(key, "");
  }

  public static final class Keys {
    public static final String LAST_SCHEDULED_AT = KEY_LAST_SCHEDULED_AT;
    public static final String LAST_ALARM_AT = KEY_LAST_ALARM_AT;
    public static final String LAST_SERVICE_START_AT = KEY_LAST_SERVICE_START_AT;
    public static final String LAST_LOCATION_AT = KEY_LAST_LOCATION_AT;
    public static final String LAST_UPLOAD_AT = KEY_LAST_UPLOAD_AT;
    public static final String LAST_UPLOAD_CODE = KEY_LAST_UPLOAD_CODE;
    public static final String LAST_ERROR = KEY_LAST_ERROR;
    public static final String LAST_REASON = KEY_LAST_REASON;
    public static final String LAST_LAT = KEY_LAST_LAT;
    public static final String LAST_LNG = KEY_LAST_LNG;
    public static final String PENDING_QUEUE_COUNT = KEY_PENDING_QUEUE_COUNT;
    public static final String LAST_HEALTH_ALERT_AT = KEY_LAST_HEALTH_ALERT_AT;

    private Keys() {}
  }
}
