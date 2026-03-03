package com.qipz.activityrecognition;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public final class ActivityRecognitionWatchdog {
    static final String ACTION_HEALTH_CHECK = "com.qipz.activityrecognition.ACTION_HEALTH_CHECK";
    private static final int REQUEST_CODE =
        ("qipz.watchdog".hashCode() & 0x7FFFFFFF) % 65536;
    private static final long INTERVAL_MS = 30L * 60L * 1000L;
    private static final long STALE_EVENT_MS = 2L * 60L * 60L * 1000L;
    private static final long STALE_START_MS = 15L * 60L * 1000L;

    private ActivityRecognitionWatchdog() {}

    static void schedule(Context context, String reason) {
        AlarmManager alarmManager = context.getSystemService(AlarmManager.class);
        if (alarmManager == null) return;
        long triggerAt = System.currentTimeMillis() + INTERVAL_MS;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent(context));
        } else {
            alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent(context));
        }
        ActivityRecognitionNotifier.debug(context, "watchdog_scheduled: " + reason);
    }

    static void cancel(Context context) {
        AlarmManager alarmManager = context.getSystemService(AlarmManager.class);
        if (alarmManager == null) return;
        alarmManager.cancel(pendingIntent(context));
        ActivityRecognitionNotifier.debug(context, "watchdog_cancelled");
    }

    static void onAlarm(Context context) {
        if (!ActivityRecognitionDebug.isEnabled(context)) {
            cancel(context);
            return;
        }
        long now = System.currentTimeMillis();
        long lastEventAt = ActivityRecognitionDebug.getLastEventAt(context);
        long lastStartAt = ActivityRecognitionDebug.getLastStartAt(context);

        boolean staleNoEvents = lastEventAt <= 0 && lastStartAt > 0 && (now - lastStartAt) > STALE_START_MS;
        boolean staleEvents = lastEventAt > 0 && (now - lastEventAt) > STALE_EVENT_MS;

        if (staleNoEvents || staleEvents) {
            ActivityRecognitionNotifier.debug(
                context,
                "watchdog_recover staleNoEvents=" + staleNoEvents + " staleEvents=" + staleEvents
            );
            ActivityRecognitionPlugin.recoverIfEnabled(context);
        }

        String lastType = ActivityRecognitionDebug.getLastType(context);
        LocationForegroundService.onActivityChanged(context, lastType);
        schedule(context, "alarm");
    }

    private static PendingIntent pendingIntent(Context context) {
        Intent intent = new Intent(context, ActivityRecognitionHealthReceiver.class);
        intent.setAction(ACTION_HEALTH_CHECK);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(context, REQUEST_CODE, intent, flags);
    }
}
