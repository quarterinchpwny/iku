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

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.google.android.gms.location.ActivityRecognitionResult;
import com.google.android.gms.location.DetectedActivity;

import java.util.List;
import org.json.JSONObject;

public class ActivityRecognitionReceiver extends BroadcastReceiver {
    private static final String CHANNEL_ID = "qipz_activity_channel";
    private static final int NOTIFICATION_ID = 5201;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ActivityRecognitionResult.hasResult(intent)) return;

        ActivityRecognitionNotifier.showProgress(context, "Updating activity state...");
        try {
            ActivityRecognitionResult result = ActivityRecognitionResult.extractResult(intent);
            if (result == null) return;

            DetectedActivity activity = result.getMostProbableActivity();
            List<DetectedActivity> probable = result.getProbableActivities();
            Classification classification = classify(activity, probable);
            String type = classification.type;
            int confidence = classification.confidence;

            JSONObject data = new JSONObject();
            data.put("type", type);
            data.put("confidence", confidence);
            data.put("debugLabel", classification.debugLabel);

            ActivityRecognitionDebug.markEvent(context, type, confidence);
            ActivityRecognitionDebug.markDebugLabel(context, classification.debugLabel);
            boolean delivered = ActivityRecognitionPlugin.emitActivityChange(data);
            if (!delivered) {
                ActivityRecognitionDebug.enqueuePendingEvent(context, data);
            }
            notifyActivityDetected(context, type, confidence, classification.debugLabel);
        } catch (Exception ignored) {
            // Ignore malformed payloads from native receiver.
        } finally {
            ActivityRecognitionNotifier.hideProgress(context);
        }
    }

    private Classification classify(DetectedActivity mostProbable, List<DetectedActivity> probable) {
        int walkScore = 0;
        int runScore = 0;
        int driveScore = 0;
        int stillScore = 0;

        if (probable != null) {
            for (DetectedActivity a : probable) {
                int c = a.getConfidence();
                switch (a.getType()) {
                    case DetectedActivity.RUNNING:
                        runScore += c;
                        break;
                    case DetectedActivity.ON_FOOT:
                    case DetectedActivity.WALKING:
                        walkScore += c;
                        break;
                    case DetectedActivity.IN_VEHICLE:
                    case DetectedActivity.ON_BICYCLE:
                        driveScore += c;
                        break;
                    case DetectedActivity.STILL:
                        stillScore += c;
                        break;
                    default:
                        break;
                }
            }
        }

        // Priority:
        // 1) Protect DRIVING first when vehicle confidence is strongest.
        // 2) RUNNING should beat WALKING when both appear.
        // 3) Fall back to STILL when still dominates.
        String scoreLabel = "drive=" + driveScore + ",run=" + runScore + ",walk=" + walkScore + ",still=" + stillScore;

        if (driveScore >= 35 && driveScore >= runScore && driveScore >= walkScore) {
            return new Classification("DRIVING", driveScore, scoreLabel);
        }
        if (runScore >= 25 && runScore > walkScore) {
            return new Classification("RUNNING", runScore, scoreLabel);
        }
        if (walkScore >= 25 && walkScore >= runScore) {
            return new Classification("WALKING", walkScore, scoreLabel);
        }
        if (stillScore >= 50) {
            return new Classification("STILL", stillScore, scoreLabel);
        }

        if (mostProbable != null) {
            String fallbackType = mapType(mostProbable.getType());
            return new Classification(fallbackType, mostProbable.getConfidence(), mapRawType(mostProbable.getType()));
        }
        return new Classification("UNKNOWN", 0, "none");
    }

    private String mapType(int type) {
        switch (type) {
            case DetectedActivity.IN_VEHICLE:
            case DetectedActivity.ON_BICYCLE:
                return "DRIVING";
            case DetectedActivity.ON_FOOT:
            case DetectedActivity.WALKING: return "WALKING";
            case DetectedActivity.RUNNING: return "RUNNING";
            case DetectedActivity.STILL:   return "STILL";
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

        Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentTitle("Activity detected")
            .setContentText(type + " (" + confidence + "%) • " + debugLabel)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setAutoCancel(true)
            .build();

        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification);
    }

    private void createChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager == null) return;
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "QIPZ Activity",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Notifications for detected activity state changes");
            manager.createNotificationChannel(channel);
        }
    }

    private static class Classification {
        final String type;
        final int confidence;
        final String debugLabel;

        Classification(String type, int confidence, String debugLabel) {
            this.type = type;
            this.confidence = confidence;
            this.debugLabel = debugLabel;
        }
    }
}
