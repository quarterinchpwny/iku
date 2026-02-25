package com.qipz.activityrecognition;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.google.android.gms.location.ActivityRecognitionResult;
import com.google.android.gms.location.ActivityTransitionEvent;
import com.google.android.gms.location.ActivityTransitionResult;
import com.google.android.gms.location.DetectedActivity;
import com.google.android.gms.location.LocationServices;

import java.util.List;

import org.json.JSONObject;

public class ActivityRecognitionReceiver extends BroadcastReceiver {
    private static final String TAG = "QipzActivity";
    private static final String CHANNEL_ID = "qipz_activity_channel";
    private static final int NOTIFICATION_ID = 5201;

    @Override
    public void onReceive(Context context, Intent intent) {
        boolean hasActivityResult = ActivityRecognitionResult.hasResult(intent);
        boolean hasTransitionResult = ActivityTransitionResult.hasResult(intent);
        if (!hasActivityResult && !hasTransitionResult) {
            Log.v(TAG, "onReceive: no activity payload action=" + (intent == null ? "null" : intent.getAction()));
            return;
        }

        try {
            if (hasTransitionResult) {
                ActivityTransitionResult result = ActivityTransitionResult.extractResult(intent);
                if (result != null
                        && result.getTransitionEvents() != null
                        && !result.getTransitionEvents().isEmpty()) {
                    ActivityTransitionEvent latest =
                        result.getTransitionEvents().get(result.getTransitionEvents().size() - 1);
                    String type = mapType(latest.getActivityType());
                    String transition = latest.getTransitionType() == 0 ? "ENTER" : "EXIT";
                    int confidence = "ENTER".equals(transition) ? 100 : 80;
                    emitEvent(context, type, confidence, "transition:" + transition + ":" + mapRawType(latest.getActivityType()));
                }
            }

            if (!hasActivityResult) return;

            ActivityRecognitionResult result = ActivityRecognitionResult.extractResult(intent);
            if (result == null) return;

            Classification c = classify(result.getMostProbableActivity(), result.getProbableActivities());
            emitEvent(context, c.type, c.confidence, c.debugLabel);

        } catch (Exception e) {
            Log.e(TAG, "onReceive failed", e);
        }
    }

    private void emitEvent(Context context, String type, int confidence, String debugLabel) throws Exception {
        JSONObject data = new JSONObject();
        data.put("type", type);
        data.put("confidence", confidence);
        data.put("debugLabel", debugLabel);

        ActivityRecognitionDebug.markEvent(context, type, confidence);
        ActivityRecognitionDebug.markDebugLabel(context, debugLabel);
        Log.i(TAG, "event type=" + type + " confidence=" + confidence + " debug=" + debugLabel);

        boolean delivered = ActivityRecognitionPlugin.emitActivityChange(data);
        if (!delivered) {
            ActivityRecognitionDebug.enqueuePendingEvent(context, data);
            Log.v(TAG, "event queued for JS delivery");
        }
        LocationForegroundService.onActivityChanged(context, type);
        if (ActivityRecognitionDebug.isActivityNotificationsEnabled(context)) {
            notifyActivityDetected(context, type, confidence, debugLabel);
        }
    }

    private Classification classify(DetectedActivity mostProbable, List<DetectedActivity> probable) {
        int walkScore = 0, runScore = 0, driveScore = 0, stillScore = 0, total = 0;

        if (probable != null) {
            for (DetectedActivity a : probable) {
                int c = a.getConfidence();
                total += c;
                switch (a.getType()) {
                    case DetectedActivity.RUNNING: runScore += c; break;
                    case DetectedActivity.ON_FOOT:
                    case DetectedActivity.WALKING: walkScore += c; break;
                    case DetectedActivity.IN_VEHICLE:
                    case DetectedActivity.ON_BICYCLE: driveScore += c; break;
                    case DetectedActivity.STILL: stillScore += c; break;
                    default: break;
                }
            }
        }

        if (total > 100) {
            walkScore = walkScore * 100 / total;
            runScore = runScore * 100 / total;
            driveScore = driveScore * 100 / total;
            stillScore = stillScore * 100 / total;
        }

        String scoreLabel = "drive=" + driveScore + ",run=" + runScore
            + ",walk=" + walkScore + ",still=" + stillScore;

        if (driveScore >= 35 && driveScore >= runScore && driveScore >= walkScore)
            return new Classification("DRIVING", driveScore, scoreLabel);
        if (runScore >= 25 && runScore > walkScore)
            return new Classification("RUNNING", runScore, scoreLabel);
        if (walkScore >= 25 && walkScore >= runScore)
            return new Classification("WALKING", walkScore, scoreLabel);
        if (stillScore >= 50)
            return new Classification("STILL", stillScore, scoreLabel);

        if (mostProbable != null) {
            String fallbackType = mapType(mostProbable.getType());
            if ("UNKNOWN".equals(fallbackType)) {
                int best = Math.max(Math.max(driveScore, runScore), Math.max(walkScore, stillScore));
                if (best > 0) {
                    if (driveScore == best) return new Classification("DRIVING", best, scoreLabel + ",fallback=score");
                    if (runScore == best) return new Classification("RUNNING", best, scoreLabel + ",fallback=score");
                    if (walkScore == best) return new Classification("WALKING", best, scoreLabel + ",fallback=score");
                    if (stillScore == best) return new Classification("STILL", best, scoreLabel + ",fallback=score");
                }
            }
            return new Classification(fallbackType, mostProbable.getConfidence(), mapRawType(mostProbable.getType()));
        }
        return new Classification("UNKNOWN", 0, "none");
    }

    private String mapType(int type) {
        switch (type) {
            case DetectedActivity.IN_VEHICLE:
            case DetectedActivity.ON_BICYCLE: return "DRIVING";
            case DetectedActivity.ON_FOOT:
            case DetectedActivity.WALKING: return "WALKING";
            case DetectedActivity.RUNNING: return "RUNNING";
            case DetectedActivity.STILL: return "STILL";
            default: return "UNKNOWN";
        }
    }

    private String mapRawType(int type) {
        switch (type) {
            case DetectedActivity.IN_VEHICLE: return "IN_VEHICLE";
            case DetectedActivity.ON_BICYCLE: return "ON_BICYCLE";
            case DetectedActivity.ON_FOOT: return "ON_FOOT";
            case DetectedActivity.WALKING: return "WALKING";
            case DetectedActivity.RUNNING: return "RUNNING";
            case DetectedActivity.STILL: return "STILL";
            case DetectedActivity.TILTING: return "TILTING";
            default: return "UNKNOWN_RAW";
        }
    }

    private void notifyActivityDetected(Context context, String type, int confidence, String debugLabel) {
        createChannel(context);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
               != PackageManager.PERMISSION_GRANTED) {
            ActivityRecognitionDebug.markError(context, "POST_NOTIFICATIONS not granted");
            return;
        }
        String base = type + " (" + confidence + "%) | " + debugLabel;
        if (hasLocationPermission(context)) {
            LocationServices.getFusedLocationProviderClient(context)
                .getLastLocation()
                .addOnSuccessListener(location -> {
                    String content = location != null
                        ? base + " | " + String.format("%.5f, %.5f", location.getLatitude(), location.getLongitude())
                        : base;
                    postNotification(context, content);
                })
                .addOnFailureListener(e -> postNotification(context, base));
            return;
        }
        postNotification(context, base);
    }

    private boolean hasLocationPermission(Context context) {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void postNotification(Context context, String contentText) {
        Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentTitle("Activity detected")
            .setContentText(contentText)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setOnlyAlertOnce(true)
            .setAutoCancel(true)
            .build();
        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification);
    }

    private void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "QIPZ Activity", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("Notifications for detected activity state changes");
        manager.createNotificationChannel(channel);
    }

    private static class Classification {
        final String type;
        final int confidence;
        final String debugLabel;

        Classification(String type, int confidence, String debugLabel) {
            this.type = type;
            this.confidence = Math.max(0, Math.min(100, confidence));
            this.debugLabel = debugLabel;
        }
    }
}
