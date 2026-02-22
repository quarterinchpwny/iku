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
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.CancellationTokenSource;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

public class ActivityLocationSyncService extends Service {
  private static final String TAG = "QipzActivitySync";
  private static final String CHANNEL_ID = "qipz_activity_sync_channel";
  private static final int NOTIFICATION_ID = 5209;
  private static final String API_URL = "https://iku.quarterinchpwny.online/api/location/sync";
  private static final int MAX_BATCH_PER_RUN = 5;
  private static final int MAX_QUEUE_ATTEMPTS = 10;
  private static final long LOCATION_ITEM_TTL_MS = 24L * 60L * 60L * 1000L;
  private static final long MAX_ITEM_AGE_MS = 3L * 24L * 60L * 60L * 1000L;

  public static final String ACTION_ACTIVITY_SYNC = "com.qipz.activityrecognition.ACTION_ACTIVITY_SYNC";
  public static final String EXTRA_ACTIVITY_TYPE = "extra_activity_type";
  public static final String EXTRA_ACTIVITY_CONFIDENCE = "extra_activity_confidence";

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
    Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentTitle("Activity sync")
      .setContentText("Syncing activity-triggered location")
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setOngoing(true)
      .build();
    startForeground(NOTIFICATION_ID, notification);

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
      processQueueAndStop();
      return;
    }

    FusedLocationProviderClient fusedClient = LocationServices.getFusedLocationProviderClient(this);
    CancellationTokenSource tokenSource = new CancellationTokenSource();
    fusedClient
      .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, tokenSource.getToken())
      .addOnSuccessListener(location -> enqueueAndProcess(location, activityType, confidence))
      .addOnFailureListener(e ->
        fusedClient.getLastLocation()
          .addOnSuccessListener(location -> enqueueAndProcess(location, activityType, confidence))
          .addOnFailureListener(err -> {
            Log.e(TAG, "location_fetch_failed", err);
            processQueueAndStop();
          })
      );
  }

  private void enqueueAndProcess(Location location, String activityType, int confidence) {
    if (location == null) {
      processQueueAndStop();
      return;
    }
    try {
      long timestamp = System.currentTimeMillis();
      String deviceId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
      if (deviceId == null || deviceId.isEmpty()) {
        deviceId = "unknown";
      }
      String latNormalized = String.format(Locale.US, "%.6f", location.getLatitude());
      String lngNormalized = String.format(Locale.US, "%.6f", location.getLongitude());
      String sampleHash = sha256Hex(deviceId + "|" + timestamp + "|" + latNormalized + "|" + lngNormalized);

      JSONObject sample = new JSONObject();
      sample.put("_type", "location");
      sample.put("lat", location.getLatitude());
      sample.put("lng", location.getLongitude());
      sample.put("timestamp", timestamp);
      sample.put("tst", timestamp / 1000L);
      sample.put("acc", Math.round(location.getAccuracy()));
      sample.put("trigger", "c");
      sample.put("reason", "activity");
      sample.put("activityType", activityType == null ? "UNKNOWN" : activityType);
      sample.put("activityConfidence", confidence);
      sample.put("provider", location.getProvider() == null ? "" : location.getProvider());
      sample.put("deviceId", deviceId);
      sample.put("sampleHash", sampleHash);
      if (location.hasSpeed()) {
        sample.put("vel", Math.round(location.getSpeed()));
      }
      if (location.hasBearing()) {
        sample.put("cog", Math.round(location.getBearing()));
      }
      if (location.hasAltitude()) {
        sample.put("alt", Math.round(location.getAltitude()));
      }

      JSONObject payload = new JSONObject();
      payload.put("table", "passive_locations");
      payload.put("changes", new JSONArray().put(sample));

      queueStore.enqueue(payload.toString(), timestamp, timestamp + LOCATION_ITEM_TTL_MS);
      Log.i(
        TAG,
        "queued activity sample type=" + activityType + " confidence=" + confidence
          + " lat=" + latNormalized + " lng=" + lngNormalized
      );
    } catch (Exception ignored) {
      // Ignore malformed sample writes and keep processing existing queue.
    }
    processQueueAndStop();
  }

  private void processQueueAndStop() {
    new Thread(() -> {
      processQueue();
      stopForeground(true);
      stopSelf();
    }).start();
  }

  private void processQueue() {
    long now = System.currentTimeMillis();
    queueStore.pruneExpired(now);
    queueStore.pruneDeadLetters(MAX_QUEUE_ATTEMPTS, now - MAX_ITEM_AGE_MS);

    int processed = 0;
    while (processed < MAX_BATCH_PER_RUN) {
      List<ActivitySyncQueueStore.QueueItem> due = queueStore.getDue(System.currentTimeMillis(), 1);
      if (due.isEmpty()) break;

      ActivitySyncQueueStore.QueueItem item = due.get(0);
      try {
        int code = postPayload(item.payload);
        if (code >= 200 && code < 300) {
          queueStore.markSuccess(item.id);
          Log.i(TAG, "upload_ok id=" + item.id + " http=" + code);
        } else if (isPermanentHttpFailure(code)) {
          queueStore.markSuccess(item.id);
          Log.w(TAG, "upload_drop_permanent id=" + item.id + " http=" + code);
        } else {
          long nextRetry = computeBackoffMillis(item.attempts);
          queueStore.markFailure(item.id, item.attempts, nextRetry, "http_" + code);
          Log.w(TAG, "upload_retry id=" + item.id + " http=" + code + " attempts=" + (item.attempts + 1));
        }
      } catch (Exception e) {
        long nextRetry = computeBackoffMillis(item.attempts);
        queueStore.markFailure(item.id, item.attempts, nextRetry, e.getClass().getSimpleName());
        Log.e(TAG, "upload_exception id=" + item.id + " attempts=" + (item.attempts + 1), e);
      }
      processed++;
    }
  }

  private int postPayload(String payload) throws Exception {
    HttpURLConnection connection = null;
    try {
      URL url = new URL(API_URL);
      connection = (HttpURLConnection) url.openConnection();
      connection.setRequestMethod("POST");
      connection.setConnectTimeout(10_000);
      connection.setReadTimeout(15_000);
      connection.setDoOutput(true);
      connection.setRequestProperty("Content-Type", "application/json");

      try (OutputStream os = connection.getOutputStream()) {
        os.write(payload.getBytes(StandardCharsets.UTF_8));
      }
      return connection.getResponseCode();
    } finally {
      if (connection != null) connection.disconnect();
    }
  }

  private long computeBackoffMillis(int attempts) {
    int nextAttempt = attempts + 1;
    long base = 30_000L;
    long cap = 6L * 60L * 60L * 1000L;
    long delay = base * (1L << Math.min(nextAttempt, 8));
    delay = Math.min(delay, cap);
    return System.currentTimeMillis() + delay;
  }

  private boolean isPermanentHttpFailure(int code) {
    return code == 400 || code == 401 || code == 403 || code == 404 || code == 422;
  }

  private String sha256Hex(String value) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
    StringBuilder sb = new StringBuilder();
    for (byte b : bytes) {
      sb.append(String.format(Locale.US, "%02x", b));
    }
    return sb.toString();
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationManager manager = getSystemService(NotificationManager.class);
      if (manager == null) return;
      NotificationChannel channel = new NotificationChannel(
        CHANNEL_ID,
        "QIPZ Activity Sync",
        NotificationManager.IMPORTANCE_LOW
      );
      channel.setDescription("Background sync for activity-triggered locations");
      manager.createNotificationChannel(channel);
    }
  }
}
