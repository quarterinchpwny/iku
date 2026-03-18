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
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.CancellationTokenSource;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;

public class ActivityLocationSyncService extends Service {
    private static final String TAG = "QipzActivitySync";
    private static final String CHANNEL_ID = "qipz_activity_sync_channel";
    private static final int NOTIFICATION_ID = 5209;
    private static final int RESULT_NOTIF_ID = 5210;

    public static final String ACTION_ACTIVITY_SYNC = "com.qipz.activityrecognition.ACTION_ACTIVITY_SYNC";
    public static final String EXTRA_ACTIVITY_TYPE = "extra_activity_type";
    public static final String EXTRA_ACTIVITY_CONFIDENCE = "extra_activity_confidence";

    private ActivitySyncQueueStore queueStore;
    private UploadManager uploadManager;

    public static void startForActivity(android.content.Context context, String type, int confidence) {
        Intent intent = new Intent(context, ActivityLocationSyncService.class);
        intent.setAction(ACTION_ACTIVITY_SYNC);
        intent.putExtra(EXTRA_ACTIVITY_TYPE, type == null ? "UNKNOWN" : type);
        intent.putExtra(EXTRA_ACTIVITY_CONFIDENCE, confidence);
        ContextCompat.startForegroundService(context, intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        queueStore = new ActivitySyncQueueStore(this);
        uploadManager = new UploadManager(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildForegroundNotification("Saving location"));

        String action = intent != null ? intent.getAction() : null;
        String type = intent != null ? intent.getStringExtra(EXTRA_ACTIVITY_TYPE) : "UNKNOWN";
        int confidence = intent != null ? intent.getIntExtra(EXTRA_ACTIVITY_CONFIDENCE, 0) : 0;

        if (ACTION_ACTIVITY_SYNC.equals(action)) {
            fetchLocationEnqueueAndUpload(type, confidence);
        } else {
            processQueueAndStop();
        }
        return START_NOT_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void fetchLocationEnqueueAndUpload(String activityType, int confidence) {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
            && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityRecognitionDebug.markError(this, "Activity sync skipped: location permission missing");
            ActivityRecognitionNotifier.debug(this, "sync skipped: missing location permission");
            processQueueAndStop();
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityRecognitionDebug.markError(this, "Activity sync skipped: background location permission missing");
            ActivityRecognitionNotifier.debug(this, "sync skipped: missing background location permission");
            processQueueAndStop();
            return;
        }

        // FIX: Add age check before using the foreground snapshot.
        // Previously the snapshot was used unconditionally, which created a deadlock:
        // if the snapshot's accuracy exceeded MAX_STILL_ACCURACY_METERS, the sample
        // was dropped and setLastForegroundLocation was never called, so the stale
        // snapshot was reused forever and every subsequent STILL fix was also dropped.
        ActivityRecognitionDebug.LocationSnapshot foregroundLocation =
            ActivityRecognitionDebug.getLastForegroundLocation(this);
        if (foregroundLocation != null) {
            long age = System.currentTimeMillis() - foregroundLocation.timestamp;
            if (age > QipzConfig.FOREGROUND_SNAPSHOT_MAX_AGE_MS) {
                // Snapshot is stale — force a fresh location fix instead of recycling it
                PluginLogStore.append(
                    this,
                    "upload.activity",
                    "DEBUG",
                    "foreground_snapshot_stale age_ms=" + age + " forcing_fresh_fix"
                );
                foregroundLocation = null;
            }
        }
        if (foregroundLocation != null) {
            Location location = new Location("foreground-cache");
            location.setLatitude(foregroundLocation.lat);
            location.setLongitude(foregroundLocation.lng);
            if (foregroundLocation.accuracy > 0f) {
                location.setAccuracy(foregroundLocation.accuracy);
            }
            location.setTime(foregroundLocation.timestamp);
            enqueueAndProcess(location, activityType, confidence);
            return;
        }

        FusedLocationProviderClient fusedClient = LocationServices.getFusedLocationProviderClient(this);
        fusedClient
            .getLastLocation()
            .addOnSuccessListener(location -> enqueueAndProcess(location, activityType, confidence))
            .addOnFailureListener(e -> {
                CancellationTokenSource tokenSource = new CancellationTokenSource();
                fusedClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, tokenSource.getToken())
                    .addOnSuccessListener(location -> enqueueAndProcess(location, activityType, confidence))
                    .addOnFailureListener(err -> {
                        Log.e(TAG, "location_fetch_failed", err);
                        ActivityRecognitionDebug.markError(
                            this,
                            "Activity sync location fetch failed: " + (err == null ? "unknown" : err.getMessage())
                        );
                        processQueueAndStop();
                    });
            });
    }

    private void enqueueAndProcess(Location location, String activityType, int confidence) {
        long now = System.currentTimeMillis();
        if (location == null) {
            ActivityRecognitionDebug.LocationSnapshot fallback =
                ActivityRecognitionDebug.getLastForegroundLocation(this);
            if (fallback != null) {
                long age = fallback.timestamp <= 0L ? Long.MAX_VALUE : now - fallback.timestamp;
                if (age > QipzConfig.FOREGROUND_SNAPSHOT_MAX_AGE_MS) {
                    ActivityRecognitionDebug.markError(this, "Activity sync location stale cache");
                    PluginLogStore.append(
                        this,
                        "upload.activity",
                        "WARN",
                        "location_null_cached_snapshot_stale age_ms=" + age
                    );
                    processQueueAndStop();
                    return;
                }
                Location cachedLocation = new Location("heartbeat-cache");
                cachedLocation.setLatitude(fallback.lat);
                cachedLocation.setLongitude(fallback.lng);
                if (fallback.accuracy > 0f) {
                    cachedLocation.setAccuracy(fallback.accuracy);
                }
                cachedLocation.setTime(fallback.timestamp);
                PluginLogStore.append(
                    this,
                    "upload.activity",
                    "WARN",
                    "location_null_using_cached_snapshot ts=" + fallback.timestamp
                );
                enqueueAndProcess(cachedLocation, activityType, confidence);
                return;
            }
            ActivityRecognitionDebug.markError(this, "Activity sync location unavailable");
            PluginLogStore.append(
                this,
                "upload.activity",
                "ERROR",
                "location_unavailable_no_cache type=" + (activityType == null ? "UNKNOWN" : activityType)
            );
            processQueueAndStop();
            return;
        }
        try {
            String normalizedType = activityType == null ? "UNKNOWN" : activityType;
            long sampleTimestamp = location.getTime() > 0L ? location.getTime() : now;
            if ("STILL".equals(normalizedType)) {
                sampleTimestamp = now;
            }
            if (shouldSuppressStillDrift(location, normalizedType)) {
                PluginLogStore.append(
                    this,
                    "upload.activity",
                    "INFO",
                    "dropped_still_drift type=" + normalizedType + " acc=" + location.getAccuracy()
                );
                processQueueAndStop();
                return;
            }
            String rawDeviceId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
            if (rawDeviceId == null || rawDeviceId.isEmpty()) rawDeviceId = "unknown";

            String deviceId = sha256Hex(rawDeviceId + getPackageName());

            String latNormalized = String.format(Locale.US, "%.6f", location.getLatitude());
            String lngNormalized = String.format(Locale.US, "%.6f", location.getLongitude());
            double latRounded = Double.parseDouble(latNormalized);
            double lngRounded = Double.parseDouble(lngNormalized);
            String sampleHash = sha256Hex(deviceId + "|" + sampleTimestamp + "|" + latNormalized + "|" + lngNormalized);

            JSONObject sample = new JSONObject();
            sample.put("_type", "location");
            sample.put("lat", latRounded);
            sample.put("lng", lngRounded);
            sample.put("timestamp", sampleTimestamp);
            sample.put("tst", sampleTimestamp / 1000L);
            sample.put("acc", Math.round(location.getAccuracy()));
            sample.put("trigger", "c");
            sample.put("reason", "activity");
            sample.put("activityType", normalizedType);
            sample.put("activityConfidence", confidence);
            sample.put("provider", location.getProvider() == null ? "" : location.getProvider());
            sample.put("deviceId", deviceId);
            sample.put("payloadVersion", QipzConfig.PASSIVE_PAYLOAD_VERSION);
            String accountKey = ActivityRecognitionDebug.getAccountKey(this);
            if (!accountKey.isEmpty()) sample.put("accountKey", accountKey);
            sample.put("sampleHash", sampleHash);
            if (location.hasSpeed()) sample.put("vel", Math.round(location.getSpeed()));
            if (location.hasBearing()) sample.put("cog", Math.round(location.getBearing()));
            if (location.hasAltitude()) sample.put("alt", Math.round(location.getAltitude()));

            JSONObject payload = new JSONObject();
            payload.put("table", "passive_locations");
            payload.put("changes", new JSONArray().put(sample));

            queueStore.enqueue(payload.toString(), "activity", now, now + QipzConfig.LOCATION_ITEM_TTL_MS);

            // Update the foreground location snapshot so future calls get a fresh reading.
            ActivityRecognitionDebug.setLastForegroundLocation(
                this,
                location.getLatitude(),
                location.getLongitude(),
                location.getAccuracy(),
                sampleTimestamp
            );

            // FIX: setLastStillSyncAt moved to after successful upload in processSingleItem/batch
            // so that a failed upload doesn't eat the 5-minute cooldown window. Removed from here.

            ActivityRecognitionDebug.clearError(this);
            PluginLogStore.append(
                this,
                "upload.activity",
                "INFO",
                "queued type=" + activityType + " confidence=" + confidence + " ts=" + sampleTimestamp
            );
            Log.i(TAG, "queued activity sample type=" + activityType
                + " confidence=" + confidence
                + " lat=" + latNormalized + " lng=" + lngNormalized);
            // Schedule WorkManager upload — it uses ExistingWorkPolicy.KEEP so concurrent
            // calls collapse into one job, eliminating the queue race condition.
            uploadManager.scheduleUpload();
        } catch (Exception e) {
            Log.e(TAG, "enqueue_failed: " + e.getClass().getSimpleName() + " " + e.getMessage());
            ActivityRecognitionDebug.markError(this, "Enqueue failed: " + e.getClass().getSimpleName());
        }
        processQueueAndStop();
    }

    private boolean shouldSuppressStillDrift(Location location, String activityType) {
        if (!"STILL".equals(activityType)) return false;
        return location.hasAccuracy() && location.getAccuracy() > QipzConfig.MAX_STILL_ACCURACY_METERS;
    }

    // FIX: Removed processQueue(), processSingleItem(), tripCircuitIfNeeded(), and postPayload()
    // from this service entirely. Previously this service ran its own inline queue drain on
    // QUEUE_EXECUTOR in parallel with LocationUploadWorker running on WorkManager's thread pool.
    // Both called queueStore.getDue() simultaneously and could pick up the same items, causing
    // double upload attempts. Now this service only enqueues samples and delegates all uploading
    // to WorkManager via uploadManager.scheduleUpload(), which uses ExistingWorkPolicy.KEEP to
    // ensure only one upload job runs at a time.
    private void processQueueAndStop() {
        stopForeground(true);
        stopSelf();
    }

    private String sha256Hex(String value) throws Exception {
        java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
        byte[] bytes = digest.digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format(java.util.Locale.US, "%02x", b));
        return sb.toString();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "QIPZ Activity Sync", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Background sync for activity-triggered locations");
            manager.createNotificationChannel(channel);
        }
    }

    private Notification buildForegroundNotification(String text) {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Saving location")
            .setContentText(withPending(text))
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build();
    }

    private void updateForegroundStatus(String text) {
        NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, buildForegroundNotification(text));
    }

    private void notifySyncResult(String text) {
        if (!ActivityRecognitionDebug.isActivityNotificationsEnabled(this)) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
               != PackageManager.PERMISSION_GRANTED) return;

        String message = withPending(text);
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Saving location")
            .setContentText(message)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build();
        NotificationManagerCompat.from(this).notify(RESULT_NOTIF_ID, notification);
    }

    private String withPending(String message) {
        String base = message == null ? "" : message.trim();
        int pending = 0;
        try {
            pending = queueStore == null ? 0 : queueStore.countPending();
        } catch (Exception ignored) {
        }
        return base.isEmpty() ? "pending " + pending : base + " | pending " + pending;
    }
}