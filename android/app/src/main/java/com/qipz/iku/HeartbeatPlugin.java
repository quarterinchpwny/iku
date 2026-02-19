package com.qipz.iku;

import android.Manifest;
import android.os.Build;
import android.content.Intent;
import com.getcapacitor.PermissionState;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;

@CapacitorPlugin(
  name = "Heartbeat",
  permissions = {
    @Permission(
      alias = "location",
      strings = {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}
    ),
    @Permission(alias = "backgroundLocation", strings = {Manifest.permission.ACCESS_BACKGROUND_LOCATION}),
    @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS}),
    @Permission(alias = "activityRecognition", strings = {Manifest.permission.ACTIVITY_RECOGNITION})
  }
)
public class HeartbeatPlugin extends Plugin {
  private Integer pendingStartIntervalMinutes;

  @PluginMethod
  public void start(PluginCall call) {
    int intervalMinutes = call.getInt("intervalMinutes", 60);
    if (requestStartPermissionsIfNeeded(call, intervalMinutes)) {
      return;
    }
    startHeartbeat(intervalMinutes);
    call.resolve(statusObject());
  }

  @PluginMethod
  public void requestStartPermissions(PluginCall call) {
    if (requestStartPermissionsIfNeeded(call, null)) {
      return;
    }
    call.resolve(statusObject());
  }

  @PluginMethod
  public void checkStartPermissions(PluginCall call) {
    List<String> missing = buildMissingStartPermissions();
    JSObject ret = statusObject();
    ret.put("missingPermissions", new JSONArray(missing));
    ret.put("canStart", missing.isEmpty());
    call.resolve(ret);
  }

  @PermissionCallback
  private void onStartPermissionsResult(PluginCall call) {
    List<String> stillMissing = buildMissingStartPermissions();
    if (!stillMissing.isEmpty()) {
      pendingStartIntervalMinutes = null;
      JSObject ret = statusObject();
      ret.put("canStart", false);
      ret.put("missingPermissions", new JSONArray(stillMissing));
      ret.put("permissionError", "Missing required permissions: " + joinPermissions(stillMissing));
      call.resolve(ret);
      return;
    }

    if (pendingStartIntervalMinutes != null) {
      startHeartbeat(pendingStartIntervalMinutes);
      pendingStartIntervalMinutes = null;
    }
    call.resolve(statusObject());
  }

  private boolean requestStartPermissionsIfNeeded(PluginCall call, Integer intervalMinutes) {
    List<String> missing = buildMissingStartPermissions();
    if (missing.isEmpty()) {
      return false;
    }

    if (intervalMinutes != null) {
      pendingStartIntervalMinutes = intervalMinutes;
    }
    requestPermissionForAliases(missing.toArray(new String[0]), call, "onStartPermissionsResult");
    return true;
  }

  private List<String> buildMissingStartPermissions() {
    List<String> missing = new ArrayList<>();
    if (getPermissionState("location") != PermissionState.GRANTED) {
      missing.add("location");
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
      && getPermissionState("backgroundLocation") != PermissionState.GRANTED) {
      missing.add("backgroundLocation");
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
      && getPermissionState("notifications") != PermissionState.GRANTED) {
      missing.add("notifications");
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
      && getPermissionState("activityRecognition") != PermissionState.GRANTED) {
      missing.add("activityRecognition");
    }
    return missing;
  }

  private String joinPermissions(List<String> permissions) {
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < permissions.size(); i++) {
      if (i > 0) {
        sb.append(", ");
      }
      sb.append(permissions.get(i));
    }
    return sb.toString();
  }

  private void startHeartbeat(int intervalMinutes) {
    HeartbeatScheduler.enable(getContext(), intervalMinutes);
    Intent serviceIntent = new Intent(getContext(), HeartbeatService.class);
    serviceIntent.setAction(HeartbeatService.INTENT_ACTION_SEND_LOCATION_USER);
    ContextCompat.startForegroundService(getContext(), serviceIntent);
  }

  @PluginMethod
  public void stop(PluginCall call) {
    HeartbeatScheduler.disable(getContext());

    call.resolve(statusObject());
  }

  @PluginMethod
  public void status(PluginCall call) {
    JSObject ret = statusObject();
    List<String> missing = buildMissingStartPermissions();
    ret.put("canStart", missing.isEmpty());
    ret.put("missingPermissions", new JSONArray(missing));
    call.resolve(ret);
  }

  @PluginMethod
  public void runNow(PluginCall call) {
    Intent serviceIntent = new Intent(getContext(), HeartbeatService.class);
    serviceIntent.setAction(HeartbeatService.INTENT_ACTION_SEND_LOCATION_USER);
    ContextCompat.startForegroundService(getContext(), serviceIntent);
    call.resolve(statusObject());
  }

  @PluginMethod
  public void clearDebug(PluginCall call) {
    HeartbeatDebug.clear(getContext());
    call.resolve(statusObject());
  }

  @PluginMethod
  public void requestExactAlarmPermission(PluginCall call) {
    HeartbeatScheduler.requestExactAlarmPermission(getContext());
    call.resolve(statusObject());
  }

  @PluginMethod
  public void setMonitoringMode(PluginCall call) {
    Integer modeValue = call.getInt("mode");
    if (modeValue == null) {
      call.reject("mode is required");
      return;
    }
    HeartbeatScheduler.setMonitoringMode(getContext(), MonitoringMode.fromValue(modeValue));
    call.resolve(statusObject());
  }

  @PluginMethod
  public void cycleMonitoringMode(PluginCall call) {
    HeartbeatScheduler.cycleMonitoringMode(getContext());
    call.resolve(statusObject());
  }

  @PluginMethod
  public void enqueueTransition(PluginCall call) {
    String event = call.getString("event", "enter");
    String description = call.getString("description", "");
    Double lat = call.getDouble("lat");
    Double lng = call.getDouble("lng");
    Double accuracy = call.getDouble("accuracy");

    if (lat == null || lng == null) {
      call.reject("lat and lng are required");
      return;
    }

    HeartbeatService.enqueueTransitionEvent(
      getContext(),
      event,
      description,
      lat,
      lng,
      accuracy == null ? 0d : accuracy
    );
    call.resolve(statusObject());
  }

  private JSObject statusObject() {
    HeartbeatQueueStore queueStore = new HeartbeatQueueStore(getContext());
    JSObject ret = new JSObject();
    ret.put("enabled", HeartbeatScheduler.isEnabled(getContext()));
    ret.put("intervalMinutes", HeartbeatScheduler.getIntervalMinutes(getContext()));
    ret.put("monitoringMode", HeartbeatScheduler.getMonitoringMode(getContext()).getValue());
    ret.put("exactAlarmGranted", HeartbeatScheduler.canScheduleExactAlarms(getContext()));
    ret.put("pendingQueueCount", queueStore.countPending());
    ret.put("lastScheduledAt", HeartbeatDebug.getLong(getContext(), HeartbeatDebug.Keys.LAST_SCHEDULED_AT));
    ret.put("lastAlarmAt", HeartbeatDebug.getLong(getContext(), HeartbeatDebug.Keys.LAST_ALARM_AT));
    ret.put("lastServiceStartAt", HeartbeatDebug.getLong(getContext(), HeartbeatDebug.Keys.LAST_SERVICE_START_AT));
    ret.put("lastLocationAt", HeartbeatDebug.getLong(getContext(), HeartbeatDebug.Keys.LAST_LOCATION_AT));
    ret.put("lastUploadAt", HeartbeatDebug.getLong(getContext(), HeartbeatDebug.Keys.LAST_UPLOAD_AT));
    ret.put("lastUploadCode", HeartbeatDebug.getInt(getContext(), HeartbeatDebug.Keys.LAST_UPLOAD_CODE));
    ret.put("lastError", HeartbeatDebug.getString(getContext(), HeartbeatDebug.Keys.LAST_ERROR));
    ret.put("lastReason", HeartbeatDebug.getString(getContext(), HeartbeatDebug.Keys.LAST_REASON));
    ret.put("lastLat", HeartbeatDebug.getString(getContext(), HeartbeatDebug.Keys.LAST_LAT));
    ret.put("lastLng", HeartbeatDebug.getString(getContext(), HeartbeatDebug.Keys.LAST_LNG));
    ret.put("lastHealthAlertAt", HeartbeatDebug.getLong(getContext(), HeartbeatDebug.Keys.LAST_HEALTH_ALERT_AT));
    return ret;
  }
}
