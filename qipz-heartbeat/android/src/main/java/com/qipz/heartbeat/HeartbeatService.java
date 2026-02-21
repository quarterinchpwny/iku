package com.qipz.heartbeat;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Address;
import android.location.Geocoder;
import android.location.Location;
import android.location.LocationManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
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

public class HeartbeatService extends Service {
  private static final String CHANNEL_ID = "iku_heartbeat_channel";
  private static final int NOTIFICATION_ID = 4108;
  private static final int LOCATION_LOG_NOTIFICATION_ID = 4112;
  private static final int UPLOAD_FAILURE_NOTIFICATION_ID = 4113;
  private static final String API_URL = "https://iku.quarterinchpwny.online/api/location/sync";
  private static final int MAX_BATCH_PER_RUN = 5;
  private static final int MAX_QUEUE_ATTEMPTS = 10;
  private static final float MAX_ACCEPTABLE_ACCURACY_METERS = 150f;
  private static final float MAX_ACCEPTABLE_ACCURACY_BG_METERS = 500f;
  private static final long MAX_LOCATION_STALENESS_MS = 5L * 60L * 1000L;
  private static final long MAX_LOCATION_STALENESS_BG_MS = 60L * 60L * 1000L;
  private static final long LOCATION_ITEM_TTL_MS = 24L * 60L * 60L * 1000L;
  private static final long MAX_ITEM_AGE_MS = 3L * 24L * 60L * 60L * 1000L;
  private static final long DEDUPE_WINDOW_MS = 1_000L;
  private static final float DEDUPE_DISTANCE_METERS = 0.3f;
  private static final String DEDUPE_PREFS = "iku_heartbeat_dedupe";
  private static final String KEY_LAST_LAT = "last_lat";
  private static final String KEY_LAST_LNG = "last_lng";
  private static final String KEY_LAST_AT = "last_at";

  private HeartbeatQueueStore queueStore;
  private OngoingNotification ongoingNotification;
  private String startReason = "unknown";

  public static final String INTENT_ACTION_SEND_LOCATION_USER = "com.qipz.heartbeat.SEND_LOCATION_USER";
  public static final String INTENT_ACTION_CHANGE_MONITORING = "com.qipz.heartbeat.CHANGE_MONITORING";
  public static final String INTENT_ACTION_ALARM = "com.qipz.heartbeat.ALARM";
  public static final String INTENT_ACTION_LOCATION_WAKE = "com.qipz.heartbeat.LOCATION_WAKE";
  public static final String INTENT_ACTION_ACTIVITY_WAKE = "com.qipz.heartbeat.ACTIVITY_WAKE";
  public static final String INTENT_ACTION_BOOT_COMPLETED = "android.intent.action.BOOT_COMPLETED";
  public static final String INTENT_ACTION_PACKAGE_REPLACED = "android.intent.action.MY_PACKAGE_REPLACED";
  public static final String EXTRA_LOCATION_LAT = "extra_location_lat";
  public static final String EXTRA_LOCATION_LNG = "extra_location_lng";
  public static final String EXTRA_LOCATION_TIME = "extra_location_time";
  public static final String EXTRA_LOCATION_ACCURACY = "extra_location_accuracy";
  public static final String EXTRA_LOCATION_PROVIDER = "extra_location_provider";
  public static final String EXTRA_LOCATION_SPEED = "extra_location_speed";
  public static final String EXTRA_LOCATION_BEARING = "extra_location_bearing";
  public static final String EXTRA_LOCATION_ALTITUDE = "extra_location_altitude";
  public static final String EXTRA_LOCATION_IS_MOCK = "extra_location_is_mock";

  @Override
  public void onCreate() {
    super.onCreate();
    createNotificationChannel();
    queueStore = new HeartbeatQueueStore(this);
    ongoingNotification = new OngoingNotification(this, HeartbeatScheduler.getMonitoringMode(this));
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIFICATION_ID, ongoingNotification.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
    } else {
      startForeground(NOTIFICATION_ID, ongoingNotification.build());
    }
    handleIntent(intent);
    return START_STICKY;
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  public static void enqueueTransitionEvent(
    Context context,
    String event,
    String description,
    double lat,
    double lng,
    double accuracyMeters
  ) {
    HeartbeatQueueStore queueStore = new HeartbeatQueueStore(context);
    long now = System.currentTimeMillis();
    try {
      JSONObject sample = new JSONObject();
      sample.put("_type", "transition");
      sample.put("event", normalizeTransitionEvent(event));
      sample.put("desc", description == null ? "" : description);
      sample.put("lat", lat);
      sample.put("lng", lng);
      sample.put("acc", Math.round(Math.max(0d, accuracyMeters)));
      sample.put("timestamp", now);
      sample.put("tst", now / 1000L);
      sample.put("trigger", "c");

      JSONObject payload = new JSONObject();
      payload.put("table", "passive_locations");
      payload.put("changes", new JSONArray().put(sample));

      queueStore.enqueue(payload.toString(), "transition", now, now + LOCATION_ITEM_TTL_MS);
      HeartbeatDebug.markQueueCount(context, queueStore.countPending());
    } catch (Exception ignored) {
      HeartbeatDebug.markError(context, "transition_enqueue_failed");
    }

    Intent serviceIntent = new Intent(context, HeartbeatService.class);
    serviceIntent.putExtra("reason", "transition");
    ContextCompat.startForegroundService(context, serviceIntent);
  }

  private void handleIntent(Intent intent) {
    String action = intent != null ? intent.getAction() : null;
    if (action == null) {
      startReason = intent != null && intent.getStringExtra("reason") != null
        ? intent.getStringExtra("reason")
        : "default";
      HeartbeatDebug.markServiceStart(this, startReason);
      setupAndStartService();
      return;
    }

    if (INTENT_ACTION_SEND_LOCATION_USER.equals(action)) {
      startReason = "manual";
      HeartbeatDebug.markServiceStart(this, startReason);
      fetchLocationAndEnqueue();
      return;
    }

    if (INTENT_ACTION_ALARM.equals(action)) {
      startReason = "activity";
      HeartbeatDebug.markServiceStart(this, startReason);
      setupAndStartService();
      return;
    }

    if (INTENT_ACTION_LOCATION_WAKE.equals(action)) {
      startReason = "location";
      HeartbeatDebug.markServiceStart(this, startReason);
      Location movementLocation = locationFromIntent(intent);
      if (movementLocation != null) {
        ActivityTransitionScheduler.enable(this);
        enqueueAndProcess(movementLocation);
      } else {
        setupAndStartService();
      }
      return;
    }

    if (INTENT_ACTION_ACTIVITY_WAKE.equals(action)) {
      startReason = "activity";
      HeartbeatDebug.markServiceStart(this, startReason);
      setupAndStartService();
      return;
    }

    if (INTENT_ACTION_CHANGE_MONITORING.equals(action)) {
      MonitoringMode mode = HeartbeatScheduler.cycleMonitoringMode(this);
      ongoingNotification.setMonitoringMode(mode);
      finishService();
      return;
    }

    if (INTENT_ACTION_BOOT_COMPLETED.equals(action) || INTENT_ACTION_PACKAGE_REPLACED.equals(action)) {
      startReason = "boot";
      HeartbeatDebug.markServiceStart(this, startReason);
      setupAndStartService();
      return;
    }

    startReason = "default";
    HeartbeatDebug.markServiceStart(this, startReason);
    setupAndStartService();
  }

  private void setupAndStartService() {
    ActivityTransitionScheduler.enable(this);
    LocationWakeScheduler.enable(this);
    fetchLocationAndEnqueue();
  }

  private void fetchLocationAndEnqueue() {
    if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
      && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
      HeartbeatDebug.markError(this, "location_permission_missing");
      processQueueAndStop();
      return;
    }
    if (requiresBackgroundLocationPermission(startReason)
      && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
      != PackageManager.PERMISSION_GRANTED) {
      HeartbeatDebug.markError(this, "background_location_missing");
      processQueueAndStop();
      return;
    }

    FusedLocationProviderClient fusedClient = LocationServices.getFusedLocationProviderClient(this);
    CancellationTokenSource tokenSource = new CancellationTokenSource();

    fusedClient
      .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, tokenSource.getToken())
      .addOnSuccessListener(this::enqueueAndProcess)
      .addOnFailureListener(e ->
        fusedClient
          .getLastLocation()
          .addOnSuccessListener(this::enqueueAndProcess)
          .addOnFailureListener(err -> {
            HeartbeatDebug.markError(this, "location_fetch_failed");
            processQueueAndStop();
          })
      );
  }

  private Location locationFromIntent(Intent intent) {
    if (intent == null
      || !intent.hasExtra(EXTRA_LOCATION_LAT)
      || !intent.hasExtra(EXTRA_LOCATION_LNG)) {
      return null;
    }

    double lat = intent.getDoubleExtra(EXTRA_LOCATION_LAT, Double.NaN);
    double lng = intent.getDoubleExtra(EXTRA_LOCATION_LNG, Double.NaN);
    if (!Double.isFinite(lat) || !Double.isFinite(lng)) {
      return null;
    }

    String provider = intent.getStringExtra(EXTRA_LOCATION_PROVIDER);
    Location location = new Location(provider == null || provider.isEmpty() ? "fused" : provider);
    location.setLatitude(lat);
    location.setLongitude(lng);

    long timestamp = intent.getLongExtra(EXTRA_LOCATION_TIME, System.currentTimeMillis());
    location.setTime(timestamp > 0 ? timestamp : System.currentTimeMillis());

    if (intent.hasExtra(EXTRA_LOCATION_ACCURACY)) {
      location.setAccuracy(intent.getFloatExtra(EXTRA_LOCATION_ACCURACY, Float.MAX_VALUE));
    }
    if (intent.hasExtra(EXTRA_LOCATION_SPEED)) {
      location.setSpeed(intent.getFloatExtra(EXTRA_LOCATION_SPEED, 0f));
    }
    if (intent.hasExtra(EXTRA_LOCATION_BEARING)) {
      location.setBearing(intent.getFloatExtra(EXTRA_LOCATION_BEARING, 0f));
    }
    if (intent.hasExtra(EXTRA_LOCATION_ALTITUDE)) {
      location.setAltitude(intent.getDoubleExtra(EXTRA_LOCATION_ALTITUDE, 0d));
    }
    return location;
  }

  private void enqueueAndProcess(Location location) {
    if (location == null) {
      HeartbeatDebug.markError(this, "location_null");
      processQueueAndStop();
      return;
    }
    if (!isValidLocation(location, startReason)) {
      HeartbeatDebug.markError(this, "location_invalid");
      processQueueAndStop();
      return;
    }
    if (isDuplicateLocation(location)) {
      processQueueAndStop();
      return;
    }
    if (isSuppressedByMonitoring(startReason)) {
      processQueueAndStop();
      return;
    }

    try {
      JSONObject sample = new JSONObject();
      long timestamp = System.currentTimeMillis();
      String deviceId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
      if (deviceId == null || deviceId.isEmpty()) {
        deviceId = "unknown";
      }
      String latNormalized = String.format(Locale.US, "%.6f", location.getLatitude());
      String lngNormalized = String.format(Locale.US, "%.6f", location.getLongitude());
      String sampleHash = sha256Hex(deviceId + "|" + timestamp + "|" + latNormalized + "|" + lngNormalized);

      sample.put("_type", "location");
      sample.put("lat", location.getLatitude());
      sample.put("lng", location.getLongitude());
      sample.put("timestamp", timestamp);
      sample.put("tst", timestamp / 1000L);
      sample.put("acc", Math.round(location.getAccuracy()));
      sample.put("trigger", mapReasonToTrigger(startReason));
      sample.put("reason", startReason);
      sample.put("provider", location.getProvider() == null ? "" : location.getProvider());
      sample.put("isMock", location.isFromMockProvider());
      sample.put("battery", getBatteryPercent());
      sample.put("source", isGpsEnabled() ? "gps" : "network");
      if (location.hasSpeed()) {
        sample.put("vel", Math.round(location.getSpeed()));
      }
      if (location.hasBearing()) {
        sample.put("cog", Math.round(location.getBearing()));
      }
      if (location.hasAltitude()) {
        sample.put("alt", Math.round(location.getAltitude()));
      }
      sample.put("deviceId", deviceId);
      sample.put("sampleHash", sampleHash);

      JSONObject payload = new JSONObject();
      payload.put("table", "passive_locations");
      payload.put("changes", new JSONArray().put(sample));

      long now = System.currentTimeMillis();
      queueStore.enqueue(payload.toString(), "location", now, now + LOCATION_ITEM_TTL_MS);
      saveLastQueuedLocation(location, now);
      HeartbeatDebug.markLocation(this, location.getLatitude(), location.getLongitude());
      HeartbeatDebug.markQueueCount(this, queueStore.countPending());
      notifyLocationLogged(location);
    } catch (Exception e) {
      HeartbeatDebug.markError(this, "enqueue_failed:" + e.getClass().getSimpleName());
    }

    processQueueAndStop();
  }

  private void processQueueAndStop() {
    new Thread(() -> {
      processQueue();
      finishService();
    }).start();
  }

  private void processQueue() {
    long now = System.currentTimeMillis();
    queueStore.pruneExpired(now);
    queueStore.pruneDeadLetters(MAX_QUEUE_ATTEMPTS, now - MAX_ITEM_AGE_MS);

    int processed = 0;
    while (processed < MAX_BATCH_PER_RUN) {
      List<HeartbeatQueueStore.QueueItem> due = queueStore.getDue(System.currentTimeMillis(), 1);
      if (due.isEmpty()) break;

      HeartbeatQueueStore.QueueItem item = due.get(0);
      try {
        int code = postPayload(item.payload);
        if (code >= 200 && code < 300) {
          queueStore.markSuccess(item.id);
          HeartbeatDebug.markUploadResult(this, code);
          HeartbeatDebug.clearError(this);
        } else if (isPermanentHttpFailure(code)) {
          queueStore.markSuccess(item.id);
          HeartbeatDebug.markError(this, "upload_permanent_http_" + code);
          notifyUploadFailure("Upload dropped (HTTP " + code + ")");
        } else {
          long nextRetry = computeBackoffMillis(item.attempts);
          queueStore.markFailure(item.id, item.attempts, nextRetry, "http_" + code);
          HeartbeatDebug.markError(this, "upload_http_" + code);
          notifyUploadFailure("Upload failed (HTTP " + code + ")");
        }
      } catch (Exception e) {
        long nextRetry = computeBackoffMillis(item.attempts);
        queueStore.markFailure(item.id, item.attempts, nextRetry, e.getClass().getSimpleName());
        HeartbeatDebug.markError(this, "upload_exception:" + e.getClass().getSimpleName());
        notifyUploadFailure("Upload error: " + e.getClass().getSimpleName());
      }
      processed++;
    }
    HeartbeatDebug.markQueueCount(this, queueStore.countPending());
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
      if (connection != null) {
        connection.disconnect();
      }
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

  private boolean isValidLocation(Location location, String reason) {
    boolean backgroundTriggered =
      "alarm".equals(reason) || "location".equals(reason) || "boot".equals(reason) || "activity".equals(reason);
    float maxAccuracy = backgroundTriggered ? MAX_ACCEPTABLE_ACCURACY_BG_METERS : MAX_ACCEPTABLE_ACCURACY_METERS;
    long maxAge = backgroundTriggered ? MAX_LOCATION_STALENESS_BG_MS : MAX_LOCATION_STALENESS_MS;

    if (location.getAccuracy() > maxAccuracy) {
      return false;
    }
    long now = System.currentTimeMillis();
    long age = now - location.getTime();
    return age >= 0 && age <= maxAge;
  }

  private boolean isDuplicateLocation(Location location) {
    SharedPreferences prefs = getSharedPreferences(DEDUPE_PREFS, Context.MODE_PRIVATE);
    long lastAt = prefs.getLong(KEY_LAST_AT, 0L);
    if (lastAt <= 0L) {
      return false;
    }
    long now = System.currentTimeMillis();
    if ((now - lastAt) > DEDUPE_WINDOW_MS) {
      return false;
    }

    double lastLat = Double.longBitsToDouble(prefs.getLong(KEY_LAST_LAT, Double.doubleToRawLongBits(0d)));
    double lastLng = Double.longBitsToDouble(prefs.getLong(KEY_LAST_LNG, Double.doubleToRawLongBits(0d)));

    float[] distance = new float[1];
    Location.distanceBetween(lastLat, lastLng, location.getLatitude(), location.getLongitude(), distance);
    return distance[0] <= DEDUPE_DISTANCE_METERS;
  }

  private void saveLastQueuedLocation(Location location, long timestamp) {
    SharedPreferences prefs = getSharedPreferences(DEDUPE_PREFS, Context.MODE_PRIVATE);
    prefs.edit()
      .putLong(KEY_LAST_AT, timestamp)
      .putLong(KEY_LAST_LAT, Double.doubleToRawLongBits(location.getLatitude()))
      .putLong(KEY_LAST_LNG, Double.doubleToRawLongBits(location.getLongitude()))
      .apply();
  }

  private boolean isPermanentHttpFailure(int code) {
    return code == 400 || code == 401 || code == 403 || code == 404 || code == 422;
  }

  private String mapReasonToTrigger(String reason) {
    if ("manual".equals(reason)) return "u";
    if ("location".equals(reason) || "transition".equals(reason) || "activity".equals(reason)) return "c";
    return "p";
  }

  private boolean isSuppressedByMonitoring(String reason) {
    MonitoringMode mode = HeartbeatScheduler.getMonitoringMode(this);
    if (mode == MonitoringMode.QUIET) {
      return !"manual".equals(reason);
    }
    if (mode == MonitoringMode.MANUAL) {
      return !"manual".equals(reason) && !"transition".equals(reason);
    }
    return false;
  }

  private static String normalizeTransitionEvent(String event) {
    if (event == null) return "enter";
    String value = event.toLowerCase(Locale.US);
    if ("leave".equals(value) || "exit".equals(value)) return "leave";
    if ("dwell".equals(value)) return "dwell";
    return "enter";
  }

  private int getBatteryPercent() {
    BatteryManager batteryManager = (BatteryManager) getSystemService(BATTERY_SERVICE);
    if (batteryManager == null) {
      return -1;
    }
    return batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
  }

  private void notifyLocationLogged(Location location) {
    if (ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
      != PackageManager.PERMISSION_GRANTED) {
      return;
    }

    String addressLabel = resolveAddressLabel(location);
    Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentTitle("IKU logged location")
      .setContentText(addressLabel)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setAutoCancel(true)
      .build();
    NotificationManagerCompat.from(this).notify(LOCATION_LOG_NOTIFICATION_ID, notification);
  }

  private void notifyUploadFailure(String message) {
    if (ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
      != PackageManager.PERMISSION_GRANTED) {
      return;
    }

    Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentTitle("IKU upload issue")
      .setContentText(message)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setAutoCancel(true)
      .build();
    NotificationManagerCompat.from(this).notify(UPLOAD_FAILURE_NOTIFICATION_ID, notification);
  }

  private String resolveAddressLabel(Location location) {
    String fallback = String.format(Locale.US, "%.5f, %.5f", location.getLatitude(), location.getLongitude());
    if (!Geocoder.isPresent()) {
      return fallback;
    }

    try {
      Geocoder geocoder = new Geocoder(this, Locale.getDefault());
      List<Address> addresses = geocoder.getFromLocation(location.getLatitude(), location.getLongitude(), 1);
      if (addresses == null || addresses.isEmpty()) {
        return fallback;
      }

      Address address = addresses.get(0);
      String locality = address.getLocality();
      String admin = address.getAdminArea();
      String country = address.getCountryName();
      String line0 = address.getAddressLine(0);

      if (line0 != null && !line0.isEmpty()) {
        return line0;
      }
      if (locality != null && !locality.isEmpty() && admin != null && !admin.isEmpty()) {
        return locality + ", " + admin;
      }
      if (locality != null && !locality.isEmpty()) {
        return locality;
      }
      if (admin != null && !admin.isEmpty() && country != null && !country.isEmpty()) {
        return admin + ", " + country;
      }
      if (country != null && !country.isEmpty()) {
        return country;
      }
    } catch (Exception ignored) {
      // Geocoder may fail offline; fall back to coordinates.
    }

    return fallback;
  }

  private boolean isGpsEnabled() {
    LocationManager manager = (LocationManager) getSystemService(LOCATION_SERVICE);
    return manager != null && manager.isProviderEnabled(LocationManager.GPS_PROVIDER);
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

  private boolean requiresBackgroundLocationPermission(String reason) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return false;
    }
    return "alarm".equals(reason) || "location".equals(reason) || "boot".equals(reason) || "activity".equals(reason);
  }

  private void finishService() {
    stopForeground(true);
    stopSelf();
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationManager manager = getSystemService(NotificationManager.class);
      if (manager == null) return;

      NotificationChannel channel = new NotificationChannel(
        CHANNEL_ID,
        "IKU Heartbeat",
        NotificationManager.IMPORTANCE_LOW
      );
      channel.setDescription("Background heartbeat for periodic location sync");
      manager.createNotificationChannel(channel);
    }
  }
}
