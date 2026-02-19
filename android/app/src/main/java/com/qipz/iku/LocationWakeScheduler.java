package com.qipz.iku;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import androidx.core.app.ActivityCompat;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

public final class LocationWakeScheduler {
  private static final int REQUEST_CODE = 4111;
  private static final long UPDATE_INTERVAL_MOVE_MS = 5_000L;
  private static final long UPDATE_INTERVAL_SIGNIFICANT_MS = 2L * 60_000L;
  private static final long UPDATE_INTERVAL_MANUAL_MS = 5L * 60_000L;
  private static final long UPDATE_INTERVAL_QUIET_MS = 15L * 60_000L;

  private LocationWakeScheduler() {}

  public static void enable(Context context) {
    if (!hasLocationPermission(context)) {
      HeartbeatDebug.markError(context, "location_permission_missing");
      return;
    }
    if (requiresBackgroundLocationPermission() && !hasBackgroundLocationPermission(context)) {
      HeartbeatDebug.markError(context, "background_location_missing");
      return;
    }
    MonitoringMode mode = HeartbeatScheduler.getMonitoringMode(context);
    long intervalMs = intervalForMode(mode);
    float minDistance = distanceForMode(mode);
    int priority = priorityForMode(mode);

    LocationRequest request = new LocationRequest.Builder(priority, intervalMs)
      .setMinUpdateIntervalMillis(Math.max(2_000L, intervalMs / 2))
      .setMinUpdateDistanceMeters(minDistance)
      .setMaxUpdateDelayMillis(intervalMs * 2)
      .build();

    try {
      LocationServices.getFusedLocationProviderClient(context)
        .requestLocationUpdates(request, pendingIntent(context));
    } catch (SecurityException ignored) {
      // Permission may be revoked while app is running.
    }
  }

  private static long intervalForMode(MonitoringMode mode) {
    switch (mode) {
      case QUIET:
        return UPDATE_INTERVAL_QUIET_MS;
      case MANUAL:
        return UPDATE_INTERVAL_MANUAL_MS;
      case SIGNIFICANT:
        return UPDATE_INTERVAL_SIGNIFICANT_MS;
      case MOVE:
      default:
        return UPDATE_INTERVAL_MOVE_MS;
    }
  }

  private static float distanceForMode(MonitoringMode mode) {
    switch (mode) {
      case QUIET:
        return 150f;
      case MANUAL:
        return 5f;
      case SIGNIFICANT:
        return 3f;
      case MOVE:
      default:
        return 1f;
    }
  }

  private static int priorityForMode(MonitoringMode mode) {
    switch (mode) {
      case MOVE:
        return Priority.PRIORITY_HIGH_ACCURACY;
      case SIGNIFICANT:
        return Priority.PRIORITY_BALANCED_POWER_ACCURACY;
      case MANUAL:
      case QUIET:
      default:
        return Priority.PRIORITY_LOW_POWER;
    }
  }

  public static void disable(Context context) {
    LocationServices.getFusedLocationProviderClient(context)
      .removeLocationUpdates(pendingIntent(context));
  }

  private static PendingIntent pendingIntent(Context context) {
    Intent intent = new Intent(context, LocationWakeReceiver.class);
    return PendingIntent.getBroadcast(
      context,
      REQUEST_CODE,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
  }

  private static boolean hasLocationPermission(Context context) {
    return ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
      || ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
  }

  private static boolean hasBackgroundLocationPermission(Context context) {
    return ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
      == PackageManager.PERMISSION_GRANTED;
  }

  private static boolean requiresBackgroundLocationPermission() {
    return android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q;
  }
}
