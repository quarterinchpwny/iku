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
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
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
    private final PassiveLocationDriftGuard driftGuard = new PassiveLocationDriftGuard();
    private final StayPointDetector stayDetector = new StayPointDetector();
    private TripStatisticsStore.TripBuilder activeTripBuilder = null;
    private final Handler stillTickerHandler = new Handler(Looper.getMainLooper());
    private final Runnable stillTicker = new Runnable() {
        @Override
        public void run() {
            runStillTicker();
        }
    };


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


    @Override
    public void onCreate() {
        super.onCreate();
        fusedClient     = LocationServices.getFusedLocationProviderClient(this);
        queueStore      = new ActivitySyncQueueStore(this);
        uploadManager   = new UploadManager(this);
        currentActivityType = ActivityRecognitionDebug.getLastType(this);
        driftGuard.resetFull();
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


    private void buildLocationCallback() {
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                if (result == null) return;
                Location location = result.getLastLocation();
                if (location == null) return;

                if (location.hasAccuracy() && location.getAccuracy() > QipzConfig.MAX_ACCURACY_METERS) {
                    Log.v(TAG, "dropped_low_accuracy acc=" + location.getAccuracy());
                    return;
                }

                if ("DRIVING".equals(currentActivityType)
                        && location.hasSpeed()
                        && location.getSpeed() < QipzConfig.MIN_DRIVING_SPEED_MPS) {
                    Log.v(TAG, "dropped_zero_speed_driving speed=" + location.getSpeed());
                    return;
                }

                if (shouldSuppressStillDrift(location)) return;

                if (isMovingType(currentActivityType)) {
                    if (!meetsDisplacementThreshold(location)) return;
                    handleAcceptedLocation(location);
                    return;
                }

                if (!driftGuard.hasPendingSpike() && !meetsDisplacementThreshold(location)) return;
                Location[] accepted = driftGuard.evaluate(lastRecordedLocation, location, currentActivityType);
                if (accepted.length == 0) {
                    Log.v(TAG, "dropped_cluster_drift activity=" + currentActivityType);
                    return;
                }

                for (Location acceptedLocation : accepted) {
                    if (acceptedLocation == null) continue;
                    handleAcceptedLocation(acceptedLocation);
                }
            }
        };
    }


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
            case "CYCLING":
                return new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5_000L)
                    .setMinUpdateIntervalMillis(3_000L)
                    .setMinUpdateDistanceMeters(5f)
                    .build();
            case "STILL":
                if (ActivityRecognitionDebug.isHighReliabilityModeEnabled(this)) {
                    return new LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, QipzConfig.STILL_INTERVAL_MS)
                        .setMinUpdateIntervalMillis(QipzConfig.STILL_MIN_INTERVAL_MS)
                        .setMinUpdateDistanceMeters(QipzConfig.STILL_MIN_DISTANCE_M)
                        .build();
                }
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


    private void updateTrackingForActivity(String activityType, boolean forceApply) {
        String next = activityType == null ? "UNKNOWN" : activityType;
        String previousType = currentActivityType;
        onActivityChangedInternal(previousType, next);
        boolean idleType = "STILL".equals(next) || "UNKNOWN".equals(next);

        boolean wasStill   = "STILL".equals(currentActivityType);
        boolean nowMoving  = isMovingType(next);
        boolean nowStill   = "STILL".equals(next);

        if (wasStill && nowMoving) {
            lastRecordedLocation = null; // reset displacement baseline so first fixes after STILL are always logged
            driftGuard.resetPending();
            String tripId = ActivityRecognitionDebug.getOrCreateTripId(this);
            Log.i(TAG, "trip_started id=" + tripId + " activity=" + next);
        } else if (nowStill) {
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
            if (idleType) {
                startStillTicker();
            } else {
                stopStillTicker();
            }
            return;
        }
        lastRecordedLocation = null; // reset displacement baseline on every activity change
        driftGuard.resetPending();
        currentActivityType = next;

        if (shouldTrackForActivity(next)) {
            stopStillTicker();
            requestLocationUpdates();
            Log.i(TAG, "tracking_enabled activity=" + next);
            return;
        }

        if (idleType) {
            requestLocationUpdates();
            startStillTicker();
            Log.i(TAG, "tracking_passive activity=" + next);
            return;
        }

        stopStillTicker();
        stopLocationUpdates();
        updateForegroundNotification("Waiting for movement (" + next + ")");
        Log.i(TAG, "tracking_paused activity=" + next);
    }

    private void startStillTicker() {
        stillTickerHandler.removeCallbacks(stillTicker);
        // FIX: Use postDelayed instead of post. Using post() fired the ticker immediately
        // on every STILL activity event (which can fire every few seconds), causing constant
        // still_ticker_skip_recent log spam and unnecessary work. With postDelayed the ticker
        // schedules itself once and self-reschedules at the end of each run — activity events
        // that arrive mid-interval are ignored without resetting the schedule.
        long lastStillSyncAt = ActivityRecognitionDebug.getLastStillSyncAt(this);
        long now = System.currentTimeMillis();
        long elapsed = now - lastStillSyncAt;
        long delay = elapsed >= QipzConfig.STILL_SYNC_INTERVAL
            ? 0L
            : QipzConfig.STILL_SYNC_INTERVAL - elapsed;
        stillTickerHandler.postDelayed(stillTicker, delay);
    }

    private void stopStillTicker() {
        stillTickerHandler.removeCallbacks(stillTicker);
    }

    private void runStillTicker() {
        if (!"STILL".equals(currentActivityType) && !"UNKNOWN".equals(currentActivityType)) {
            stopStillTicker();
            return;
        }

        long now = System.currentTimeMillis();
        long lastStillSyncAt = ActivityRecognitionDebug.getLastStillSyncAt(this);
        if (now - lastStillSyncAt < QipzConfig.STILL_SYNC_INTERVAL) {
            PluginLogStore.append(
                this,
                "location.foreground",
                "DEBUG",
                "still_ticker_skip_recent ts=" + now + " lastStillSyncAt=" + lastStillSyncAt
            );
            stillTickerHandler.postDelayed(stillTicker, QipzConfig.STILL_SYNC_INTERVAL);
            return;
        }

        ActivityRecognitionDebug.LocationSnapshot cachedLocation =
            ActivityRecognitionDebug.getLastForegroundLocation(this);
        if (cachedLocation == null) {
            PluginLogStore.append(
                this,
                "location.foreground",
                "WARN",
                "still_ticker_skip_no_cache ts=" + now
            );
            stillTickerHandler.postDelayed(stillTicker, QipzConfig.STILL_SYNC_INTERVAL);
            return;
        }

        int confidence = Math.max(50, ActivityRecognitionDebug.getLastConfidence(this));
        PluginLogStore.append(
            this,
            "location.foreground",
            "INFO",
            "still_ticker_fire ts=" + now + " lastStillSyncAt=" + lastStillSyncAt
        );
        ActivityLocationSyncService.startForActivity(this, "STILL", confidence);
        stillTickerHandler.postDelayed(stillTicker, QipzConfig.STILL_SYNC_INTERVAL);
    }

    private boolean shouldTrackForActivity(String activityType) {
        return "DRIVING".equals(activityType)
            || "RUNNING".equals(activityType)
            || "WALKING".equals(activityType)
            || "CYCLING".equals(activityType);
    }

    private boolean isMovingType(String activityType) {
        return "DRIVING".equals(activityType)
            || "RUNNING".equals(activityType)
            || "WALKING".equals(activityType)
            || "CYCLING".equals(activityType);
    }

    private static boolean isForegroundActivityType(String activityType) {
        return "DRIVING".equals(activityType)
            || "RUNNING".equals(activityType)
            || "WALKING".equals(activityType)
            || "CYCLING".equals(activityType);
    }

    private static boolean shouldRunForegroundForActivity(android.content.Context context, String activityType) {
        if (isForegroundActivityType(activityType)) {
            return true;
        }
        if (ActivityRecognitionDebug.isJsPassiveActive(context)) {
            return true;
        }
        if (ActivityRecognitionDebug.isEnabled(context)
            && ("STILL".equals(activityType) || "UNKNOWN".equals(activityType))) {
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


    private void updateForegroundNotification(String text) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        manager.notify(NOTIF_ID, buildNotification(text));
    }


    private boolean meetsDisplacementThreshold(Location location) {
        if (lastRecordedLocation == null) return true;
        float minDistance = "STILL".equals(currentActivityType)
            ? QipzConfig.MIN_STILL_DISPLACEMENT_METERS
            : QipzConfig.MIN_DISPLACEMENT_METERS;
        return lastRecordedLocation.distanceTo(location) >= minDistance;
    }

    private boolean shouldSuppressStillDrift(Location location) {
        if (!"STILL".equals(currentActivityType)) return false;
        if (location.hasAccuracy() && location.getAccuracy() > QipzConfig.MAX_STILL_ACCURACY_METERS) {
            Log.v(TAG, "dropped_still_low_accuracy acc=" + location.getAccuracy());
            return true;
        }
        if (lastRecordedLocation == null) return false;
        float distance = lastRecordedLocation.distanceTo(location);
        if (distance >= QipzConfig.MIN_STILL_DISPLACEMENT_METERS) return false;
        if (!location.hasSpeed()) {
            Log.v(TAG, "dropped_still_drift dist=" + distance + " speed=unknown");
            return true;
        }
        if (location.getSpeed() < QipzConfig.MIN_STILL_SPEED_MPS) {
            Log.v(TAG, "dropped_still_drift dist=" + distance + " speed=" + location.getSpeed());
            return true;
        }
        return false;
    }

    private void handleAcceptedLocation(Location location) {
        Location previousLocation = lastRecordedLocation;
        lastRecordedLocation = new Location(location);
        long snapshotTimestamp = location.getTime() > 0L ? location.getTime() : System.currentTimeMillis();
        ActivityRecognitionDebug.setLastForegroundLocation(
            LocationForegroundService.this,
            location.getLatitude(),
            location.getLongitude(),
            location.getAccuracy(),
            snapshotTimestamp
        );
        maybeRecoverFromStaleActivity(location, previousLocation);
        feedTrackingEngines(location);
        enqueueLocation(location);
        if (isMovingType(currentActivityType)) {
            ActivityLocationSyncService.startForActivity(
                this, currentActivityType,
                ActivityRecognitionDebug.getLastConfidence(this));
        } else {
            uploadManager.scheduleUpload();
        }
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

    private void onActivityChangedInternal(String previousType, String nextType) {
        long nowMs = System.currentTimeMillis();

        boolean wasStill = "STILL".equals(previousType);
        boolean nowMoving = isMovingType(nextType);
        boolean wasMoving = isMovingType(previousType);
        boolean nowStill = "STILL".equals(nextType);

        if (wasStill && nowMoving) {
            StayPointDetector.StayVisit visit = stayDetector.onActivityLeft(nowMs);
            if (visit != null) {
                persistStayVisit(visit);
            }
            String tripId = ActivityRecognitionDebug.getCurrentTripId(this);
            long start = ActivityRecognitionDebug.getTripStartAt(this);
            if (!tripId.isEmpty() && activeTripBuilder == null) {
                activeTripBuilder = new TripStatisticsStore.TripBuilder(
                    tripId,
                    start > 0 ? start : nowMs
                );
            }
        }

        if (wasMoving && nowStill) {
            if (activeTripBuilder != null) {
                queueStore.insertTripStats(activeTripBuilder, nowMs);
                activeTripBuilder = null;
            }
            stayDetector.resetFull();
        }
    }

    private void feedTrackingEngines(Location location) {
        if ("STILL".equals(currentActivityType)) {
            StayPointDetector.StayVisit visit = stayDetector.onLocationWhileStill(location);
            if (visit != null) {
                persistStayVisit(visit);
            }
        } else if (isMovingType(currentActivityType)) {
            if (activeTripBuilder != null) {
                activeTripBuilder.onLocation(location, currentActivityType);
            }
        }
    }

    private void persistStayVisit(StayPointDetector.StayVisit visit) {
        if (visit == null) return;
        try {
            long id = queueStore.insertPlaceVisit(visit);
            PluginLogStore.append(
                this,
                "location.foreground",
                "INFO",
                "stay_visit id=" + id
                    + " durationMs=" + visit.durationMs()
                    + " lat=" + String.format(Locale.US, "%.5f", visit.lat)
                    + " lng=" + String.format(Locale.US, "%.5f", visit.lng)
            );
        } catch (Exception e) {
            PluginLogStore.append(
                this,
                "location.foreground",
                "ERROR",
                "stay_visit_persist_failed " + e.getClass().getSimpleName()
            );
        }
    }

    private void maybeRecoverFromStaleActivity(Location location, Location previousLocation) {
        if (!ActivityRecognitionDebug.isEnabled(this)) return;
        if (!"STILL".equals(currentActivityType) && !"UNKNOWN".equals(currentActivityType)) return;
        long now = System.currentTimeMillis();
        long lastEventAt = ActivityRecognitionDebug.getLastEventAt(this);
        long lastStartAt = ActivityRecognitionDebug.getLastStartAt(this);
        long lastAt = lastEventAt > 0 ? lastEventAt : lastStartAt;
        if (lastAt <= 0) return;
        if (now - lastAt < QipzConfig.ACTIVITY_STALE_RECOVER_MS) return;
        long lastRecoverAt = ActivityRecognitionDebug.getLastMovementRecoverAt(this);
        if (now - lastRecoverAt < QipzConfig.ACTIVITY_MOVEMENT_RECOVER_COOLDOWN_MS) return;
        if (previousLocation == null) return;
        float distance = previousLocation.distanceTo(location);
        if (distance < QipzConfig.ACTIVITY_STALE_RECOVER_DISTANCE_METERS) return;
        ActivityRecognitionDebug.setLastMovementRecoverAt(this, now);
        emitFallbackMovement(location, previousLocation, distance, now);
        PluginLogStore.append(
            this,
            "activity.recover",
            "WARN",
            "movement_without_activity distance=" + Math.round(distance)
                + " lastEventAt=" + lastAt
                + " now=" + now
        );
        ActivityRecognitionPlugin.triggerRecover(this, "movement_without_activity");
    }

    private void emitFallbackMovement(Location location, Location previousLocation, float distance, long now) {
        try {
            float speed = resolveFallbackSpeed(location, previousLocation, distance);
            String type = speed >= QipzConfig.FALLBACK_DRIVING_SPEED_MPS ? "DRIVING" : "WALKING";
            int confidence = "DRIVING".equals(type) ? 70 : 55;
            String debugLabel = "fallback distance=" + Math.round(distance) + " speed=" + Math.round(speed * 10f) / 10f;
            JSONObject data = new JSONObject();
            data.put("type", type);
            data.put("confidence", confidence);
            data.put("debugLabel", debugLabel);
            boolean delivered = ActivityRecognitionPlugin.emitActivityChange(data);
            ActivityRecognitionDebug.touchLastEventAt(this);
            ActivityRecognitionDebug.markDebugLabel(this, debugLabel);
            PluginLogStore.append(
                this,
                "activity.receiver",
                "WARN",
                "fallback type=" + type
                    + " confidence=" + confidence
                    + " deliveredToJs=" + delivered
                    + " distance=" + Math.round(distance)
                    + " speed=" + Math.round(speed * 10f) / 10f
            );
            ActivityLocationSyncService.startForActivity(this, type, confidence);
        } catch (Exception e) {
            PluginLogStore.append(
                this,
                "activity.receiver",
                "ERROR",
                "fallback_failed type=" + e.getClass().getSimpleName()
            );
        }
    }

    private float resolveFallbackSpeed(Location location, Location previousLocation, float distance) {
        if (location.hasSpeed()) return location.getSpeed();
        long prevTime = previousLocation.getTime();
        long nextTime = location.getTime();
        if (prevTime > 0L && nextTime > prevTime) {
            float seconds = (nextTime - prevTime) / 1000f;
            if (seconds > 0f) return distance / seconds;
        }
        return 0f;
    }


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
            long fixTime  = location.getTime() > 0L ? location.getTime() : now;
            String sampleHash = sha256Hex(deviceId + "|" + fixTime + "|" + lat + "|" + lng);

            String tripId = ActivityRecognitionDebug.getCurrentTripId(this);

            JSONObject sample = new JSONObject();
            sample.put("_type",       "location");
            sample.put("lat",         Double.parseDouble(lat));
            sample.put("lng",         Double.parseDouble(lng));
            sample.put("timestamp",   fixTime);
            sample.put("tst",         fixTime / 1000L);
            sample.put("acc",         Math.round(location.getAccuracy()));
            sample.put("trigger",     "t");
            sample.put("reason",      "continuous");
            sample.put("activityType", currentActivityType);
            sample.put("activityConfidence", ActivityRecognitionDebug.getLastConfidence(this));
            sample.put("deviceId",    deviceId);
            sample.put("payloadVersion", QipzConfig.PASSIVE_PAYLOAD_VERSION);
            sample.put("sampleHash",  sampleHash);

            if (!tripId.isEmpty()) sample.put("tripId", tripId);

            String accountKey = ActivityRecognitionDebug.getAccountKey(this);
            if (!accountKey.isEmpty()) sample.put("accountKey", accountKey);
            if (location.hasSpeed())    sample.put("vel", Math.round(location.getSpeed()));
            if (location.hasBearing())  sample.put("cog", Math.round(location.getBearing()));
            if (location.hasAltitude()) sample.put("alt", Math.round(location.getAltitude()));
            sample.put("provider", location.getProvider() == null ? "" : location.getProvider());

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


    @Override
    public void onDestroy() {
        flushOpenSessions();
        stopStillTicker();
        stopLocationUpdates();
        stopForeground(true);
        driftGuard.resetFull();
        super.onDestroy();
    }

    private void flushOpenSessions() {
        long nowMs = System.currentTimeMillis();
        if (activeTripBuilder != null) {
            queueStore.insertTripStats(activeTripBuilder, nowMs);
            activeTripBuilder = null;
        }
        StayPointDetector.StayVisit openStay = stayDetector.onActivityLeft(nowMs);
        if (openStay != null) {
            persistStayVisit(openStay);
        }
    }


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