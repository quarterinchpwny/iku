package com.qipz.heartbeat;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

public class BootReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    String action = intent != null ? intent.getAction() : null;
    if (Intent.ACTION_BOOT_COMPLETED.equals(action)
      || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
      || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)) {
      HeartbeatScheduler.rescheduleIfEnabled(context);
      if (HeartbeatScheduler.isEnabled(context)) {
        Intent serviceIntent = new Intent(context, HeartbeatService.class);
        serviceIntent.setAction(action);
        ContextCompat.startForegroundService(context, serviceIntent);
      }
    }
  }
}
