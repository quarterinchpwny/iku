package com.qipz.activityrecognition;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.UUID;

public final class ActivityRecognitionDebug {
    private static final String PREFS = "qipz_activity_debug";

    private static final String KEY_ENABLED                       = "enabled";
    private static final String KEY_LAST_TYPE                     = "last_type";
    private static final String KEY_LAST_CONFIDENCE               = "last_confidence";
    private static final String KEY_LAST_EVENT_AT                 = "last_event_at";
    private static final String KEY_LAST_START_AT                 = "last_start_at";
    private static final String KEY_LAST_STOP_AT                  = "last_stop_at";
    private static final String KEY_LAST_ERROR                    = "last_error";
    private static final String KEY_LAST_DEBUG_LABEL              = "last_debug_label";
    private static final String KEY_EVENT_COUNT                   = "event_count";
    private static final String KEY_PENDING_EVENTS                = "pending_events";
    private static final String KEY_DEBUG_ENABLED                 = "debug_enabled";
    private static final String KEY_ACTIVITY_NOTIFICATIONS_ENABLED = "activity_notifications_enabled";
    private static final String KEY_HIGH_RELIABILITY_MODE_ENABLED = "high_reliability_mode_enabled";
    private static final String KEY_ACCOUNT_KEY                   = "account_key";
    private static final String KEY_LAST_STILL_SYNC_AT            = "last_still_sync_at";
    private static final String KEY_LAST_UNKNOWN_SYNC_AT          = "last_unknown_sync_at";
    private static final String KEY_GEOFENCES                     = "geofences";
    /** Current trip UUID — set when movement begins, cleared on STILL. */
    private static final String KEY_CURRENT_TRIP_ID               = "current_trip_id";
    private static final int    MAX_PENDING_EVENTS                 = 50;

    private ActivityRecognitionDebug() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void markStarted(Context context) {
        prefs(context).edit()
            .putBoolean(KEY_ENABLED, true)
            .putLong(KEY_LAST_START_AT, System.currentTimeMillis())
            .apply();
    }

    public static void markStopped(Context context) {
        prefs(context).edit()
            .putBoolean(KEY_ENABLED, false)
            .putLong(KEY_LAST_STOP_AT, System.currentTimeMillis())
            .remove(KEY_CURRENT_TRIP_ID)
            .apply();
    }

    public static void markEvent(Context context, String type, int confidence) {
        prefs(context).edit()
            .putString(KEY_LAST_TYPE, type == null ? "UNKNOWN" : type)
            .putInt(KEY_LAST_CONFIDENCE, confidence)
            .putLong(KEY_LAST_EVENT_AT, System.currentTimeMillis())
            .putInt(KEY_EVENT_COUNT, prefs(context).getInt(KEY_EVENT_COUNT, 0) + 1)
            .apply();
    }

    public static void markDebugLabel(Context context, String label) {
        prefs(context).edit()
            .putString(KEY_LAST_DEBUG_LABEL, label == null ? "" : label)
            .apply();
    }

    public static void clearError(Context context) {
        prefs(context).edit().putString(KEY_LAST_ERROR, "").apply();
    }

    public static void markError(Context context, String message) {
        prefs(context).edit()
            .putString(KEY_LAST_ERROR, message == null ? "unknown" : message)
            .apply();
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

    public static boolean isDebugEnabled(Context context) {
        return prefs(context).getBoolean(KEY_DEBUG_ENABLED, false);
    }

    public static void setDebugEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_DEBUG_ENABLED, enabled).apply();
    }

    public static boolean isActivityNotificationsEnabled(Context context) {
        return prefs(context).getBoolean(KEY_ACTIVITY_NOTIFICATIONS_ENABLED, true);
    }

    public static void setActivityNotificationsEnabled(Context context, boolean enabled) {
        prefs(context).edit()
            .putBoolean(KEY_ACTIVITY_NOTIFICATIONS_ENABLED, enabled)
            .apply();
    }

    public static boolean isHighReliabilityModeEnabled(Context context) {
        return prefs(context).getBoolean(KEY_HIGH_RELIABILITY_MODE_ENABLED, false);
    }

    public static void setHighReliabilityModeEnabled(Context context, boolean enabled) {
        prefs(context).edit()
            .putBoolean(KEY_HIGH_RELIABILITY_MODE_ENABLED, enabled)
            .apply();
    }

    public static String getAccountKey(Context context) {
        String value = prefs(context).getString(KEY_ACCOUNT_KEY, "");
        return value == null ? "" : value;
    }

    public static void setAccountKey(Context context, String key) {
        String value = key == null ? "" : key.trim();
        if (value.length() > 128) value = value.substring(0, 128);
        prefs(context).edit().putString(KEY_ACCOUNT_KEY, value).apply();
    }

    public static long getLastStillSyncAt(Context context) {
        return prefs(context).getLong(KEY_LAST_STILL_SYNC_AT, 0L);
    }

    public static void setLastStillSyncAt(Context context, long millis) {
        prefs(context).edit().putLong(KEY_LAST_STILL_SYNC_AT, millis).apply();
    }

    public static long getLastUnknownSyncAt(Context context) {
        return prefs(context).getLong(KEY_LAST_UNKNOWN_SYNC_AT, 0L);
    }

    public static void setLastUnknownSyncAt(Context context, long millis) {
        prefs(context).edit().putLong(KEY_LAST_UNKNOWN_SYNC_AT, millis).apply();
    }

    // ── Trip ID ───────────────────────────────────────────────────────────────

    /**
     * Returns the current trip ID, creating a new one if there isn't one yet.
     * Call this when the activity transitions into a moving state.
     */
    public static String getOrCreateTripId(Context context) {
        String existing = prefs(context).getString(KEY_CURRENT_TRIP_ID, null);
        if (existing != null && !existing.isEmpty()) return existing;
        String newId = UUID.randomUUID().toString();
        prefs(context).edit().putString(KEY_CURRENT_TRIP_ID, newId).apply();
        return newId;
    }

    /**
     * Returns the active trip ID without creating one, or empty string if none.
     */
    public static String getCurrentTripId(Context context) {
        String value = prefs(context).getString(KEY_CURRENT_TRIP_ID, "");
        return value == null ? "" : value;
    }

    /**
     * Called when activity transitions to STILL — ends the current trip.
     */
    public static void clearTripId(Context context) {
        prefs(context).edit().remove(KEY_CURRENT_TRIP_ID).apply();
    }

    // ── Pending events ────────────────────────────────────────────────────────

    public static void enqueuePendingEvent(Context context, JSONObject event) {
        if (event == null) return;
        JSONArray events = getPendingEvents(context);
        events.put(event);
        if (events.length() > MAX_PENDING_EVENTS) {
            JSONArray trimmed = new JSONArray();
            int start = events.length() - MAX_PENDING_EVENTS;
            for (int i = start; i < events.length(); i++) {
                Object value = events.opt(i);
                if (value != null) trimmed.put(value);
            }
            events = trimmed;
        }
        prefs(context).edit().putString(KEY_PENDING_EVENTS, events.toString()).apply();
    }

    public static JSONArray getPendingEvents(Context context) {
        String raw = prefs(context).getString(KEY_PENDING_EVENTS, "[]");
        try {
            return new JSONArray(raw == null ? "[]" : raw);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    public static JSONArray drainPendingEvents(Context context) {
        JSONArray events = getPendingEvents(context);
        prefs(context).edit().remove(KEY_PENDING_EVENTS).apply();
        return events;
    }

    public static void setGeofences(Context context, JSONArray geofences) {
        if (geofences == null) {
            prefs(context).edit().remove(KEY_GEOFENCES).apply();
            return;
        }
        prefs(context).edit().putString(KEY_GEOFENCES, geofences.toString()).apply();
    }

    public static JSONArray getGeofences(Context context) {
        String raw = prefs(context).getString(KEY_GEOFENCES, "[]");
        try {
            return new JSONArray(raw == null ? "[]" : raw);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    public static int getGeofenceCount(Context context) {
        return getGeofences(context).length();
    }
}
