package com.qipz.activityrecognition;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

final class PluginLogStore {
    private static final String PREFS = "qipz_activity_debug";
    private static final String KEY_LOGS = "plugin_logs";
    private static final int MAX_LOGS = 400;

    private PluginLogStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void append(Context context, String source, String level, String message) {
        if (context == null) return;
        String safeSource = source == null ? "unknown" : source.trim();
        if (safeSource.isEmpty()) safeSource = "unknown";
        String safeLevel = level == null ? "INFO" : level.trim().toUpperCase();
        if (safeLevel.isEmpty()) safeLevel = "INFO";
        String safeMessage = message == null ? "" : message.trim();
        if (safeMessage.length() > 1200) safeMessage = safeMessage.substring(0, 1200);

        JSONArray logs = getAll(context);
        JSONObject row = new JSONObject();
        try {
            row.put("timestamp", System.currentTimeMillis());
            row.put("source", safeSource);
            row.put("level", safeLevel);
            row.put("message", safeMessage);
        } catch (Exception ignored) {
            return;
        }
        logs.put(row);

        if (logs.length() > MAX_LOGS) {
            JSONArray trimmed = new JSONArray();
            int start = logs.length() - MAX_LOGS;
            for (int i = start; i < logs.length(); i++) {
                Object value = logs.opt(i);
                if (value != null) trimmed.put(value);
            }
            logs = trimmed;
        }

        prefs(context).edit().putString(KEY_LOGS, logs.toString()).apply();
    }

    static JSONArray get(Context context, int limit) {
        JSONArray logs = getAll(context);
        if (limit <= 0 || logs.length() <= limit) return logs;
        JSONArray sliced = new JSONArray();
        int start = Math.max(0, logs.length() - limit);
        for (int i = start; i < logs.length(); i++) {
            Object value = logs.opt(i);
            if (value != null) sliced.put(value);
        }
        return sliced;
    }

    static void clear(Context context) {
        if (context == null) return;
        prefs(context).edit().remove(KEY_LOGS).apply();
    }

    private static JSONArray getAll(Context context) {
        if (context == null) return new JSONArray();
        String raw = prefs(context).getString(KEY_LOGS, "[]");
        try {
            return new JSONArray(raw == null ? "[]" : raw);
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }
}
