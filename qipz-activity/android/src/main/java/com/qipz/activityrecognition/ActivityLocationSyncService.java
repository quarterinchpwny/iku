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

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public class ActivityLocationSyncService extends Service {
    private static final String TAG = "QipzActivitySync";
    private static final String CHANNEL_ID = "qipz_activity_sync_channel";
    private static final int NOTIFICATION_ID = 5209;
    private static final int RESULT_NOTIF_ID = 5210;

    public static final String ACTION_ACTIVITY_SYNC = "com.qipz.activityrecognition.ACTION_ACTIVITY_SYNC";
    public static final String EXTRA_ACTIVITY_TYPE = "extra_activity_type";
    public static final String EXTRA_ACTIVITY_CONFIDENCE = "extra_activity_confidence";

    private static final ExecutorService QUEUE_EXECUTOR = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "qipz-queue-worker");
        t.setDaemon(true);
        return t;
    });

    private static int consecutiveFailures = 0;
    private static long circuitOpenUntil = 0L;

    private ActivitySyncQueueStore queueStore;

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

        ActivityRecognitionDebug.LocationSnapshot foregroundLocation =
            ActivityRecognitionDebug.getLastForegroundLocation(this);
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
            ActivityRecognitionDebug.setLastForegroundLocation(
                this,
                location.getLatitude(),
                location.getLongitude(),
                location.getAccuracy(),
                sampleTimestamp
            );
            if ("STILL".equals(normalizedType)) {
                ActivityRecognitionDebug.setLastStillSyncAt(this, System.currentTimeMillis()); 
            }
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

    private void processQueueAndStop() {
        if (System.currentTimeMillis() < circuitOpenUntil) {
            stopForeground(true);
            stopSelf();
            return;
        }
        QUEUE_EXECUTOR.execute(() -> {
            try {
                processQueue();
            } finally {
                stopForeground(true);
                stopSelf();
            }
        });
    }

    private void processQueue() {
        if (System.currentTimeMillis() < circuitOpenUntil) {
            Log.w(TAG, "circuit_open: skipping queue processing");
            return;
        }

        long now = System.currentTimeMillis();
        queueStore.pruneExpired(now);
        queueStore.pruneDeadLetters(QipzConfig.MAX_QUEUE_ATTEMPTS, now - QipzConfig.MAX_ITEM_AGE_MS);
        queueStore.prunePassiveHistoryBefore(now - QipzConfig.PASSIVE_HISTORY_RETENTION_MS);

        int processed = 0;
        while (processed < QipzConfig.MAX_BATCH_PER_RUN) {
            int remaining = QipzConfig.MAX_BATCH_PER_RUN - processed;
            int batchSize = Math.min(remaining, QipzConfig.MAX_UPLOAD_BATCH_SIZE);
            List<ActivitySyncQueueStore.QueueItem> due = queueStore.getDue(System.currentTimeMillis(), batchSize);
            if (due.isEmpty()) break;

            if (due.size() == 1) {
                ActivitySyncQueueStore.QueueItem item = due.get(0);
                processSingleItem(item);
                processed++;
                continue;
            }

            List<org.json.JSONObject> samples = new java.util.ArrayList<>(due.size());
            java.util.Set<String> seenHashes = new java.util.HashSet<>();
            for (ActivitySyncQueueStore.QueueItem item : due) {
                try {
                    org.json.JSONObject wrapper = new org.json.JSONObject(item.payload);
                    org.json.JSONArray changes = wrapper.optJSONArray("changes");
                    if (changes != null) {
                        for (int i = 0; i < changes.length(); i++) {
                            org.json.JSONObject s = changes.optJSONObject(i);
                            if (s == null) continue;
                            String h = s.optString("sampleHash", "");
                            if (!h.isEmpty() && !seenHashes.add(h)) continue;
                            samples.add(s);
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "batch_skip_malformed id=" + item.id);
                }
            }
            if (samples.isEmpty()) {
                for (ActivitySyncQueueStore.QueueItem item : due) queueStore.markSuccess(item.id);
                processed += due.size();
                continue;
            }
            try {
                org.json.JSONObject body = new org.json.JSONObject();
                body.put("table", "passive_locations");
                org.json.JSONArray arr = new org.json.JSONArray();
                for (org.json.JSONObject s : samples) arr.put(s);
                body.put("changes", arr);
                updateForegroundStatus("Uploading " + due.size() + " activity points...");
                HttpResult response = postPayload(body.toString());
                int code = response.code;
                LocationSyncResponse syncResponse = LocationSyncResponse.from(code, response.responseBody);
                if (code >= 200 && code < 300) {
                    if (syncResponse.parsed && (syncResponse.hasHardRejects() || syncResponse.isOnlyRejects())) {
                        for (ActivitySyncQueueStore.QueueItem item : due)
                            queueStore.markFailure(item.id, item.attempts, computeBackoffMillis(item.attempts), "sync_rejected_2xx");
                        tripCircuitIfNeeded();
                    } else {
                        for (ActivitySyncQueueStore.QueueItem item : due)
                            queueStore.markUploadedSuccess(item.id, System.currentTimeMillis());
                        consecutiveFailures = 0;
                        ActivityRecognitionDebug.clearError(this);
                        PluginLogStore.append(this, "upload.activity", "INFO",
                            "batch_uploaded size=" + due.size() + " " + syncResponse.compactSummary());
                    }
                } else if (isAuthFailure(code)) {
                    long nextRetry = computeBackoffMillis(due.get(0).attempts + 3);
                    for (ActivitySyncQueueStore.QueueItem item : due)
                        queueStore.markFailure(item.id, item.attempts, nextRetry, "auth_" + code);
                    tripCircuitIfNeeded();
                } else if (isPermanentHttpFailure(code)) {
                    for (ActivitySyncQueueStore.QueueItem item : due) queueStore.markSuccess(item.id);
                } else {
                    for (ActivitySyncQueueStore.QueueItem item : due)
                        queueStore.markFailure(item.id, item.attempts, computeBackoffMillis(item.attempts), "http_" + code);
                    tripCircuitIfNeeded();
                }
            } catch (Exception e) {
                for (ActivitySyncQueueStore.QueueItem item : due)
                    queueStore.markFailure(item.id, item.attempts, computeBackoffMillis(item.attempts), e.getClass().getSimpleName());
                tripCircuitIfNeeded();
            }
            processed += due.size();
        }
    }

    /** Original single-item upload path — kept for log clarity when queue has 1 item. */
    private void processSingleItem(ActivitySyncQueueStore.QueueItem item) {
        try {
            updateForegroundStatus("Uploading activity location...");
            HttpResult response = postPayload(item.payload);
            int code = response.code;
            LocationSyncResponse syncResponse = LocationSyncResponse.from(code, response.responseBody);

            if (code >= 200 && code < 300) {
                if (syncResponse.parsed && (syncResponse.hasHardRejects() || syncResponse.isOnlyRejects())) {
                    long nextRetry = computeBackoffMillis(item.attempts);
                    queueStore.markFailure(item.id, item.attempts, nextRetry, "sync_rejected_2xx");
                    ActivityRecognitionDebug.markError(this, "Activity sync rejected: " + syncResponse.compactSummary());
                    PluginLogStore.append(
                        this,
                        "upload.activity",
                        "WARN",
                        "retry_rejected_2xx id=" + item.id + " " + syncResponse.compactSummary()
                    );
                    Log.w(TAG, "upload_retry_rejected_2xx id=" + item.id + " " + syncResponse.compactSummary());
                    notifySyncResult("Activity upload queued for retry (server rejected sample)");
                    tripCircuitIfNeeded();
                    return;
                }
                queueStore.markUploadedSuccess(item.id, System.currentTimeMillis());
                consecutiveFailures = 0;
                ActivityRecognitionDebug.clearError(this);
                PluginLogStore.append(
                    this,
                    "upload.activity",
                    "INFO",
                    "uploaded id=" + item.id + " " + syncResponse.compactSummary()
                );
                Log.i(TAG, "upload_ok id=" + item.id + " " + syncResponse.compactSummary());
                notifySyncResult("Activity location uploaded");
            } else if (isAuthFailure(code)) {
                long nextRetry = computeBackoffMillis(item.attempts + 3);
                queueStore.markFailure(item.id, item.attempts, nextRetry, "auth_" + code);
                ActivityRecognitionDebug.markError(this, "Auth failure HTTP " + code + " - check accountKey");
                PluginLogStore.append(
                    this,
                    "upload.activity",
                    "ERROR",
                    "auth_failure id=" + item.id + " http=" + code
                );
                Log.w(TAG, "upload_auth_failure id=" + item.id + " http=" + code);
                notifySyncResult("Activity upload auth failure (HTTP " + code + ")");
                tripCircuitIfNeeded();
                return;
            } else if (isPermanentHttpFailure(code)) {
                queueStore.markSuccess(item.id);
                ActivityRecognitionDebug.markError(this, "Activity sync dropped permanent HTTP " + code);
                PluginLogStore.append(
                    this,
                    "upload.activity",
                    "WARN",
                    "dropped_permanent id=" + item.id + " http=" + code
                );
                Log.w(TAG, "upload_drop_permanent id=" + item.id + " http=" + code);
                notifySyncResult("Activity upload dropped (HTTP " + code + ")");
            } else {
                long nextRetry = computeBackoffMillis(item.attempts);
                queueStore.markFailure(item.id, item.attempts, nextRetry, "http_" + code);
                ActivityRecognitionDebug.markError(this, "Activity sync retry HTTP " + code);
                PluginLogStore.append(
                    this,
                    "upload.activity",
                    "WARN",
                    "retry_http id=" + item.id + " http=" + code + " attempts=" + (item.attempts + 1)
                );
                Log.w(TAG, "upload_retry id=" + item.id + " http=" + code + " attempts=" + (item.attempts + 1));
                notifySyncResult("Activity upload queued for retry (HTTP " + code + ")");
                tripCircuitIfNeeded();
            }
        } catch (Exception e) {
            long nextRetry = computeBackoffMillis(item.attempts);
            queueStore.markFailure(item.id, item.attempts, nextRetry, e.getClass().getSimpleName());
            String errorMessage = e.getMessage() == null ? "n/a" : e.getMessage();
            ActivityRecognitionDebug.markError(this,
                "Activity sync exception: " + e.getClass().getSimpleName() + " " + errorMessage);
            PluginLogStore.append(
                this,
                "upload.activity",
                "ERROR",
                "exception id=" + item.id
                    + " type=" + e.getClass().getSimpleName()
                    + " msg=" + errorMessage
                    + " attempts=" + (item.attempts + 1)
            );
            Log.e(TAG, "upload_exception id=" + item.id + " attempts=" + (item.attempts + 1), e);
            notifySyncResult("Activity upload retry after error");
            tripCircuitIfNeeded();
        }
    }

    private void tripCircuitIfNeeded() {
        if (++consecutiveFailures >= QipzConfig.MAX_CONSECUTIVE_FAILURES) {
            circuitOpenUntil = System.currentTimeMillis() + QipzConfig.CIRCUIT_BREAKER_DURATION_MS;
            consecutiveFailures = 0;
            Log.w(TAG, "circuit_breaker_tripped: pausing uploads for "
                + (QipzConfig.CIRCUIT_BREAKER_DURATION_MS / 60_000) + " min");
            ActivityRecognitionDebug.markError(this, "Upload circuit breaker open - too many consecutive failures");
        }
    }

    private HttpResult postPayload(String payload) throws Exception {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(QipzConfig.API_URL);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(QipzConfig.CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(QipzConfig.READ_TIMEOUT_MS);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");

            String accountKey = ActivityRecognitionDebug.getAccountKey(this);
            if (!accountKey.isEmpty()) {
                connection.setRequestProperty("Authorization", "Bearer " + accountKey);
                connection.setRequestProperty("X-Payload-Sig", buildHmacSignature(payload, accountKey));
            }

            try (OutputStream os = connection.getOutputStream()) {
                os.write(payload.getBytes(StandardCharsets.UTF_8));
            }
            int code = connection.getResponseCode();
            String responseBody = readBody(connection, code);
            return new HttpResult(code, responseBody);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String readBody(HttpURLConnection connection, int code) {
        InputStream stream = null;
        try {
            stream = code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream();
            if (stream == null) return "";
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int read;
            while ((read = stream.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            return out.toString(StandardCharsets.UTF_8.name());
        } catch (Exception ignored) {
            return "";
        } finally {
            if (stream != null) {
                try { stream.close(); } catch (Exception ignored) {}
            }
        }
    }

    private String buildHmacSignature(String payload, String key) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] bytes = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) sb.append(String.format(Locale.US, "%02x", b));
            return sb.toString();
        } catch (Exception e) {
            Log.w(TAG, "hmac_failed: " + e.getMessage());
            return "";
        }
    }

    private long computeBackoffMillis(int attempts) {
        int nextAttempt = attempts + 1;
        long base = 30_000L;
        long cap = 6L * 60L * 60L * 1000L;
        long delay = base * (1L << Math.min(nextAttempt, 8));
        return System.currentTimeMillis() + Math.min(delay, cap);
    }

    private boolean isAuthFailure(int code) {
        return code == 401 || code == 403;
    }

    private boolean isPermanentHttpFailure(int code) {
        return code == 400 || code == 404 || code == 422;
    }

    private String sha256Hex(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format(Locale.US, "%02x", b));
        return sb.toString();
    }

    private static final class HttpResult {
        final int code;
        final String responseBody;

        HttpResult(int code, String responseBody) {
            this.code = code;
            this.responseBody = responseBody == null ? "" : responseBody;
        }
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
