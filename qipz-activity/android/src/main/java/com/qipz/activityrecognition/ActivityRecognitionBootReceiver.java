package com.qipz.activityrecognition;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Restores Activity Recognition subscriptions after reboot/app update.
 * Location service startup is now event-driven from ActivityRecognitionReceiver.
 */
public class ActivityRecognitionBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {

            if (!ActivityRecognitionDebug.isEnabled(context)) {
                return; // plugin was not started by the user; do nothing
            }

            // Re-register activity recognition updates + transitions.
            ActivityRecognitionPlugin.triggerRecover(context, "boot");
            ActivityRecognitionWatchdog.schedule(context, "boot");
        }
    }
}
