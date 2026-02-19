package com.qipz.iku;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import androidx.core.content.ContextCompat;
import com.google.android.gms.location.LocationResult;

public class LocationWakeReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    if (!HeartbeatScheduler.isEnabled(context)) {
      return;
    }
    if (!HeartbeatScheduler.tryAcquireLocationWake(context)) {
      return;
    }

    Location movementLocation = null;
    if (LocationResult.hasResult(intent)) {
      LocationResult result = LocationResult.extractResult(intent);
      if (result != null && result.getLastLocation() != null) {
        movementLocation = result.getLastLocation();
        HeartbeatDebug.markLocation(
          context,
          movementLocation.getLatitude(),
          movementLocation.getLongitude()
        );
      }
    }

    Intent serviceIntent = new Intent(context, HeartbeatService.class);
    serviceIntent.putExtra("reason", "location");
    serviceIntent.setAction(HeartbeatService.INTENT_ACTION_LOCATION_WAKE);
    if (movementLocation != null) {
      serviceIntent.putExtra(HeartbeatService.EXTRA_LOCATION_LAT, movementLocation.getLatitude());
      serviceIntent.putExtra(HeartbeatService.EXTRA_LOCATION_LNG, movementLocation.getLongitude());
      serviceIntent.putExtra(HeartbeatService.EXTRA_LOCATION_TIME, movementLocation.getTime());
      serviceIntent.putExtra(HeartbeatService.EXTRA_LOCATION_ACCURACY, movementLocation.getAccuracy());
      serviceIntent.putExtra(HeartbeatService.EXTRA_LOCATION_PROVIDER, movementLocation.getProvider());
      if (movementLocation.hasSpeed()) {
        serviceIntent.putExtra(HeartbeatService.EXTRA_LOCATION_SPEED, movementLocation.getSpeed());
      }
      if (movementLocation.hasBearing()) {
        serviceIntent.putExtra(HeartbeatService.EXTRA_LOCATION_BEARING, movementLocation.getBearing());
      }
      if (movementLocation.hasAltitude()) {
        serviceIntent.putExtra(HeartbeatService.EXTRA_LOCATION_ALTITUDE, movementLocation.getAltitude());
      }
      serviceIntent.putExtra(HeartbeatService.EXTRA_LOCATION_IS_MOCK, movementLocation.isFromMockProvider());
    }
    ContextCompat.startForegroundService(context, serviceIntent);
  }
}
