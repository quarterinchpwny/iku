package com.qipz.iku;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionEvent;
import com.google.android.gms.location.ActivityTransitionResult;
import com.google.android.gms.location.DetectedActivity;

public class ActivityTransitionReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    if (!HeartbeatScheduler.isEnabled(context)) {
      return;
    }
    if (!ActivityTransitionResult.hasResult(intent)) {
      return;
    }

    ActivityTransitionResult result = ActivityTransitionResult.extractResult(intent);
    if (result == null || result.getTransitionEvents().isEmpty()) {
      return;
    }

    for (ActivityTransitionEvent event : result.getTransitionEvents()) {
      if (!isMovementTransition(event)) {
        continue;
      }
      if (!HeartbeatScheduler.tryAcquireLocationWake(context)) {
        return;
      }

      Intent serviceIntent = new Intent(context, HeartbeatService.class);
      serviceIntent.putExtra("reason", "activity");
      serviceIntent.setAction(HeartbeatService.INTENT_ACTION_ACTIVITY_WAKE);
      ContextCompat.startForegroundService(context, serviceIntent);
      return;
    }
  }

  private boolean isMovementTransition(ActivityTransitionEvent event) {
    int transition = event.getTransitionType();
    int activity = event.getActivityType();

    if (transition == ActivityTransition.ACTIVITY_TRANSITION_ENTER) {
      return activity == DetectedActivity.ON_FOOT
        || activity == DetectedActivity.WALKING
        || activity == DetectedActivity.RUNNING
        || activity == DetectedActivity.ON_BICYCLE
        || activity == DetectedActivity.IN_VEHICLE;
    }

    return transition == ActivityTransition.ACTIVITY_TRANSITION_EXIT
      && activity == DetectedActivity.STILL;
  }
}
