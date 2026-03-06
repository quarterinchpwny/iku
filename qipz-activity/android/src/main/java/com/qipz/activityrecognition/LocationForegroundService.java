package com.qipz.activityrecognition;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.List;

public class LocationForegroundService extends Service {
    private static final String TAG = "QipzLocation";
    private static final String CHANNEL_ID = "qipz_location_channel";
    private static final int NOTIF_ID = 6100;

    private static final String ACTION_START           = "com.qipz.activityrecognition.location.START";
    private static final String ACTION_UPDATE_ACTIVITY = "com.qipz.activityrecognition.location.UPDATE_ACTIVITY";
    private static final String EXTRA_ACTIVITY_TYPE    = "activityType";

    private FusedLocationProviderClient fusedClient;
    private LocationCallback locationCallback;
    private Location lastRecordedLocation;
    private String currentActivityType = "UNKNOWN";
    private boolean locationUpdatesActive = false;
    private ActivitySyncQueueStore queueStore;
    private UploadManager uploadManager;

    // ── Static convenience starters ───────────────────────────────────────────

    public static void start(android.content.Context context) {
        Intent intent = new Intent(context, LocationForegroundService.class);
        intent.setAction(ACTION_START);
        ContextCompat.startForegroundService(context, intent);
    }

    public static void stop(android.content.Context context) {
        context.stopService(new Intent(context, LocationForegroundService.class));
    }

    public static void onActivityChanged(android.content.Context context, String activityType) {
        if (!ActivityRecognitionDebug.isEnabled(context)) {
            return;
        }
        String next = activityType == null ? "UNKNOWN" : activityType;
        if (!shouldRunForegroundForActivity(context, next)) {
            stop(context);
            return;
        }
        Intent intent = new Intent(context, LocationForegroundService.class);
        intent.setAction(ACTION_UPDATE_ACTIVITY);
        intent.putExtra(EXTRA_ACTIVITY_TYPE, next);
        ContextCompat.startForegroundService(context, intent);
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        fusedClient     = LocationServices.getFusedLocationProviderClient(this);
        queueStore      = new ActivitySyncQueueStore(this);
        uploadManager   = new UploadManager(this);
        currentActivityType = ActivityRecognitionDebug.getLastType(this);
        createNotificationChannel();
        buildLocationCallback();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();

        if (ACTION_UPDATE_ACTIVITY.equals(action) || ACTION_START.equals(action) || action == null) {
            String activityType = intent == null ? null : intent.getStringExtra(EXTRA_ACTIVITY_TYPE);
            String next = activityType == null ? ActivityRecognitionDebug.getLastType(this) : activityType;
            if (next == null || next.isEmpty()) next = "UNKNOWN";
            if (!shouldRunForegroundForActivity(this, next)) {
                stopLocationUpdates();
                stopForeground(true);
                stopSelf(startId);
                return START_NOT_STICKY;
            }
            boolean forceApply = !ACTION_UPDATE_ACTIVITY.equals(action);
            startForeground(NOTIF_ID, buildNotification("Tracking location (" + next + ")"));
            updateTrackingForActivity(next, forceApply);
            return START_STICKY;
        }
        stopSelf(startId);
        return START_NOT_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ── Location callback ─────────────────────────────────────────────────────

    private void buildLocationCallback() {
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                if (result == null) return;
                Location location = result.getLastLocation();
                if (location == null) return;

                // 1. Accuracy filter — drop noisy / indoor fixes
                if (location.hasAccuracy() && location.getAccuracy() > QipzConfig.MAX_ACCURACY_METERS) {
                    Log.v(TAG, "dropped_low_accuracy acc=" + location.getAccuracy());
                    return;
                }

                // 2. Speed filter — suppress GPS drift when the car is stationary
                if ("DRIVING".equals(currentActivityType)
                        && location.hasSpeed()
                        && location.getSpeed() < QipzConfig.MIN_DRIVING_SPEED_MPS) {
                    Log.v(TAG, "dropped_zero_speed_driving speed=" + location.getSpeed());
                    return;
                }

                // 3. Displacement filter — avoid duplicate points
                if (!meetsDisplacementThreshold(location)) return;

                lastRecordedLocation = location;
                ActivityRecognitionDebug.setLastForegroundLocation(
                    LocationForegroundService.this,
                    location.getLatitude(),
                    location.getLongitude(),
                    location.getAccuracy(),
                    System.currentTimeMillis()
                );
                enqueueLocation(location);
                uploadManager.scheduleUpload();
                List<ActivityGeofenceEngine.GeofenceTransition> transitions = ActivityGeofenceEngine.evaluate(
                    LocationForegroundService.this,
                    location.getLatitude(),
                    location.getLongitude(),
                    System.currentTimeMillis()
                );
                for (ActivityGeofenceEngine.GeofenceTransition transition : transitions) {
                    ActivityRecognitionNotifier.geofenceTransition(
                        LocationForegroundService.this,
                        transition.id,
                        transition.contentText()
                    );
                    ActivityRecognitionPlugin.emitGeofenceTransition(transition.toJson());
                }
            }
        };
    }

    // ── Location request builders ─────────────────────────────────────────────

    private void requestLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)   != PackageManager.PERMISSION_GRANTED
         && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityRecognitionDebug.markError(this, "LocationForegroundService: missing location permission");
            locationUpdatesActive = false;
            updateForegroundNotification("Missing location permission");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityRecognitionDebug.markError(this, "LocationForegroundService: missing background location permission");
            locationUpdatesActive = false;
            updateForegroundNotification("Missing background location permission");
            return;
        }

        LocationRequest request = buildRequestForActivity(currentActivityType);
        fusedClient.removeLocationUpdates(locationCallback);
        fusedClient.requestLocationUpdates(request, locationCallback, getMainLooper())
            .addOnSuccessListener(v -> {
                locationUpdatesActive = true;
                updateForegroundNotification("Tracking location (" + currentActivityType + ")");
                Log.i(TAG, "location_updates_started activity=" + currentActivityType);
            })
            .addOnFailureListener(e -> {
                locationUpdatesActive = false;
                ActivityRecognitionDebug.markError(this, "LocationForegroundService request failed");
                updateForegroundNotification("Location request failed");
                Log.e(TAG, "request_updates_failed", e);
            });
    }

    private LocationRequest buildRequestForActivity(String activityType) {
        String type = activityType == null ? "UNKNOWN" : activityType;
        switch (type) {
            case "DRIVING":
                return new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, QipzConfig.DRIVING_INTERVAL_MS)
                    .setMinUpdateIntervalMillis(QipzConfig.DRIVING_MIN_INTERVAL_MS)
                    .setMinUpdateDistanceMeters(QipzConfig.DRIVING_MIN_DISTANCE_M)
                    .build();
            case "RUNNING":
                return new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, QipzConfig.RUNNING_INTERVAL_MS)
                    .setMinUpdateIntervalMillis(QipzConfig.RUNNING_MIN_INTERVAL_MS)
                    .setMinUpdateDistanceMeters(QipzConfig.RUNNING_MIN_DISTANCE_M)
                    .build();
            case "WALKING":
                return new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, QipzConfig.WALKING_INTERVAL_MS)
                    .setMinUpdateIntervalMillis(QipzConfig.WALKING_MIN_INTERVAL_MS)
                    .setMinUpdateDistanceMeters(QipzConfig.WALKING_MIN_DISTANCE_M)
                    .build();
            case "STILL":
                // PRIORITY_PASSIVE: the OS only delivers a fix when the device moves ≥ 50 m
                // (i.e. another app has already paid for the GPS wake). Zero active battery drain.
                return new LocationRequest.Builder(Priority.PRIORITY_PASSIVE, QipzConfig.STILL_INTERVAL_MS)
                    .setMinUpdateIntervalMillis(QipzConfig.STILL_MIN_INTERVAL_MS)
                    .setMinUpdateDistanceMeters(QipzConfig.STILL_MIN_DISTANCE_M)
                    .build();
            default:
                return new LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, QipzConfig.UNKNOWN_INTERVAL_MS)
                    .setMinUpdateIntervalMillis(QipzConfig.UNKNOWN_MIN_INTERVAL_MS)
                    .setMinUpdateDistanceMeters(QipzConfig.UNKNOWN_MIN_DISTANCE_M)
                    .build();
        }
    }

    // ── Activity-driven tracking control ─────────────────────────────────────

    private void updateTrackingForActivity(String activityType, boolean forceApply) {
        String next = activityType == null ? "UNKNOWN" : activityType;

        // Trip ID management: new trip when transitioning from STILL → moving
        boolean wasStill   = "STILL".equals(currentActivityType);
        boolean nowMoving  = isMovingType(next);
        boolean nowStill   = "STILL".equals(next);

        if (wasStill && nowMoving) {
            // Start a new trip segment
            lastRecordedLocation = null; // reset displacement baseline so first fixes after STILL are always logged
            String tripId = ActivityRecognitionDebug.getOrCreateTripId(this);
            Log.i(TAG, "trip_started id=" + tripId + " activity=" + next);
        } else if (nowStill) {
            // End the current trip
            String tripId = ActivityRecognitionDebug.getCurrentTripId(this);
            if (!tripId.isEmpty()) {
                Log.i(TAG, "trip_ended id=" + tripId);
            }
            ActivityRecognitionDebug.clearTripId(this);
        }

        if (!forceApply && next.equals(currentActivityType)) {
            if (shouldTrackForActivity(next) && !locationUpdatesActive) {
                requestLocationUpdates();
            }
            return;
        }
        lastRecordedLocation = null; // reset displacement baseline on every activity change
        currentActivityType = next;

        if (shouldTrackForActivity(next)) {
            requestLocationUpdates();
            Log.i(TAG, "tracking_enabled activity=" + next);
            return;
        }

        // STILL still gets a passive request so we wake on significant movement
        if ("STILL".equals(next)) {
            requestLocationUpdates();
            Log.i(TAG, "tracking_passive activity=STILL");
            return;
        }

        stopLocationUpdates();
        updateForegroundNotification("Waiting for movement (" + next + ")");
        Log.i(TAG, "tracking_paused activity=" + next);
    }

    private boolean shouldTrackForActivity(String activityType) {
        return "DRIVING".equals(activityType)
            || "RUNNING".equals(activityType)
            || "WALKING".equals(activityType);
    }

    private boolean isMovingType(String activityType) {
        return "DRIVING".equals(activityType)
            || "RUNNING".equals(activityType)
            || "WALKING".equals(activityType);
    }

    private static boolean isForegroundActivityType(String activityType) {
        return "DRIVING".equals(activityType)
            || "RUNNING".equals(activityType)
            || "WALKING".equals(activityType);
    }

    private static boolean shouldRunForegroundForActivity(android.content.Context context, String activityType) {
        if (isForegroundActivityType(activityType)) {
            return true;
        }
        if (ActivityRecognitionDebug.isJsPassiveActive(context)) {
            return true;
        }
        if (!ActivityRecognitionDebug.isHighReliabilityModeEnabled(context)) {
            return false;
        }
        return "STILL".equals(activityType) || "UNKNOWN".equals(activityType);
    }

    private void stopLocationUpdates() {
        fusedClient.removeLocationUpdates(locationCallback);
        locationUpdatesActive = false;
    }

    // ── Notification helpers ──────────────────────────────────────────────────

    private void updateForegroundNotification(String text) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        manager.notify(NOTIF_ID, buildNotification(text));
    }

    // ── Location quality ──────────────────────────────────────────────────────

    private boolean meetsDisplacementThreshold(Location location) {
        if (lastRecordedLocation == null) return true;
        return lastRecordedLocation.distanceTo(location) >= QipzConfig.MIN_DISPLACEMENT_METERS;
    }

    // ── Queue ─────────────────────────────────────────────────────────────────

    /**
     * Builds a single-point passive_locations payload and appends it to the
     * SQLite queue. The payload wraps one sample inside a {@code changes} array
     * so the upload worker can batch multiple items into one HTTP POST without
     * any restructuring.
     */
    private void enqueueLocation(Location location) {
        try {
            long now      = System.currentTimeMillis();
            String deviceId = getHashedDeviceId();
            String lat    = String.format(Locale.US, "%.6f", location.getLatitude());
            String lng    = String.format(Locale.US, "%.6f", location.getLongitude());
            String sampleHash = sha256Hex(deviceId + "|" + now + "|" + lat + "|" + lng);

            // Active trip ID — empty string when the device is STILL
            String tripId = ActivityRecognitionDebug.getCurrentTripId(this);

            JSONObject sample = new JSONObject();
            sample.put("_type",       "location");
            sample.put("lat",         Double.parseDouble(lat));
            sample.put("lng",         Double.parseDouble(lng));
            sample.put("timestamp",   now);
            sample.put("tst",         now / 1000L);
            sample.put("acc",         Math.round(location.getAccuracy()));
            sample.put("trigger",     "t");
            sample.put("reason",      "continuous");
            sample.put("activityType", currentActivityType);
            sample.put("deviceId",    deviceId);
            sample.put("sampleHash",  sampleHash);

            if (!tripId.isEmpty()) sample.put("tripId", tripId);

            String accountKey = ActivityRecognitionDebug.getAccountKey(this);
            if (!accountKey.isEmpty()) sample.put("accountKey", accountKey);
            if (location.hasSpeed())    sample.put("vel", Math.round(location.getSpeed()));
            if (location.hasBearing())  sample.put("cog", Math.round(location.getBearing()));
            if (location.hasAltitude()) sample.put("alt", Math.round(location.getAltitude()));
            sample.put("provider", location.getProvider() == null ? "" : location.getProvider());

            // Each queue item is already in the exact shape the backend /sync
            // endpoint expects: { table, changes: [ sample ] }.
            // The upload worker unwraps and re-batches multiple items into one
            // POST, so the backend sees { table, changes: [ s1, s2, ... ] }.
            JSONObject payload = new JSONObject();
            payload.put("table",   "passive_locations");
            payload.put("changes", new JSONArray().put(sample));

            queueStore.enqueue(payload.toString(), "continuous", now, now + QipzConfig.LOCATION_ITEM_TTL_MS);
            updateForegroundAfterEnqueue(now);
            PluginLogStore.append(
                this,
                "location.foreground",
                "INFO",
                "enqueued activity=" + currentActivityType + " ts=" + now
            );
            Log.i(TAG, "enqueued activity=" + currentActivityType
                + " lat=" + lat + " lng=" + lng
                + " trip=" + (tripId.isEmpty() ? "none" : tripId));
        } catch (Exception e) {
            Log.e(TAG, "enqueue_failed", e);
            ActivityRecognitionDebug.markError(this, "LocationForegroundService enqueue failed");
            PluginLogStore.append(
                this,
                "location.foreground",
                "ERROR",
                "enqueue_failed type=" + e.getClass().getSimpleName()
            );
            updateForegroundNotification("Queue write failed");
        }
    }

    private void updateForegroundAfterEnqueue(long timestampMs) {
        int pending = 0;
        try { pending = queueStore.countPending(); } catch (Exception ignored) {}
        String time = new SimpleDateFormat("HH:mm:ss", Locale.US).format(new Date(timestampMs));
        updateForegroundNotification("Queued " + time + " | pending " + pending);
    }

    // ── Device ID ─────────────────────────────────────────────────────────────

    private String getHashedDeviceId() {
        try {
            String raw = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
            if (raw == null || raw.isEmpty()) raw = "unknown";
            return sha256Hex(raw + getPackageName());
        } catch (Exception e) {
            return "unknown";
        }
    }

    private String sha256Hex(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format(Locale.US, "%02x", b));
        return sb.toString();
    }

    // ── Service cleanup ───────────────────────────────────────────────────────

    @Override
    public void onDestroy() {
        stopLocationUpdates();
        stopForeground(true);
        super.onDestroy();
    }

    // ── Notification channel ──────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "QIPZ Location",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Continuous background location tracking");
        manager.createNotificationChannel(channel);
    }

    private Notification buildNotification(String text) {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Location active")
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build();
    }
}
