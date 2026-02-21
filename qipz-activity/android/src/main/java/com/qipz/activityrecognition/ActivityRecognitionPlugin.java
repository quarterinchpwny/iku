package com.qipz.activityrecognition;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.PermissionState;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.location.ActivityRecognition;
import com.google.android.gms.location.ActivityRecognitionClient;

import org.json.JSONException;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "qipz-activity",
    permissions = {
        @Permission(alias = "activityRecognition", strings = {Manifest.permission.ACTIVITY_RECOGNITION}),
        @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
    }
)
public class ActivityRecognitionPlugin extends Plugin {
    private static final long UPDATE_INTERVAL_MS = 5_000L;

    private static ActivityRecognitionPlugin instance;
    private ActivityRecognitionClient client;
    private PendingIntent pendingIntent;
    private boolean pendingStartAfterPermission;

    @Override
    public void load() {
        instance = this;
        client = ActivityRecognition.getClient(getContext());
        pendingIntent = buildPendingIntent(getContext());
    }

    /** Start walking/running detection */
    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("activityRecognition") != PermissionState.GRANTED) {
            pendingStartAfterPermission = true;
            ActivityRecognitionNotifier.debug(
                getContext(),
                "start: requesting ACTIVITY_RECOGNITION permission"
            );
            requestPermissionForAlias("activityRecognition", call, "onStartAndPermissionsResult");
            return;
        }
        startActivityUpdates(call);
    }

    @PluginMethod
    public void requestStartPermissions(PluginCall call) {
        if (requestStartPermissionsIfNeeded(call)) {
            return;
        }
        call.resolve(statusObject());
    }

    @PluginMethod
    public void checkStartPermissions(PluginCall call) {
        boolean canStart = getPermissionState("activityRecognition") == PermissionState.GRANTED;
        JSObject ret = statusObject();
        ret.put("canStart", canStart);
        JSONArray missing = new JSONArray();
        if (!canStart) {
            missing.put("activityRecognition");
        }
        ret.put("missingPermissions", missing);
        call.resolve(ret);
    }

    @PermissionCallback
    private void onStartPermissionsResult(PluginCall call) {
        if (getPermissionState("activityRecognition") != PermissionState.GRANTED) {
            ActivityRecognitionNotifier.debug(
                getContext(),
                "requestStartPermissions: missing ACTIVITY_RECOGNITION"
            );
            call.resolve(permissionStatusObject(false, "Missing required permissions: activityRecognition"));
            return;
        }
        ActivityRecognitionNotifier.debug(getContext(), "requestStartPermissions: granted");
        call.resolve(statusObject());
    }

    @PermissionCallback
    private void onStartAndPermissionsResult(PluginCall call) {
        if (getPermissionState("activityRecognition") != PermissionState.GRANTED) {
            pendingStartAfterPermission = false;
            ActivityRecognitionDebug.markError(getContext(), "ACTIVITY_RECOGNITION permission not granted");
            ActivityRecognitionNotifier.debug(getContext(), "start: ACTIVITY_RECOGNITION denied");
            call.resolve(permissionStatusObject(false, "Missing required permissions: activityRecognition"));
            return;
        }
        if (pendingStartAfterPermission) {
            pendingStartAfterPermission = false;
            startActivityUpdates(call);
            return;
        }
        call.resolve(statusObject());
    }

    private boolean requestStartPermissionsIfNeeded(PluginCall call) {
        if (getPermissionState("activityRecognition") == PermissionState.GRANTED) {
            return false;
        }
        requestPermissionForAlias("activityRecognition", call, "onStartPermissionsResult");
        return true;
    }

    private void startActivityUpdates(PluginCall call) {
        client.requestActivityUpdates(UPDATE_INTERVAL_MS, pendingIntent)
            .addOnSuccessListener(r -> {
                ActivityRecognitionDebug.markStarted(getContext());
                ActivityRecognitionDebug.clearError(getContext());
                ActivityRecognitionNotifier.debug(getContext(), "start: activity updates active");
                call.resolve(statusObject());
            })
            .addOnFailureListener(e -> {
                ActivityRecognitionDebug.markError(getContext(), "start_failed: " + e.getMessage());
                ActivityRecognitionNotifier.debug(
                    getContext(),
                    "start_failed: " + (e.getMessage() == null ? "unknown" : e.getMessage())
                );
                call.reject("Failed to start activity recognition: " + e.getMessage());
            });
    }

    /** Stop detection */
    @PluginMethod
    public void stop(PluginCall call) {
        client.removeActivityUpdates(pendingIntent)
                .addOnSuccessListener(r -> {
                    ActivityRecognitionDebug.markStopped(getContext());
                    ActivityRecognitionNotifier.debug(getContext(), "stop: activity updates removed");
                    call.resolve(statusObject());
                })
                .addOnFailureListener(e -> {
                    ActivityRecognitionDebug.markError(getContext(), "stop_failed: " + e.getMessage());
                    ActivityRecognitionNotifier.debug(
                        getContext(),
                        "stop_failed: " + (e.getMessage() == null ? "unknown" : e.getMessage())
                    );
                    call.reject("Failed to stop activity recognition: " + e.getMessage());
                });
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(statusObject());
    }

    @PluginMethod
    public void drainPendingEvents(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("events", ActivityRecognitionDebug.drainPendingEvents(getContext()));
        call.resolve(ret);
    }

    /** Notify JS listeners */
    public static boolean emitActivityChange(JSONObject data) {
        if (instance == null) return false;
        try {
            JSObject js = JSObject.fromJSONObject(data);
            instance.notifyListeners("activityChange", js, true);
            return true;
        } catch (JSONException ignored) {
            // Ignore malformed payloads from native receiver.
            return false;
        }
    }

    public static void recoverIfEnabled(Context context) {
        if (!ActivityRecognitionDebug.isEnabled(context)) {
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            && context.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION)
            != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            ActivityRecognitionDebug.markError(context, "ACTIVITY_RECOGNITION permission not granted");
            ActivityRecognitionNotifier.debug(context, "recover: missing ACTIVITY_RECOGNITION permission");
            return;
        }

        ActivityRecognitionClient client = ActivityRecognition.getClient(context);
        PendingIntent pendingIntent = buildPendingIntent(context);
        client.requestActivityUpdates(UPDATE_INTERVAL_MS, pendingIntent)
            .addOnSuccessListener(r -> {
                ActivityRecognitionDebug.markStarted(context);
                ActivityRecognitionDebug.clearError(context);
                ActivityRecognitionNotifier.debug(context, "recover: activity updates restored");
            })
            .addOnFailureListener(e -> {
                ActivityRecognitionDebug.markError(context, "recover_failed: " + e.getMessage());
                ActivityRecognitionNotifier.debug(
                    context,
                    "recover_failed: " + (e.getMessage() == null ? "unknown" : e.getMessage())
                );
            });
    }

    private static PendingIntent buildPendingIntent(Context context) {
        Intent intent = new Intent(context, ActivityRecognitionReceiver.class);
        intent.setAction("com.qipz.activityrecognition.ACTIVITY_UPDATE");
        return PendingIntent.getBroadcast(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private JSObject permissionStatusObject(boolean canStart, String permissionError) {
        JSObject ret = statusObject();
        ret.put("canStart", canStart);
        JSONArray missing = new JSONArray();
        if (!canStart) {
            missing.put("activityRecognition");
        }
        ret.put("missingPermissions", missing);
        ret.put("permissionError", permissionError == null ? "" : permissionError);
        return ret;
    }

    private JSObject statusObject() {
        JSObject ret = new JSObject();
        ret.put("enabled", ActivityRecognitionDebug.isEnabled(getContext()));
        ret.put("lastType", ActivityRecognitionDebug.getLastType(getContext()));
        ret.put("lastConfidence", ActivityRecognitionDebug.getLastConfidence(getContext()));
        ret.put("lastEventAt", ActivityRecognitionDebug.getLastEventAt(getContext()));
        ret.put("lastStartAt", ActivityRecognitionDebug.getLastStartAt(getContext()));
        ret.put("lastStopAt", ActivityRecognitionDebug.getLastStopAt(getContext()));
        ret.put("lastError", ActivityRecognitionDebug.getLastError(getContext()));
        ret.put("lastDebugLabel", ActivityRecognitionDebug.getLastDebugLabel(getContext()));
        ret.put("eventCount", ActivityRecognitionDebug.getEventCount(getContext()));
        ret.put("canStart", getPermissionState("activityRecognition") == PermissionState.GRANTED);
        return ret;
    }
}
