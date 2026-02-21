package com.qipz.heartbeat;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import com.google.android.gms.location.ActivityRecognition;
import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionRequest;
import com.google.android.gms.location.DetectedActivity;
import java.util.ArrayList;
import java.util.List;

public final class ActivityTransitionScheduler {
  private static final int REQUEST_CODE = 4114;

  private ActivityTransitionScheduler() {}

  public static void enable(Context context) {
    if (!hasLocationPermission(context)) {
      HeartbeatDebug.markError(context, "location_permission_missing");
      return;
    }
    if (requiresBackgroundLocationPermission() && !hasBackgroundLocationPermission(context)) {
      HeartbeatDebug.markError(context, "background_location_missing");
      return;
    }
    if (requiresActivityPermission() && !hasActivityRecognitionPermission(context)) {
      HeartbeatDebug.markError(context, "activity_permission_missing");
      return;
    }

    ActivityTransitionRequest request = new ActivityTransitionRequest(buildTransitions());
    ActivityRecognition.getClient(context)
      .requestActivityTransitionUpdates(request, pendingIntent(context))
      .addOnSuccessListener(unused -> {
        HeartbeatDebug.clearError(context);
        HeartbeatDebug.markScheduled(context);
      })
      .addOnFailureListener(e -> HeartbeatDebug.markError(context, "activity_transition_register_failed"));
  }

  public static void disable(Context context) {
    ActivityRecognition.getClient(context)
      .removeActivityTransitionUpdates(pendingIntent(context))
      .addOnFailureListener(e -> HeartbeatDebug.markError(context, "activity_transition_remove_failed"));
  }

  private static PendingIntent pendingIntent(Context context) {
    Intent intent = new Intent(context, ActivityTransitionReceiver.class);
    return PendingIntent.getBroadcast(
      context,
      REQUEST_CODE,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
  }

  private static List<ActivityTransition> buildTransitions() {
    List<ActivityTransition> transitions = new ArrayList<>();
    addBothTransitions(transitions, DetectedActivity.STILL);
    addBothTransitions(transitions, DetectedActivity.ON_FOOT);
    addBothTransitions(transitions, DetectedActivity.WALKING);
    addBothTransitions(transitions, DetectedActivity.RUNNING);
    addBothTransitions(transitions, DetectedActivity.ON_BICYCLE);
    addBothTransitions(transitions, DetectedActivity.IN_VEHICLE);
    return transitions;
  }

  private static void addBothTransitions(List<ActivityTransition> transitions, int activityType) {
    transitions.add(
      new ActivityTransition.Builder()
        .setActivityType(activityType)
        .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
        .build()
    );
    transitions.add(
      new ActivityTransition.Builder()
        .setActivityType(activityType)
        .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT)
        .build()
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

  private static boolean hasActivityRecognitionPermission(Context context) {
    return ActivityCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION)
      == PackageManager.PERMISSION_GRANTED;
  }

  private static boolean requiresBackgroundLocationPermission() {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q;
  }

  private static boolean requiresActivityPermission() {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q;
  }
}
