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
import java.util.Locale;

public class LocationForegroundService extends Service {
    private static final String TAG = "QipzLocation";
    private static final String CHANNEL_ID = "qipz_location_channel";
    private static final int NOTIF_ID = 6100;

    private static final String ACTION_START = "com.qipz.activityrecognition.location.START";
    private static final String ACTION_UPDATE_ACTIVITY = "com.qipz.activityrecognition.location.UPDATE_ACTIVITY";
    private static final String EXTRA_ACTIVITY_TYPE = "activityType";

    private FusedLocationProviderClient fusedClient;
    private LocationCallback locationCallback;
    private Location lastRecordedLocation;
    private String currentActivityType = "UNKNOWN";
    private ActivitySyncQueueStore queueStore;
    private UploadManager uploadManager;

    public static void start(android.content.Context context) {
        Intent intent = new Intent(context, LocationForegroundService.class);
        intent.setAction(ACTION_START);
        ContextCompat.startForegroundService(context, intent);
    }

    public static void stop(android.content.Context context) {
        context.stopService(new Intent(context, LocationForegroundService.class));
    }

    public static void onActivityChanged(android.content.Context context, String activityType) {
        Intent intent = new Intent(context, LocationForegroundService.class);
        intent.setAction(ACTION_UPDATE_ACTIVITY);
        intent.putExtra(EXTRA_ACTIVITY_TYPE, activityType == null ? "UNKNOWN" : activityType);
        ContextCompat.startForegroundService(context, intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        fusedClient = LocationServices.getFusedLocationProviderClient(this);
        queueStore = new ActivitySyncQueueStore(this);
        uploadManager = new UploadManager(this);
        currentActivityType = ActivityRecognitionDebug.getLastType(this);
        createNotificationChannel();
        buildLocationCallback();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        startForeground(NOTIF_ID, buildNotification("Tracking location"));

        if (ACTION_UPDATE_ACTIVITY.equals(action)) {
            String activityType = intent.getStringExtra(EXTRA_ACTIVITY_TYPE);
            updateIntervalForActivity(activityType == null ? "UNKNOWN" : activityType);
            return START_STICKY;
        }
        requestLocationUpdates();
        return START_STICKY;
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
                if (!meetsDisplacementThreshold(location)) return;
                lastRecordedLocation = location;
                enqueueLocation(location);
                uploadManager.scheduleUpload();
            }
        };
    }

    private void requestLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
            && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityRecognitionDebug.markError(this, "LocationForegroundService: missing location permission");
            return;
        }

        LocationRequest request = buildRequestForActivity(currentActivityType);
        fusedClient.removeLocationUpdates(locationCallback);
        fusedClient.requestLocationUpdates(request, locationCallback, getMainLooper())
            .addOnSuccessListener(v -> Log.i(TAG, "location_updates_started activity=" + currentActivityType))
            .addOnFailureListener(e -> {
                ActivityRecognitionDebug.markError(this, "LocationForegroundService request failed");
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
                return new LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, QipzConfig.WALKING_INTERVAL_MS)
                    .setMinUpdateIntervalMillis(QipzConfig.WALKING_MIN_INTERVAL_MS)
                    .setMinUpdateDistanceMeters(QipzConfig.WALKING_MIN_DISTANCE_M)
                    .build();
            case "STILL":
                return new LocationRequest.Builder(Priority.PRIORITY_LOW_POWER, QipzConfig.STILL_INTERVAL_MS)
                    .setMinUpdateIntervalMillis(QipzConfig.STILL_MIN_INTERVAL_MS)
                    .build();
            default:
                return new LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, QipzConfig.UNKNOWN_INTERVAL_MS)
                    .setMinUpdateIntervalMillis(QipzConfig.UNKNOWN_MIN_INTERVAL_MS)
                    .setMinUpdateDistanceMeters(QipzConfig.UNKNOWN_MIN_DISTANCE_M)
                    .build();
        }
    }

    private void updateIntervalForActivity(String activityType) {
        String next = activityType == null ? "UNKNOWN" : activityType;
        if (next.equals(currentActivityType)) return;
        currentActivityType = next;
        requestLocationUpdates();
        Log.i(TAG, "interval_updated activity=" + next);
    }

    private boolean meetsDisplacementThreshold(Location location) {
        if (lastRecordedLocation == null) return true;
        return lastRecordedLocation.distanceTo(location) >= QipzConfig.MIN_DISPLACEMENT_METERS;
    }

    private void enqueueLocation(Location location) {
        try {
            long now = System.currentTimeMillis();
            String deviceId = getHashedDeviceId();
            String lat = String.format(Locale.US, "%.6f", location.getLatitude());
            String lng = String.format(Locale.US, "%.6f", location.getLongitude());
            String sampleHash = sha256Hex(deviceId + "|" + now + "|" + lat + "|" + lng);

            JSONObject sample = new JSONObject();
            sample.put("_type", "location");
            sample.put("lat", Double.parseDouble(lat));
            sample.put("lng", Double.parseDouble(lng));
            sample.put("timestamp", now);
            sample.put("tst", now / 1000L);
            sample.put("acc", Math.round(location.getAccuracy()));
            sample.put("trigger", "t");
            sample.put("reason", "continuous");
            sample.put("activityType", currentActivityType);
            sample.put("deviceId", deviceId);
            sample.put("sampleHash", sampleHash);

            String accountKey = ActivityRecognitionDebug.getAccountKey(this);
            if (!accountKey.isEmpty()) sample.put("accountKey", accountKey);
            if (location.hasSpeed()) sample.put("vel", Math.round(location.getSpeed()));
            if (location.hasBearing()) sample.put("cog", Math.round(location.getBearing()));
            if (location.hasAltitude()) sample.put("alt", Math.round(location.getAltitude()));
            sample.put("provider", location.getProvider() == null ? "" : location.getProvider());

            JSONObject payload = new JSONObject();
            payload.put("table", "passive_locations");
            payload.put("changes", new JSONArray().put(sample));

            queueStore.enqueue(payload.toString(), now, now + QipzConfig.LOCATION_ITEM_TTL_MS);
            Log.i(TAG, "enqueued continuous point activity=" + currentActivityType + " lat=" + lat + " lng=" + lng);
        } catch (Exception e) {
            Log.e(TAG, "enqueue_failed", e);
            ActivityRecognitionDebug.markError(this, "LocationForegroundService enqueue failed");
        }
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
        for (byte b : bytes) {
            sb.append(String.format(Locale.US, "%02x", b));
        }
        return sb.toString();
    }

    @Override
    public void onDestroy() {
        fusedClient.removeLocationUpdates(locationCallback);
        stopForeground(true);
        super.onDestroy();
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
