package com.qipz.activityrecognition;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

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
import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionRequest;
import com.google.android.gms.location.DetectedActivity;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;

import org.json.JSONException;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "qipz-activity",
    permissions = {
        @Permission(alias = "activityRecognition", strings = {Manifest.permission.ACTIVITY_RECOGNITION}),
        @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
    }
)
public class ActivityRecognitionPlugin extends Plugin {
    private static final String TAG = "QipzActivity";
    private static final long UPDATE_INTERVAL_MS = 5_000L;
    private static final long RECOVER_COOLDOWN_MS = 15_000L;

    private static ActivityRecognitionPlugin instance;
    private static long lastRecoverAttemptAt = 0L;
    private ActivityRecognitionClient client;
    private PendingIntent pendingIntent;
    private PendingIntent transitionPendingIntent;
    private boolean pendingStartAfterPermission;

    @Override
    public void load() {
        instance = this;
        client = ActivityRecognition.getClient(getContext());
        pendingIntent = buildPendingIntent(getContext());
        transitionPendingIntent = buildTransitionPendingIntent(getContext());
        // Recover registration on every app start if debug state says it should be active.
        safeRecoverIfEnabled(getContext(), "load");
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
        Task<Void> updatesTask = client.requestActivityUpdates(UPDATE_INTERVAL_MS, pendingIntent);
        Task<Void> transitionsTask = client.requestActivityTransitionUpdates(buildTransitionRequest(), transitionPendingIntent);

        Tasks.whenAllComplete(updatesTask, transitionsTask)
            .addOnSuccessListener(tasks -> {
                boolean updatesOk = updatesTask.isSuccessful();
                boolean transitionsOk = transitionsTask.isSuccessful();

                if (!updatesOk && !transitionsOk) {
                    String updatesErr = updatesTask.getException() == null ? "unknown" : String.valueOf(updatesTask.getException().getMessage());
                    String transitionsErr = transitionsTask.getException() == null ? "unknown" : String.valueOf(transitionsTask.getException().getMessage());
                    String message = "updates=" + updatesErr + ", transitions=" + transitionsErr;
                    ActivityRecognitionDebug.markError(getContext(), "start_failed: " + message);
                    ActivityRecognitionNotifier.debug(getContext(), "start_failed: " + message);
                    call.reject("Failed to start activity recognition: " + message);
                    return;
                }

                ActivityRecognitionDebug.markStarted(getContext());
                ActivityRecognitionDebug.clearError(getContext());
                ActivityRecognitionNotifier.debug(
                    getContext(),
                    "start: activity active (updates=" + updatesOk + ", transitions=" + transitionsOk + ")"
                );
                Log.i(
                    TAG,
                    "start: updatesOk=" + updatesOk + " transitionsOk=" + transitionsOk + " intervalMs=" + UPDATE_INTERVAL_MS
                );
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
        Task<Void> updatesTask = client.removeActivityUpdates(pendingIntent);
        Task<Void> transitionsTask = client.removeActivityTransitionUpdates(transitionPendingIntent);

        Tasks.whenAllComplete(updatesTask, transitionsTask)
            .addOnSuccessListener(tasks -> {
                boolean updatesOk = updatesTask.isSuccessful();
                boolean transitionsOk = transitionsTask.isSuccessful();

                if (!updatesOk && !transitionsOk) {
                    String updatesErr = updatesTask.getException() == null ? "unknown" : String.valueOf(updatesTask.getException().getMessage());
                    String transitionsErr = transitionsTask.getException() == null ? "unknown" : String.valueOf(transitionsTask.getException().getMessage());
                    String message = "updates=" + updatesErr + ", transitions=" + transitionsErr;
                    ActivityRecognitionDebug.markError(getContext(), "stop_failed: " + message);
                    ActivityRecognitionNotifier.debug(getContext(), "stop_failed: " + message);
                    call.reject("Failed to stop activity recognition: " + message);
                    return;
                }

                ActivityRecognitionDebug.markStopped(getContext());
                ActivityRecognitionNotifier.debug(
                    getContext(),
                    "stop: activity updates removed (updates=" + updatesOk + ", transitions=" + transitionsOk + ")"
                );
                Log.i(TAG, "stop: updatesOk=" + updatesOk + " transitionsOk=" + transitionsOk);
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
        JSObject status = statusObject();
        maybeRecoverFromStaleState(status);
        Log.v(
            TAG,
            "status enabled=" + status.getBool("enabled")
                + " eventCount=" + status.getInteger("eventCount")
                + " lastType=" + status.getString("lastType")
                + " lastEventAt=" + status.optLong("lastEventAt", 0L)
        );
        call.resolve(status);
    }

    private void maybeRecoverFromStaleState(JSObject status) {
        if (!status.optBoolean("enabled", false)) {
            return;
        }
        long lastStartAt = status.optLong("lastStartAt", 0L);
        long lastEventAt = status.optLong("lastEventAt", 0L);
        long now = System.currentTimeMillis();

        // If enabled but we have never received an event for a while, try re-registering.
        boolean staleNoEvents = lastEventAt <= 0 && lastStartAt > 0 && (now - lastStartAt) > 60_000L;
        if (staleNoEvents) {
            safeRecoverIfEnabled(getContext(), "status_stale");
        }
    }

    private static void safeRecoverIfEnabled(Context context, String reason) {
        long now = System.currentTimeMillis();
        if ((now - lastRecoverAttemptAt) < RECOVER_COOLDOWN_MS) {
            return;
        }
        lastRecoverAttemptAt = now;
        ActivityRecognitionNotifier.debug(context, "recover_trigger: " + reason);
        Log.i(TAG, "recover_trigger: " + reason);
        recoverIfEnabled(context);
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
        PendingIntent transitionPendingIntent = buildTransitionPendingIntent(context);
        Task<Void> updatesTask = client.requestActivityUpdates(UPDATE_INTERVAL_MS, pendingIntent);
        Task<Void> transitionsTask = client.requestActivityTransitionUpdates(buildTransitionRequest(), transitionPendingIntent);

        Tasks.whenAllComplete(updatesTask, transitionsTask)
            .addOnSuccessListener(tasks -> {
                boolean updatesOk = updatesTask.isSuccessful();
                boolean transitionsOk = transitionsTask.isSuccessful();
                if (!updatesOk && !transitionsOk) {
                    String updatesErr = updatesTask.getException() == null ? "unknown" : String.valueOf(updatesTask.getException().getMessage());
                    String transitionsErr = transitionsTask.getException() == null ? "unknown" : String.valueOf(transitionsTask.getException().getMessage());
                    String message = "updates=" + updatesErr + ", transitions=" + transitionsErr;
                    ActivityRecognitionDebug.markError(context, "recover_failed: " + message);
                    ActivityRecognitionNotifier.debug(context, "recover_failed: " + message);
                    return;
                }
                ActivityRecognitionDebug.markStarted(context);
                ActivityRecognitionDebug.clearError(context);
                ActivityRecognitionNotifier.debug(
                    context,
                    "recover: restored (updates=" + updatesOk + ", transitions=" + transitionsOk + ")"
                );
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
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_MUTABLE;
        } else {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(
            context,
            0,
            intent,
            flags
        );
    }

    private static PendingIntent buildTransitionPendingIntent(Context context) {
        Intent intent = new Intent(context, ActivityRecognitionReceiver.class);
        intent.setAction("com.qipz.activityrecognition.ACTIVITY_TRANSITION");
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_MUTABLE;
        } else {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(
            context,
            1001,
            intent,
            flags
        );
    }

    private static ActivityTransitionRequest buildTransitionRequest() {
        List<ActivityTransition> transitions = new ArrayList<>();
        int[] types = new int[] {
            DetectedActivity.WALKING,
            DetectedActivity.RUNNING,
            DetectedActivity.IN_VEHICLE,
            DetectedActivity.STILL,
            DetectedActivity.ON_FOOT
        };
        for (int type : types) {
            transitions.add(
                new ActivityTransition.Builder()
                    .setActivityType(type)
                    .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                    .build()
            );
            transitions.add(
                new ActivityTransition.Builder()
                    .setActivityType(type)
                    .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT)
                    .build()
            );
        }
        return new ActivityTransitionRequest(transitions);
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
