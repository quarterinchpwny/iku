package com.qipz.activityrecognition;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class ActivityRecognitionHealthReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (!ActivityRecognitionWatchdog.ACTION_HEALTH_CHECK.equals(action)) {
            return;
        }
        ActivityRecognitionWatchdog.onAlarm(context);
    }
}
