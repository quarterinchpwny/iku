package com.qipz.activityrecognition;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

public final class ActivityRecognitionDebug {
  private static final String PREFS = "qipz_activity_debug";

  private static final String KEY_ENABLED = "enabled";
  private static final String KEY_LAST_TYPE = "last_type";
  private static final String KEY_LAST_CONFIDENCE = "last_confidence";
  private static final String KEY_LAST_EVENT_AT = "last_event_at";
  private static final String KEY_LAST_START_AT = "last_start_at";
  private static final String KEY_LAST_STOP_AT = "last_stop_at";
  private static final String KEY_LAST_ERROR = "last_error";
  private static final String KEY_LAST_DEBUG_LABEL = "last_debug_label";
  private static final String KEY_EVENT_COUNT = "event_count";
  private static final String KEY_PENDING_EVENTS = "pending_events";
  private static final int MAX_PENDING_EVENTS = 50;

  private ActivityRecognitionDebug() {}

  private static SharedPreferences prefs(Context context) {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  public static void markStarted(Context context) {
    prefs(context)
      .edit()
      .putBoolean(KEY_ENABLED, true)
      .putLong(KEY_LAST_START_AT, System.currentTimeMillis())
      .apply();
  }

  public static void markStopped(Context context) {
    prefs(context)
      .edit()
      .putBoolean(KEY_ENABLED, false)
      .putLong(KEY_LAST_STOP_AT, System.currentTimeMillis())
      .apply();
  }

  public static void markEvent(Context context, String type, int confidence) {
    prefs(context)
      .edit()
      .putString(KEY_LAST_TYPE, type == null ? "UNKNOWN" : type)
      .putInt(KEY_LAST_CONFIDENCE, confidence)
      .putLong(KEY_LAST_EVENT_AT, System.currentTimeMillis())
      .putInt(KEY_EVENT_COUNT, prefs(context).getInt(KEY_EVENT_COUNT, 0) + 1)
      .apply();
  }

  public static void markDebugLabel(Context context, String label) {
    prefs(context).edit().putString(KEY_LAST_DEBUG_LABEL, label == null ? "" : label).apply();
  }

  public static void clearError(Context context) {
    prefs(context).edit().putString(KEY_LAST_ERROR, "").apply();
  }

  public static void markError(Context context, String message) {
    prefs(context).edit().putString(KEY_LAST_ERROR, message == null ? "unknown" : message).apply();
  }

  public static boolean isEnabled(Context context) {
    return prefs(context).getBoolean(KEY_ENABLED, false);
  }

  public static String getLastType(Context context) {
    return prefs(context).getString(KEY_LAST_TYPE, "UNKNOWN");
  }

  public static int getLastConfidence(Context context) {
    return prefs(context).getInt(KEY_LAST_CONFIDENCE, 0);
  }

  public static long getLastEventAt(Context context) {
    return prefs(context).getLong(KEY_LAST_EVENT_AT, 0L);
  }

  public static long getLastStartAt(Context context) {
    return prefs(context).getLong(KEY_LAST_START_AT, 0L);
  }

  public static long getLastStopAt(Context context) {
    return prefs(context).getLong(KEY_LAST_STOP_AT, 0L);
  }

  public static String getLastError(Context context) {
    return prefs(context).getString(KEY_LAST_ERROR, "");
  }

  public static String getLastDebugLabel(Context context) {
    return prefs(context).getString(KEY_LAST_DEBUG_LABEL, "");
  }

  public static int getEventCount(Context context) {
    return prefs(context).getInt(KEY_EVENT_COUNT, 0);
  }

  public static void enqueuePendingEvent(Context context, JSONObject event) {
    if (event == null) {
      return;
    }

    JSONArray events = getPendingEvents(context);
    events.put(event);

    // Keep pending payload bounded to avoid unbounded shared preferences growth.
    if (events.length() > MAX_PENDING_EVENTS) {
      JSONArray trimmed = new JSONArray();
      int start = Math.max(0, events.length() - MAX_PENDING_EVENTS);
      for (int i = start; i < events.length(); i++) {
        Object value = events.opt(i);
        if (value != null) {
          trimmed.put(value);
        }
      }
      events = trimmed;
    }

    prefs(context).edit().putString(KEY_PENDING_EVENTS, events.toString()).apply();
  }

  public static JSONArray getPendingEvents(Context context) {
    String raw = prefs(context).getString(KEY_PENDING_EVENTS, "[]");
    try {
      return new JSONArray(raw == null ? "[]" : raw);
    } catch (Exception ignored) {
      return new JSONArray();
    }
  }

  public static JSONArray drainPendingEvents(Context context) {
    JSONArray events = getPendingEvents(context);
    prefs(context).edit().remove(KEY_PENDING_EVENTS).apply();
    return events;
  }
}
