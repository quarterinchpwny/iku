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
        startForeground(NOTIFICATION_ID, buildForegroundNotification("Syncing activity-triggered location"));

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
        if (location == null) {
            ActivityRecognitionDebug.markError(this, "Activity sync location unavailable");
            processQueueAndStop();
            return;
        }
        try {
            long timestamp = System.currentTimeMillis();
            String rawDeviceId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
            if (rawDeviceId == null || rawDeviceId.isEmpty()) rawDeviceId = "unknown";

            String deviceId = sha256Hex(rawDeviceId + getPackageName());

            String latNormalized = String.format(Locale.US, "%.6f", location.getLatitude());
            String lngNormalized = String.format(Locale.US, "%.6f", location.getLongitude());
            double latRounded = Double.parseDouble(latNormalized);
            double lngRounded = Double.parseDouble(lngNormalized);
            String sampleHash = sha256Hex(deviceId + "|" + timestamp + "|" + latNormalized + "|" + lngNormalized);

            JSONObject sample = new JSONObject();
            sample.put("_type", "location");
            sample.put("lat", latRounded);
            sample.put("lng", lngRounded);
            sample.put("timestamp", timestamp);
            sample.put("tst", timestamp / 1000L);
            sample.put("acc", Math.round(location.getAccuracy()));
            sample.put("trigger", "c");
            sample.put("reason", "activity");
            sample.put("activityType", activityType == null ? "UNKNOWN" : activityType);
            sample.put("activityConfidence", confidence);
            sample.put("provider", location.getProvider() == null ? "" : location.getProvider());
            sample.put("deviceId", deviceId);
            String accountKey = ActivityRecognitionDebug.getAccountKey(this);
            if (!accountKey.isEmpty()) sample.put("accountKey", accountKey);
            sample.put("sampleHash", sampleHash);
            if (location.hasSpeed()) sample.put("vel", Math.round(location.getSpeed()));
            if (location.hasBearing()) sample.put("cog", Math.round(location.getBearing()));
            if (location.hasAltitude()) sample.put("alt", Math.round(location.getAltitude()));

            JSONObject payload = new JSONObject();
            payload.put("table", "passive_locations");
            payload.put("changes", new JSONArray().put(sample));

            queueStore.enqueue(payload.toString(), "activity", timestamp, timestamp + QipzConfig.LOCATION_ITEM_TTL_MS);
            ActivityRecognitionDebug.clearError(this);
            PluginLogStore.append(
                this,
                "upload.activity",
                "INFO",
                "queued type=" + activityType + " confidence=" + confidence + " ts=" + timestamp
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

        int processed = 0;
        while (processed < QipzConfig.MAX_BATCH_PER_RUN) {
            List<ActivitySyncQueueStore.QueueItem> due = queueStore.getDue(System.currentTimeMillis(), 1);
            if (due.isEmpty()) break;

            ActivitySyncQueueStore.QueueItem item = due.get(0);
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
                        break;
                    }
                    queueStore.markSuccess(item.id);
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
                    break;
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
                ActivityRecognitionDebug.markError(this,
                    "Activity sync exception: " + e.getClass().getSimpleName());
                PluginLogStore.append(
                    this,
                    "upload.activity",
                    "ERROR",
                    "exception id=" + item.id + " type=" + e.getClass().getSimpleName()
                );
                Log.e(TAG, "upload_exception id=" + item.id + " attempts=" + (item.attempts + 1), e);
                notifySyncResult("Activity upload retry after error");
                tripCircuitIfNeeded();
            }
            processed++;
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
            .setContentTitle("Activity sync")
            .setContentText(text)
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

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_save)
            .setContentTitle("Activity sync")
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build();
        NotificationManagerCompat.from(this).notify(RESULT_NOTIF_ID, notification);
    }
}
