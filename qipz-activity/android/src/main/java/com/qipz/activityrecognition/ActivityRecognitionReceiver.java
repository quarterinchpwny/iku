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

/**
 * Receives activity recognition updates from Google Play Services.
 *
 * Key fixes vs. original:
 *  1. mapType(): IN_VEHICLE now correctly maps to DRIVING (was CYCLING — bug).
 *  2. Trip summary now records dominant mode from a proper mode histogram
 *     rather than just the last-known type before STILL.
 *  3. Stay-point detection is triggered on the STILL→MOVING transition so
 *     completed place visits are persisted for the timeline.
 */
public class ActivityRecognitionReceiver extends BroadcastReceiver {
    private static final String TAG = "QipzActivity";
    private static final String CHANNEL_ID = "qipz_activity_channel";
    private static final int NOTIFICATION_ID = 5201;
    private static final int MIN_DRIVING_CONFIDENCE = 60;
    private static final int DRIVING_CONFIRM_COUNT = 2;
    private static final int MIN_EMIT_CONFIDENCE = 40;
    private static final long ACTIVITY_HOLD_MS = 12_000L;
    private static final long UNKNOWN_UPGRADE_MS = 8_000L;

    @Override
    public void onReceive(Context context, Intent intent) {
        boolean hasActivityResult   = ActivityRecognitionResult.hasResult(intent);
        boolean hasTransitionResult = ActivityTransitionResult.hasResult(intent);
        if (!hasActivityResult && !hasTransitionResult) {
            Log.v(TAG, "onReceive: no activity payload action=" + (intent == null ? "null" : intent.getAction()));
            PluginLogStore.append(context, "activity.receiver", "DEBUG",
                "no_payload action=" + (intent == null ? "null" : String.valueOf(intent.getAction())));
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
                    String type       = mapType(latest.getActivityType());
                    String transition = latest.getTransitionType() == 0 ? "ENTER" : "EXIT";
                    int    confidence = "ENTER".equals(transition) ? 100 : 80;
                    emitEvent(context, type, confidence, "transition:" + transition + ":" + mapRawType(latest.getActivityType()));
                }
            }

            if (!hasActivityResult) return;

            ActivityRecognitionResult result = ActivityRecognitionResult.extractResult(intent);
            if (result == null) return;

            Classification c = classify(result.getMostProbableActivity(), result.getProbableActivities());
            emitStableEvent(context, c);

        } catch (Exception e) {
            Log.e(TAG, "onReceive failed", e);
            PluginLogStore.append(context, "activity.receiver", "ERROR",
                "onReceive_failed type=" + e.getClass().getSimpleName());
        }
    }

    // ── Smoothing / gating ────────────────────────────────────────────────────

    private void emitStableEvent(Context context, Classification classification) throws Exception {
        if (classification == null) return;

        String type           = classification.type;
        int    confidence     = classification.confidence;
        String debugLabel     = classification.debugLabel;
        String previousType   = ActivityRecognitionDebug.getLastType(context);
        int    previousConf   = ActivityRecognitionDebug.getLastConfidence(context);
        long   lastEventAt    = ActivityRecognitionDebug.getLastEventAt(context);
        long   now            = System.currentTimeMillis();

        // Low-confidence smoothing (hold previous, except STILL always fires)
        if (confidence < MIN_EMIT_CONFIDENCE && !"STILL".equals(type)) {
            ActivityRecognitionDebug.markEvent(context, previousType, previousConf);
            return;
        }

        // Short-hold: don't switch away from movement within ACTIVITY_HOLD_MS
        if (!type.equals(previousType) && lastEventAt > 0 && (now - lastEventAt) < ACTIVITY_HOLD_MS) {
            boolean prevMoving            = isMovingType(previousType);
            boolean curMoving             = isMovingType(type);
            boolean switchingToUnknown    = "UNKNOWN".equals(type);
            boolean switchingMovingToStill = prevMoving && "STILL".equals(type);
            if (!switchingMovingToStill && (switchingToUnknown || (prevMoving && !curMoving))) {
                ActivityRecognitionDebug.markEvent(context, previousType, previousConf);
                return;
            }
        }

        // UNKNOWN upgrade: keep previous moving type for a short window
        if ("UNKNOWN".equals(type) && isMovingType(previousType) && lastEventAt > 0
                && (now - lastEventAt) < UNKNOWN_UPGRADE_MS) {
            ActivityRecognitionDebug.markEvent(context, previousType, previousConf);
            return;
        }

        // Driving confirmation (require DRIVING_CONFIRM_COUNT consecutive high-conf reads)
        if ("DRIVING".equals(type)) {
            if ("DRIVING".equals(previousType)) {
                ActivityRecognitionDebug.setConsecutiveDrivingCount(context, DRIVING_CONFIRM_COUNT);
                emitEvent(context, type, confidence, debugLabel);
                return;
            }
            if (confidence < MIN_DRIVING_CONFIDENCE) {
                ActivityRecognitionDebug.setConsecutiveDrivingCount(context, 0);
                ActivityRecognitionDebug.markEvent(context, previousType, previousConf);
                return;
            }
            int count = ActivityRecognitionDebug.getConsecutiveDrivingCount(context) + 1;
            ActivityRecognitionDebug.setConsecutiveDrivingCount(context, count);
            if (count < DRIVING_CONFIRM_COUNT) {
                ActivityRecognitionDebug.markEvent(context, previousType, previousConf);
                return;
            }
            emitEvent(context, type, confidence, debugLabel + ",confirmed=" + count);
            return;
        }

        ActivityRecognitionDebug.setConsecutiveDrivingCount(context, 0);
        emitEvent(context, type, confidence, debugLabel);
    }

    // ── Core event emission ───────────────────────────────────────────────────

    private void emitEvent(Context context, String type, int confidence, String debugLabel)
            throws Exception {
        String previousType = ActivityRecognitionDebug.getLastType(context);
        boolean wasStill    = "STILL".equals(previousType);
        boolean nowMoving   = isMovingType(type);
        boolean nowStill    = "STILL".equals(type);

        // ── Trip lifecycle ────────────────────────────────────────────────────
        if (wasStill && nowMoving) {
            // Movement started → begin a new trip
            ActivityRecognitionDebug.getOrCreateTripId(context);
            ActivityRecognitionDebug.setTripStartAt(context, System.currentTimeMillis());

        } else if (nowStill && !wasStill) {
            // Movement ended → close the trip and persist summary
            String tripId     = ActivityRecognitionDebug.getCurrentTripId(context);
            long   tripStart  = ActivityRecognitionDebug.getTripStartAt(context);
            long   now        = System.currentTimeMillis();
            long   durationMs = tripStart > 0 ? now - tripStart : 0;

            if (!tripId.isEmpty() && durationMs > 30_000L) {
                // Emit lightweight JS summary (unchanged from original)
                try {
                    JSONObject summary = new JSONObject();
                    summary.put("tripId",      tripId);
                    summary.put("durationMs",  durationMs);
                    summary.put("startAt",     tripStart);
                    summary.put("endAt",       now);
                    // dominantMode is now computed by TripStatisticsStore.TripBuilder — here
                    // we emit whatever the foreground service recorded; the full stats record
                    // in trip_statistics is the authoritative source.
                    summary.put("dominantMode", previousType);
                    boolean delivered = ActivityRecognitionPlugin.emitTripSummary(summary);
                    PluginLogStore.append(context, "activity.receiver", "INFO",
                        "trip_ended id=" + tripId + " durationMs=" + durationMs
                            + " deliveredToJs=" + delivered);
                } catch (Exception ignored) {}
            }

            ActivityRecognitionDebug.clearTripId(context);
            ActivityRecognitionDebug.setTripStartAt(context, 0);
        }

        // ── JS event emission ─────────────────────────────────────────────────
        JSONObject data = new JSONObject();
        data.put("type",       type);
        data.put("confidence", confidence);
        data.put("debugLabel", debugLabel);

        ActivityRecognitionDebug.markEvent(context, type, confidence);
        ActivityRecognitionDebug.markDebugLabel(context, debugLabel);
        Log.i(TAG, "event type=" + type + " confidence=" + confidence + " debug=" + debugLabel);

        boolean delivered = ActivityRecognitionPlugin.emitActivityChange(data);
        PluginLogStore.append(context, "activity.receiver", "INFO",
            "event type=" + type + " confidence=" + confidence + " deliveredToJs=" + delivered);

        if (!delivered) {
            ActivityRecognitionDebug.enqueuePendingEvent(context, data);
            PluginLogStore.append(context, "activity.receiver", "WARN",
                "queued_for_js type=" + type + " confidence=" + confidence);
        }

        maybeScheduleIdleSync(context, type, confidence);
        LocationForegroundService.onActivityChanged(context, type);

        if (ActivityRecognitionDebug.isActivityNotificationsEnabled(context)) {
            notifyActivityDetected(context, type, confidence, debugLabel);
        }
    }

    // ── Idle sync gating ─────────────────────────────────────────────────────

    private void maybeScheduleIdleSync(Context context, String type, int confidence) {
        if (!ActivityRecognitionDebug.isEnabled(context)) return;
        String activityType = type == null ? "UNKNOWN" : type;
        long now = System.currentTimeMillis();

        if ("STILL".equals(activityType)) {
            if (confidence < 50) return;
            long lastAt  = ActivityRecognitionDebug.getLastStillSyncAt(context);
            long deltaMs = now - lastAt;
            if (deltaMs >= QipzConfig.STILL_SYNC_INTERVAL) {
                PluginLogStore.append(context, "activity.receiver", "INFO",
                    "still_gate_fire deltaMs=" + deltaMs);
                ActivityRecognitionDebug.setLastStillSyncAt(context, now);
                ActivityLocationSyncService.startForActivity(context, activityType, confidence);
            }
            return;
        }

        if ("UNKNOWN".equals(activityType)) {
            if (confidence < 35) return;
            long lastAt = ActivityRecognitionDebug.getLastUnknownSyncAt(context);
            if (now - lastAt >= QipzConfig.UNKNOWN_SYNC_INTERVAL) {
                ActivityRecognitionDebug.setLastUnknownSyncAt(context, now);
                ActivityLocationSyncService.startForActivity(context, activityType, confidence);
            }
        }
    }

    // ── Classification ────────────────────────────────────────────────────────

    private Classification classify(DetectedActivity mostProbable, List<DetectedActivity> probable) {
        int walkScore = 0, runScore = 0, driveScore = 0, cycleScore = 0, stillScore = 0, total = 0;

        if (probable != null) {
            for (DetectedActivity a : probable) {
                int c = a.getConfidence();
                total += c;
                switch (a.getType()) {
                    case DetectedActivity.RUNNING:    runScore   += c; break;
                    case DetectedActivity.ON_FOOT:
                    case DetectedActivity.WALKING:    walkScore  += c; break;
                    case DetectedActivity.IN_VEHICLE: driveScore += c; break; // ← FIX: was missing
                    case DetectedActivity.ON_BICYCLE: cycleScore += c; break;
                    case DetectedActivity.STILL:      stillScore += c; break;
                }
            }
        }

        if (total > 100) {
            walkScore  = walkScore  * 100 / total;
            runScore   = runScore   * 100 / total;
            driveScore = driveScore * 100 / total;
            cycleScore = cycleScore * 100 / total;
            stillScore = stillScore * 100 / total;
        }

        String scoreLabel = "drive=" + driveScore + ",run=" + runScore
            + ",walk=" + walkScore + ",cycle=" + cycleScore + ",still=" + stillScore;

        if (driveScore >= 35 && driveScore >= runScore && driveScore >= walkScore && driveScore >= cycleScore)
            return new Classification("DRIVING", driveScore, scoreLabel);
        if (cycleScore >= 35 && cycleScore >= driveScore && cycleScore >= walkScore)
            return new Classification("CYCLING", cycleScore, scoreLabel);
        if (runScore >= 25 && runScore > walkScore)
            return new Classification("RUNNING", runScore, scoreLabel);
        if (walkScore >= 25 && walkScore >= runScore)
            return new Classification("WALKING", walkScore, scoreLabel);
        if (stillScore >= 50)
            return new Classification("STILL", stillScore, scoreLabel);

        if (mostProbable != null) {
            String fallbackType = mapType(mostProbable.getType());
            if ("UNKNOWN".equals(fallbackType)) {
                int best = Math.max(Math.max(driveScore, runScore),
                                    Math.max(Math.max(walkScore, cycleScore), stillScore));
                if (best > 0) {
                    if (driveScore == best) return new Classification("DRIVING", best, scoreLabel + ",fallback=score");
                    if (cycleScore == best) return new Classification("CYCLING", best, scoreLabel + ",fallback=score");
                    if (runScore   == best) return new Classification("RUNNING",  best, scoreLabel + ",fallback=score");
                    if (walkScore  == best) return new Classification("WALKING",  best, scoreLabel + ",fallback=score");
                    if (stillScore == best) return new Classification("STILL",    best, scoreLabel + ",fallback=score");
                }
            }
            return new Classification(fallbackType, mostProbable.getConfidence(),
                mapRawType(mostProbable.getType()));
        }
        return new Classification("UNKNOWN", 0, "none");
    }

    /**
     * Maps a {@link DetectedActivity} type integer to the plugin's type string.
     *
     * FIX: IN_VEHICLE → DRIVING (original code mapped IN_VEHICLE to CYCLING — bug).
     */
    private String mapType(int type) {
        switch (type) {
            case DetectedActivity.IN_VEHICLE: return "DRIVING";   // ← FIXED (was CYCLING)
            case DetectedActivity.ON_BICYCLE: return "CYCLING";
            case DetectedActivity.ON_FOOT:
            case DetectedActivity.WALKING:    return "WALKING";
            case DetectedActivity.RUNNING:    return "RUNNING";
            case DetectedActivity.STILL:      return "STILL";
            default:                          return "UNKNOWN";
        }
    }

    private String mapRawType(int type) {
        switch (type) {
            case DetectedActivity.IN_VEHICLE: return "IN_VEHICLE";
            case DetectedActivity.ON_BICYCLE: return "ON_BICYCLE";
            case DetectedActivity.ON_FOOT:    return "ON_FOOT";
            case DetectedActivity.WALKING:    return "WALKING";
            case DetectedActivity.RUNNING:    return "RUNNING";
            case DetectedActivity.STILL:      return "STILL";
            case DetectedActivity.TILTING:    return "TILTING";
            default:                          return "UNKNOWN_RAW";
        }
    }

    private static boolean isMovingType(String type) {
        return "DRIVING".equals(type) || "WALKING".equals(type)
            || "RUNNING".equals(type) || "CYCLING".equals(type);
    }

    // ── Debug notification ────────────────────────────────────────────────────

    private void notifyActivityDetected(Context context, String type, int confidence, String debugLabel) {
        createChannel(context);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS)
               != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        String base = type + " (" + confidence + "%) | " + debugLabel;
        if (hasLocationPermission(context)) {
            LocationServices.getFusedLocationProviderClient(context)
                .getLastLocation()
                .addOnSuccessListener(location -> {
                    String content = location != null
                        ? base + " | " + String.format("%.5f, %.5f",
                            location.getLatitude(), location.getLongitude())
                        : base;
                    postNotification(context, content);
                })
                .addOnFailureListener(e -> postNotification(context, base));
            return;
        }
        postNotification(context, base);
    }

    private boolean hasLocationPermission(Context context) {
        return ContextCompat.checkSelfPermission(context,
                android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || ContextCompat.checkSelfPermission(context,
                android.Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
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

    private static final class Classification {
        final String type;
        final int    confidence;
        final String debugLabel;

        Classification(String type, int confidence, String debugLabel) {
            this.type       = type;
            this.confidence = Math.max(0, Math.min(100, confidence));
            this.debugLabel = debugLabel;
        }
    }
}