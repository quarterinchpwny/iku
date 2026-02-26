package com.qipz.activityrecognition;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Restores both the Activity Recognition subscription AND the location
 * foreground service after a device reboot or app update.
 *
 * Previously only {@link LocationForegroundService} was restarted, which meant
 * location tracking ran but no activity events arrived to drive it (because
 * the AR transition/update registrations were lost).  Now we call
 * {@link ActivityRecognitionPlugin#recoverIfEnabled} first, which re-registers
 * both the update and transition PendingIntents before starting the service.
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

            // 1. Re-register activity recognition updates + transitions.
            //    This is the fix for the boot-recovery gap: without this call
            //    the service starts but receives no activity type changes.
            ActivityRecognitionPlugin.recoverIfEnabled(context);

            // 2. (Re-)start the location foreground service.
            //    recoverIfEnabled() already calls this on success, but we also
            //    call it here so location resumes even if the AR client callback
            //    hasn't fired yet (e.g. slow GMS init on some devices).
            LocationForegroundService.start(context);
        }
    }
}