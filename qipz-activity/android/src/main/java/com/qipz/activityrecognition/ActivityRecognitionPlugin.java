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
        @Permission(
            alias = "location",
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }
        ),
        @Permission(alias = "backgroundLocation", strings = {Manifest.permission.ACCESS_BACKGROUND_LOCATION}),
        @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
    }
)
public class ActivityRecognitionPlugin extends Plugin {
    private static final String TAG = "QipzActivity";
    private static final long UPDATE_INTERVAL_MS = 5_000L;
    private static final long RECOVER_COOLDOWN_MS = 15_000L;
    private static final long REGISTER_DEBOUNCE_MS = 10_000L;
    private static final int PI_UPDATES_REQUEST_CODE =
        ("qipz.updates".hashCode() & 0x7FFFFFFF) % 65536;
    private static final int PI_TRANSITIONS_REQUEST_CODE =
        ("qipz.transitions".hashCode() & 0x7FFFFFFF) % 65536;

    private static ActivityRecognitionPlugin instance;
    private static long lastRecoverAttemptAt = 0L;
    private static final Object REGISTRATION_LOCK = new Object();
    private static boolean registrationInFlight = false;
    private static boolean registrationActive = false;
    private static long lastRegisterAttemptAt = 0L;
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
        PluginLogStore.append(getContext(), "plugin.load", "INFO", "plugin loaded");
        if (ActivityRecognitionDebug.isEnabled(getContext())) {
            ActivityRecognitionWatchdog.schedule(getContext(), "load");
        }
        // Recover registration on every app start if debug state says it should be active.
        triggerRecover(getContext(), "load");
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
        if (needsLocationPermission()) {
            ActivityRecognitionNotifier.debug(
                getContext(),
                "start: requesting location permission"
            );
            requestPermissionForAlias("location", call, "onStartAndLocationResult");
            return;
        }
        if (needsBackgroundLocationPermission()) {
            ActivityRecognitionNotifier.debug(
                getContext(),
                "start: requesting background location permission"
            );
            requestPermissionForAlias("backgroundLocation", call, "onStartAndBackgroundLocationResult");
            return;
        }
        if (needsNotificationPermission()) {
            ActivityRecognitionNotifier.debug(
                getContext(),
                "start: requesting POST_NOTIFICATIONS permission"
            );
            requestPermissionForAlias("notifications", call, "onStartAndNotificationsResult");
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
        boolean hasActivity = getPermissionState("activityRecognition") == PermissionState.GRANTED;
        boolean hasLocation = !needsLocationPermission();
        boolean hasBackgroundLocation = !needsBackgroundLocationPermission();
        boolean canStart = hasActivity && hasLocation && hasBackgroundLocation;
        JSObject ret = statusObject();
        boolean canNotify = !needsNotificationPermission();
        ret.put("canStart", canStart);
        ret.put("canNotify", canNotify);
        JSONArray missing = new JSONArray();
        if (!hasActivity) {
            missing.put("activityRecognition");
        }
        if (!hasLocation) {
            missing.put("location");
        }
        if (!hasBackgroundLocation) {
            missing.put("backgroundLocation");
        }
        if (!canNotify) {
            missing.put("notifications");
        }
        ret.put("missingPermissions", missing);
        call.resolve(ret);
    }

    @PluginMethod
    public void setDebugEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        ActivityRecognitionDebug.setDebugEnabled(getContext(), enabled);
        call.resolve(statusObject());
    }

    @PluginMethod
    public void setActivityNotificationsEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        ActivityRecognitionDebug.setActivityNotificationsEnabled(getContext(), enabled);
        call.resolve(statusObject());
    }

    @PluginMethod
    public void setHighReliabilityMode(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        ActivityRecognitionDebug.setHighReliabilityModeEnabled(getContext(), enabled);
        if (ActivityRecognitionDebug.isEnabled(getContext())) {
            LocationForegroundService.onActivityChanged(
                getContext(),
                ActivityRecognitionDebug.getLastType(getContext())
            );
        }
        call.resolve(statusObject());
    }

    @PluginMethod
    public void setAccountKey(PluginCall call) {
        String accountKey = call.getString("accountKey", "");
        ActivityRecognitionDebug.setAccountKey(getContext(), accountKey);
        call.resolve(statusObject());
    }

    @PluginMethod
    public void setJsPassiveActive(PluginCall call) {
        boolean active = call.getBoolean("active", false);
        ActivityRecognitionDebug.setJsPassiveActive(getContext(), active);
        call.resolve(statusObject());
    }

    @PluginMethod
    public void setGeofences(PluginCall call) {
        JSONArray input = call.getData().optJSONArray("geofences");
        JSONArray normalized = new JSONArray();
        if (input != null) {
            for (int i = 0; i < input.length(); i++) {
                JSONObject item = input.optJSONObject(i);
                if (item == null) continue;
                String id = String.valueOf(item.opt("id")).trim();
                String name = item.optString("name", "").trim();
                double lat = item.optDouble("lat", Double.NaN);
                double lng = item.optDouble("lng", Double.NaN);
                double radius = item.optDouble("radius", Double.NaN);
                if (id.isEmpty() || name.isEmpty()) continue;
                if (!Double.isFinite(lat) || !Double.isFinite(lng)) continue;
                if (!Double.isFinite(radius) || radius < 25 || radius > 5000) continue;
                JSONObject row = new JSONObject();
                try {
                    row.put("id", id);
                    row.put("name", name);
                    row.put("lat", lat);
                    row.put("lng", lng);
                    row.put("radius", radius);
                    row.put("enabled", item.optBoolean("enabled", true));
                    String lastState = item.optString("lastState", "outside");
                    row.put("lastState", "inside".equalsIgnoreCase(lastState) ? "inside" : "outside");
                    long lastTransitionAt = item.optLong("lastTransitionAt", 0L);
                    if (lastTransitionAt > 0) row.put("lastTransitionAt", lastTransitionAt);
                    normalized.put(row);
                } catch (Exception ignored) {
                }
            }
        }
        ActivityRecognitionDebug.setGeofences(getContext(), normalized);
        call.resolve(statusObject());
    }

    @PluginMethod
    public void getPluginLogs(PluginCall call) {
        int limit = call.getInt("limit", 200);
        if (limit < 1) limit = 1;
        if (limit > 400) limit = 400;
        JSObject ret = new JSObject();
        ret.put("logs", PluginLogStore.get(getContext(), limit));
        call.resolve(ret);
    }

    @PluginMethod
    public void getTimeline(PluginCall call) {
        JSONObject data = call.getData();
        long fromMs = data.optLong("fromMs", 0L);
        long toMs = data.optLong("toMs", System.currentTimeMillis());
        int limit = data.optInt("limit", 200);
        if (limit < 1) limit = 1;
        if (limit > 1000) limit = 1000;

        ActivitySyncQueueStore store = new ActivitySyncQueueStore(getContext());
        TimelineAssembler.TimelineResult result = store.getTimeline(fromMs, toMs, limit);

        JSObject ret = new JSObject();
        ret.put("segments", result.segments);
        ret.put("placeCount", result.placeCount);
        ret.put("tripCount", result.tripCount);
        call.resolve(ret);
    }

    @PluginMethod
    public void getPlaceVisits(PluginCall call) {
        JSONObject data = call.getData();
        long fromMs = data.optLong("fromMs", 0L);
        long toMs = data.optLong("toMs", System.currentTimeMillis());
        int limit = data.optInt("limit", 100);
        if (limit < 1) limit = 1;
        if (limit > 500) limit = 500;

        ActivitySyncQueueStore store = new ActivitySyncQueueStore(getContext());
        List<PlaceVisitStore.PlaceVisitRecord> visits = store.getPlaceVisits(fromMs, toMs, limit);

        JSONArray arr = new JSONArray();
        for (PlaceVisitStore.PlaceVisitRecord visit : visits) {
            arr.put(visit.toJson());
        }

        JSObject ret = new JSObject();
        ret.put("visits", arr);
        ret.put("count", visits.size());
        call.resolve(ret);
    }

    @PluginMethod
    public void setPlaceLabel(PluginCall call) {
        long labelId = call.getData().optLong("labelId", -1L);
        String name = call.getString("name", "");
        if (labelId <= 0) {
            call.reject("labelId is required");
            return;
        }
        ActivitySyncQueueStore store = new ActivitySyncQueueStore(getContext());
        store.setPlaceLabel(labelId, name);
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getTripStats(PluginCall call) {
        JSONObject data = call.getData();
        long fromMs = data.optLong("fromMs", 0L);
        long toMs = data.optLong("toMs", System.currentTimeMillis());
        int limit = data.optInt("limit", 100);
        if (limit < 1) limit = 1;
        if (limit > 500) limit = 500;

        ActivitySyncQueueStore store = new ActivitySyncQueueStore(getContext());
        List<TripStatisticsStore.TripRecord> trips = store.getTripStats(fromMs, toMs, limit);

        JSONArray arr = new JSONArray();
        for (TripStatisticsStore.TripRecord trip : trips) {
            arr.put(trip.toJson());
        }

        JSObject ret = new JSObject();
        ret.put("trips", arr);
        ret.put("count", trips.size());
        call.resolve(ret);
    }

    @PluginMethod
    public void getPassiveEvents(PluginCall call) {
        JSONObject data = call.getData();
        long fromTs = data.has("fromTs") ? Math.max(0L, data.optLong("fromTs", 0L)) : 0L;
        long toTs = data.has("toTs") ? Math.max(0L, data.optLong("toTs", 0L)) : 0L;
        long cursor = data.has("cursor") ? Math.max(0L, data.optLong("cursor", 0L)) : 0L;
        int limit = data.has("limit") ? data.optInt("limit", 100) : 100;
        if (limit < 1) limit = 1;
        if (limit > 400) limit = 400;

        ActivitySyncQueueStore store = new ActivitySyncQueueStore(getContext());
        List<PassiveEventHistoryStore.PassiveEventRecord> rows =
            store.getPassiveEvents(fromTs, toTs, cursor, limit);

        JSONArray events = new JSONArray();
        long nextCursor = 0L;
        for (PassiveEventHistoryStore.PassiveEventRecord row : rows) {
            JSObject item = new JSObject();
            item.put("id", row.id);
            item.put("timestamp", row.timestamp);
            item.put("lat", row.lat);
            item.put("lng", row.lng);
            item.put("activityType", row.activityType);
            item.put("activityConfidence", row.activityConfidence);
            item.put("reason", row.reason);
            item.put("trigger", row.trigger);
            if (!Double.isNaN(row.acc)) item.put("acc", row.acc);
            if (!Double.isNaN(row.vel)) item.put("vel", row.vel);
            if (!Double.isNaN(row.cog)) item.put("cog", row.cog);
            if (!Double.isNaN(row.alt)) item.put("alt", row.alt);
            item.put("provider", row.provider);
            item.put("deviceId", row.deviceId);
            item.put("accountKey", row.accountKey);
            item.put("sampleHash", row.sampleHash);
            item.put("payloadVersion", row.payloadVersion);
            item.put("source", row.source);
            item.put("createdAt", row.createdAt);
            item.put("uploadedAt", row.uploadedAt);
            item.put("queueItemId", row.queueItemId);
            events.put(item);
            nextCursor = row.id;
        }

        JSObject ret = new JSObject();
        ret.put("events", events);
        ret.put("limit", limit);
        ret.put("hasMore", rows.size() >= limit);
        ret.put("nextCursor", rows.size() >= limit ? nextCursor : null);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearPluginLogs(PluginCall call) {
        PluginLogStore.clear(getContext());
        JSObject ret = new JSObject();
        ret.put("ok", true);
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
        if (needsLocationPermission()) {
            requestPermissionForAlias("location", call, "onStartPermissionsLocationResult");
            return;
        }
        if (needsBackgroundLocationPermission()) {
            requestPermissionForAlias("backgroundLocation", call, "onStartPermissionsBackgroundLocationResult");
            return;
        }
        if (needsNotificationPermission()) {
            requestPermissionForAlias("notifications", call, "onStartPermissionsNotificationsResult");
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
            if (needsLocationPermission()) {
                requestPermissionForAlias("location", call, "onStartAndLocationResult");
                return;
            }
            if (needsBackgroundLocationPermission()) {
                requestPermissionForAlias("backgroundLocation", call, "onStartAndBackgroundLocationResult");
                return;
            }
            if (needsNotificationPermission()) {
                requestPermissionForAlias("notifications", call, "onStartAndNotificationsResult");
                return;
            }
            startActivityUpdates(call);
            return;
        }
        call.resolve(statusObject());
    }

    @PermissionCallback
    private void onStartAndLocationResult(PluginCall call) {
        if (needsLocationPermission()) {
            pendingStartAfterPermission = false;
            ActivityRecognitionDebug.markError(getContext(), "Location permission not granted");
            ActivityRecognitionNotifier.debug(getContext(), "start: location permission denied");
            call.resolve(permissionStatusObject(false, "Missing required permissions: location"));
            return;
        }
        if (needsBackgroundLocationPermission()) {
            requestPermissionForAlias("backgroundLocation", call, "onStartAndBackgroundLocationResult");
            return;
        }
        if (needsNotificationPermission()) {
            requestPermissionForAlias("notifications", call, "onStartAndNotificationsResult");
            return;
        }
        startActivityUpdates(call);
    }

    @PermissionCallback
    private void onStartAndBackgroundLocationResult(PluginCall call) {
        if (needsBackgroundLocationPermission()) {
            pendingStartAfterPermission = false;
            ActivityRecognitionDebug.markError(getContext(), "Background location permission not granted");
            ActivityRecognitionNotifier.debug(getContext(), "start: background location permission denied");
            call.resolve(permissionStatusObject(false, "Missing required permissions: backgroundLocation"));
            return;
        }
        if (needsNotificationPermission()) {
            requestPermissionForAlias("notifications", call, "onStartAndNotificationsResult");
            return;
        }
        startActivityUpdates(call);
    }

    @PermissionCallback
    private void onStartPermissionsLocationResult(PluginCall call) {
        if (needsLocationPermission()) {
            call.resolve(permissionStatusObject(false, "Missing required permissions: location"));
            return;
        }
        if (needsBackgroundLocationPermission()) {
            requestPermissionForAlias("backgroundLocation", call, "onStartPermissionsBackgroundLocationResult");
            return;
        }
        if (needsNotificationPermission()) {
            requestPermissionForAlias("notifications", call, "onStartPermissionsNotificationsResult");
            return;
        }
        call.resolve(statusObject());
    }

    @PermissionCallback
    private void onStartPermissionsBackgroundLocationResult(PluginCall call) {
        if (needsBackgroundLocationPermission()) {
            call.resolve(permissionStatusObject(false, "Missing required permissions: backgroundLocation"));
            return;
        }
        if (needsNotificationPermission()) {
            requestPermissionForAlias("notifications", call, "onStartPermissionsNotificationsResult");
            return;
        }
        call.resolve(statusObject());
    }

    @PermissionCallback
    private void onStartAndNotificationsResult(PluginCall call) {
        if (needsNotificationPermission()) {
            ActivityRecognitionDebug.markError(
                getContext(),
                "POST_NOTIFICATIONS not granted; activity notifications disabled by system"
            );
            ActivityRecognitionNotifier.debug(getContext(), "start: POST_NOTIFICATIONS denied");
        }
        startActivityUpdates(call);
    }

    @PermissionCallback
    private void onStartPermissionsNotificationsResult(PluginCall call) {
        if (needsNotificationPermission()) {
            call.resolve(permissionStatusObject(
                true,
                "Notification permission denied. Activity detection can run, but notifications are blocked."
            ));
            return;
        }
        call.resolve(statusObject());
    }

    private boolean requestStartPermissionsIfNeeded(PluginCall call) {
        if (getPermissionState("activityRecognition") != PermissionState.GRANTED) {
            requestPermissionForAlias("activityRecognition", call, "onStartPermissionsResult");
            return true;
        }
        if (needsLocationPermission()) {
            requestPermissionForAlias("location", call, "onStartPermissionsLocationResult");
            return true;
        }
        if (needsBackgroundLocationPermission()) {
            requestPermissionForAlias("backgroundLocation", call, "onStartPermissionsBackgroundLocationResult");
            return true;
        }
        if (needsNotificationPermission()) {
            requestPermissionForAlias("notifications", call, "onStartPermissionsNotificationsResult");
            return true;
        }
        return false;
    }

    private boolean needsNotificationPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && getPermissionState("notifications") != PermissionState.GRANTED;
    }

    private boolean needsLocationPermission() {
        PermissionState fine = getPermissionState("location");
        return fine != PermissionState.GRANTED;
    }

    private boolean needsBackgroundLocationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return false;
        }
        return getPermissionState("backgroundLocation") != PermissionState.GRANTED;
    }

    private interface RegistrationListener {
        void onSkipped(String reason);
        void onSuccess(boolean updatesOk, boolean transitionsOk);
        void onFailure(String message);
    }

    private static String acquireRegistrationSlot(Context context, String reason, boolean forceRefresh) {
        synchronized (REGISTRATION_LOCK) {
            long now = System.currentTimeMillis();
            if (registrationInFlight) {
                PluginLogStore.append(context, "plugin.register", "INFO", "skip reason=in_flight request=" + reason);
                return "in_flight";
            }
            if (!forceRefresh && registrationActive) {
                PluginLogStore.append(context, "plugin.register", "INFO", "skip reason=already_active request=" + reason);
                return "already_active";
            }
            if ((now - lastRegisterAttemptAt) < REGISTER_DEBOUNCE_MS) {
                PluginLogStore.append(context, "plugin.register", "INFO", "skip reason=debounce request=" + reason);
                return "debounce";
            }
            registrationInFlight = true;
            lastRegisterAttemptAt = now;
            return null;
        }
    }

    private static void releaseRegistrationSlot(boolean success) {
        synchronized (REGISTRATION_LOCK) {
            registrationInFlight = false;
            if (success) {
                registrationActive = true;
            }
        }
    }

    private static void registerSubscriptions(
        Context context,
        ActivityRecognitionClient client,
        PendingIntent updatesPendingIntent,
        PendingIntent transitionsPendingIntent,
        String reason,
        boolean forceRefresh,
        RegistrationListener listener
    ) {
        String skipReason = acquireRegistrationSlot(context, reason, forceRefresh);
        if (skipReason != null) {
            listener.onSkipped(skipReason);
            return;
        }

        PluginLogStore.append(
            context,
            "plugin.register",
            "INFO",
            "begin reason=" + reason + " forceRefresh=" + forceRefresh
        );

        Task<Void> updatesTask = client.requestActivityUpdates(UPDATE_INTERVAL_MS, updatesPendingIntent);
        Task<Void> transitionsTask =
            client.requestActivityTransitionUpdates(buildTransitionRequest(), transitionsPendingIntent);
        Tasks.whenAllComplete(updatesTask, transitionsTask)
            .addOnSuccessListener(tasks -> {
                boolean updatesOk = updatesTask.isSuccessful();
                boolean transitionsOk = transitionsTask.isSuccessful();
                if (!updatesOk && !transitionsOk) {
                    String updatesErr = updatesTask.getException() == null ? "unknown" : String.valueOf(updatesTask.getException().getMessage());
                    String transitionsErr = transitionsTask.getException() == null ? "unknown" : String.valueOf(transitionsTask.getException().getMessage());
                    String message = "updates=" + updatesErr + ", transitions=" + transitionsErr;
                    releaseRegistrationSlot(false);
                    PluginLogStore.append(context, "plugin.register", "ERROR", "failed reason=" + reason + " " + message);
                    listener.onFailure(message);
                    return;
                }
                releaseRegistrationSlot(true);
                PluginLogStore.append(
                    context,
                    "plugin.register",
                    "INFO",
                    "success reason=" + reason + " updatesOk=" + updatesOk + " transitionsOk=" + transitionsOk
                );
                listener.onSuccess(updatesOk, transitionsOk);
            })
            .addOnFailureListener(e -> {
                releaseRegistrationSlot(false);
                String message = e.getMessage() == null ? "unknown" : e.getMessage();
                PluginLogStore.append(context, "plugin.register", "ERROR", "failed reason=" + reason + " error=" + message);
                listener.onFailure(message);
            });
    }

    private void startActivityUpdates(PluginCall call) {
        registerSubscriptions(getContext(), client, pendingIntent, transitionPendingIntent, "start", false, new RegistrationListener() {
            @Override
            public void onSkipped(String reason) {
                ActivityRecognitionDebug.markStarted(getContext());
                ActivityRecognitionDebug.clearError(getContext());
                PluginLogStore.append(getContext(), "plugin.start", "INFO", "skipped reason=" + reason);
                ActivityRecognitionWatchdog.schedule(getContext(), "start_skip");
                call.resolve(statusObject());
            }

            @Override
            public void onSuccess(boolean updatesOk, boolean transitionsOk) {
                ActivityRecognitionDebug.markStarted(getContext());
                ActivityRecognitionDebug.clearError(getContext());
                PluginLogStore.append(
                    getContext(),
                    "plugin.start",
                    "INFO",
                    "updatesOk=" + updatesOk + " transitionsOk=" + transitionsOk
                );
                ActivityRecognitionNotifier.debug(
                    getContext(),
                    "start: activity active (updates=" + updatesOk + ", transitions=" + transitionsOk + ")"
                );
                ActivityRecognitionWatchdog.schedule(getContext(), "start");
                call.resolve(statusObject());
            }

            @Override
            public void onFailure(String message) {
                ActivityRecognitionDebug.markError(getContext(), "start_failed: " + message);
                PluginLogStore.append(getContext(), "plugin.start", "ERROR", "failure=" + message);
                ActivityRecognitionNotifier.debug(getContext(), "start_failed: " + message);
                call.reject("Failed to start activity recognition: " + message);
            }
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
                LocationForegroundService.stop(getContext());
                ActivityRecognitionWatchdog.cancel(getContext());
                synchronized (REGISTRATION_LOCK) {
                    registrationActive = false;
                    registrationInFlight = false;
                }
                PluginLogStore.append(
                    getContext(),
                    "plugin.stop",
                    "INFO",
                    "updatesOk=" + updatesOk + " transitionsOk=" + transitionsOk
                );
                ActivityRecognitionNotifier.debug(
                    getContext(),
                    "stop: activity updates removed (updates=" + updatesOk + ", transitions=" + transitionsOk + ")"
                );
                Log.i(TAG, "stop: updatesOk=" + updatesOk + " transitionsOk=" + transitionsOk);
                call.resolve(statusObject());
            })
            .addOnFailureListener(e -> {
                ActivityRecognitionDebug.markError(getContext(), "stop_failed: " + e.getMessage());
                synchronized (REGISTRATION_LOCK) {
                    registrationInFlight = false;
                }
                PluginLogStore.append(
                    getContext(),
                    "plugin.stop",
                    "ERROR",
                    "failure=" + (e.getMessage() == null ? "unknown" : e.getMessage())
                );
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
        if (ActivityRecognitionDebug.isDebugEnabled(getContext())) {
            Log.v(
                TAG,
                "status enabled=" + status.getBool("enabled")
                    + " eventCount=" + status.getInteger("eventCount")
                    + " lastType=" + status.getString("lastType")
                    + " lastEventAt=" + status.optLong("lastEventAt", 0L)
            );
        }
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
            triggerRecover(getContext(), "status_stale");
        }
    }

    public static void triggerRecover(Context context, String reason) {
        long now = System.currentTimeMillis();
        if ((now - lastRecoverAttemptAt) < RECOVER_COOLDOWN_MS) {
            PluginLogStore.append(context, "plugin.recover", "INFO", "skip reason=cooldown request=" + reason);
            return;
        }
        lastRecoverAttemptAt = now;
        PluginLogStore.append(context, "plugin.recover", "INFO", "trigger reason=" + reason);
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
            return false;
        }
    }

    public static boolean emitGeofenceTransition(JSONObject data) {
        if (instance == null) return false;
        try {
            JSObject js = JSObject.fromJSONObject(data);
            instance.notifyListeners("geofenceTransition", js, true);
            return true;
        } catch (JSONException ignored) {
            return false;
        }
    }

    public static boolean emitTripSummary(JSONObject data) {
        if (instance == null) return false;
        try {
            JSObject js = JSObject.fromJSONObject(data);
            instance.notifyListeners("tripSummary", js, true);
            return true;
        } catch (JSONException ignored) {
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
        registerSubscriptions(context, client, pendingIntent, transitionPendingIntent, "recover", true, new RegistrationListener() {
            @Override
            public void onSkipped(String reason) {
                ActivityRecognitionDebug.markStarted(context);
                ActivityRecognitionDebug.clearError(context);
                ActivityRecognitionWatchdog.schedule(context, "recover_skip");
                PluginLogStore.append(context, "plugin.recover", "INFO", "skipped reason=" + reason);
            }

            @Override
            public void onSuccess(boolean updatesOk, boolean transitionsOk) {
                ActivityRecognitionDebug.markStarted(context);
                ActivityRecognitionDebug.clearError(context);
                ActivityRecognitionWatchdog.schedule(context, "recover");
                PluginLogStore.append(
                    context,
                    "plugin.recover",
                    "INFO",
                    "restored updatesOk=" + updatesOk + " transitionsOk=" + transitionsOk
                );
                ActivityRecognitionNotifier.debug(
                    context,
                    "recover: restored (updates=" + updatesOk + ", transitions=" + transitionsOk + ")"
                );
            }

            @Override
            public void onFailure(String message) {
                ActivityRecognitionDebug.markError(context, "recover_failed: " + message);
                PluginLogStore.append(context, "plugin.recover", "ERROR", "failed=" + message);
                ActivityRecognitionNotifier.debug(context, "recover_failed: " + message);
            }
        });
    }

    private static PendingIntent buildPendingIntent(Context context) {
        Intent intent = new Intent(context, ActivityRecognitionReceiver.class);
        intent.setAction("com.qipz.activityrecognition.ACTIVITY_UPDATE");
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? PendingIntent.FLAG_MUTABLE
                : PendingIntent.FLAG_IMMUTABLE);
        return PendingIntent.getBroadcast(context, PI_UPDATES_REQUEST_CODE, intent, flags);
    }

    private static PendingIntent buildTransitionPendingIntent(Context context) {
        Intent intent = new Intent(context, ActivityRecognitionReceiver.class);
        intent.setAction("com.qipz.activityrecognition.ACTIVITY_TRANSITION");
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? PendingIntent.FLAG_MUTABLE
                : PendingIntent.FLAG_IMMUTABLE);
        return PendingIntent.getBroadcast(context, PI_TRANSITIONS_REQUEST_CODE, intent, flags);
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
        ret.put("canNotify", !needsNotificationPermission());
        JSONArray missing = new JSONArray();
        if (!canStart) {
            if (getPermissionState("activityRecognition") != PermissionState.GRANTED) {
                missing.put("activityRecognition");
            }
            if (needsLocationPermission()) {
                missing.put("location");
            }
            if (needsBackgroundLocationPermission()) {
                missing.put("backgroundLocation");
            }
        }
        if (needsNotificationPermission()) {
            missing.put("notifications");
        }
        ret.put("missingPermissions", missing);
        ret.put("permissionError", permissionError == null ? "" : permissionError);
        return ret;
    }

    private JSObject statusObject() {
        JSObject ret = new JSObject();
        boolean hasActivity = getPermissionState("activityRecognition") == PermissionState.GRANTED;
        boolean hasLocation = !needsLocationPermission();
        boolean hasBackgroundLocation = !needsBackgroundLocationPermission();
        boolean canNotify = !needsNotificationPermission();

        ret.put("enabled", ActivityRecognitionDebug.isEnabled(getContext()));
        ret.put("lastType", ActivityRecognitionDebug.getLastType(getContext()));
        ret.put("lastConfidence", ActivityRecognitionDebug.getLastConfidence(getContext()));
        ret.put("lastEventAt", ActivityRecognitionDebug.getLastEventAt(getContext()));
        ret.put("lastStartAt", ActivityRecognitionDebug.getLastStartAt(getContext()));
        ret.put("lastStopAt", ActivityRecognitionDebug.getLastStopAt(getContext()));
        ret.put("lastError", ActivityRecognitionDebug.getLastError(getContext()));
        ret.put("lastDebugLabel", ActivityRecognitionDebug.getLastDebugLabel(getContext()));
        ret.put("eventCount", ActivityRecognitionDebug.getEventCount(getContext()));
        ret.put("canStart", hasActivity && hasLocation && hasBackgroundLocation);
        ret.put("canNotify", canNotify);
        ret.put("notificationsGranted", canNotify);
        JSONArray missing = new JSONArray();
        if (!hasActivity) {
            missing.put("activityRecognition");
        }
        if (!hasLocation) {
            missing.put("location");
        }
        if (!hasBackgroundLocation) {
            missing.put("backgroundLocation");
        }
        if (!canNotify) {
            missing.put("notifications");
        }
        ret.put("missingPermissions", missing);
        ret.put("permissionError", missing.length() > 0 ? "Missing required permissions" : "");
        ret.put("debugEnabled", ActivityRecognitionDebug.isDebugEnabled(getContext()));
        ret.put("activityNotificationsEnabled", ActivityRecognitionDebug.isActivityNotificationsEnabled(getContext()));
        ret.put("highReliabilityModeEnabled", ActivityRecognitionDebug.isHighReliabilityModeEnabled(getContext()));
        ret.put("accountKey", ActivityRecognitionDebug.getAccountKey(getContext()));
        ret.put("jsPassiveActive", ActivityRecognitionDebug.isJsPassiveActive(getContext()));
        ret.put("geofenceCount", ActivityRecognitionDebug.getGeofenceCount(getContext()));
        synchronized (REGISTRATION_LOCK) {
            ret.put("registrationActive", registrationActive);
            ret.put("registrationInFlight", registrationInFlight);
            ret.put("lastRegisterAttemptAt", lastRegisterAttemptAt);
        }
        ret.put("lastRecoverAttemptAt", lastRecoverAttemptAt);
        return ret;
    }
}
