package com.qipz.activityrecognition;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class ActivityGeofenceEngine {
    private static final double EARTH_RADIUS_M = 6_371_000.0;
    private static final double EXIT_BUFFER_M = 20.0;

    private ActivityGeofenceEngine() {}

    public static List<GeofenceTransition> evaluate(Context context, double lat, double lng, long nowMs) {
        JSONArray geofences = ActivityRecognitionDebug.getGeofences(context);
        List<GeofenceTransition> transitions = new ArrayList<>();
        boolean changed = false;

        for (int i = 0; i < geofences.length(); i++) {
            JSONObject row = geofences.optJSONObject(i);
            if (row == null) continue;

            String id = String.valueOf(row.opt("id")).trim();
            String name = row.optString("name", "").trim();
            double centerLat = row.optDouble("lat", Double.NaN);
            double centerLng = row.optDouble("lng", Double.NaN);
            double radius = row.optDouble("radius", Double.NaN);
            boolean enabled = row.optBoolean("enabled", true);

            if (!enabled) continue;
            if (id.isEmpty() || name.isEmpty()) continue;
            if (!Double.isFinite(centerLat) || !Double.isFinite(centerLng) || !Double.isFinite(radius)) continue;
            if (radius < 25 || radius > 5000) continue;

            String lastState = row.optString("lastState", "outside");
            boolean wasInside = "inside".equalsIgnoreCase(lastState);
            double distance = distanceMeters(lat, lng, centerLat, centerLng);
            boolean nextInside = wasInside ? distance <= (radius + EXIT_BUFFER_M) : distance <= radius;

            if (nextInside != wasInside) {
                try {
                    row.put("lastState", nextInside ? "inside" : "outside");
                    row.put("lastTransitionAt", nowMs);
                    changed = true;
                    transitions.add(new GeofenceTransition(
                        id,
                        name,
                        nextInside ? "ENTER" : "EXIT",
                        lat,
                        lng,
                        distance
                    ));
                } catch (Exception ignored) {
                }
            }
        }

        if (changed) {
            ActivityRecognitionDebug.setGeofences(context, geofences);
        }
        return transitions;
    }

    private static double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0)
            + Math.cos(Math.toRadians(lat1))
            * Math.cos(Math.toRadians(lat2))
            * Math.sin(dLng / 2.0)
            * Math.sin(dLng / 2.0);
        return EARTH_RADIUS_M * 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
    }

    public static final class GeofenceTransition {
        public final String id;
        public final String name;
        public final String transition;
        public final double lat;
        public final double lng;
        public final double distanceMeters;

        GeofenceTransition(
            String id,
            String name,
            String transition,
            double lat,
            double lng,
            double distanceMeters
        ) {
            this.id = id;
            this.name = name;
            this.transition = transition;
            this.lat = lat;
            this.lng = lng;
            this.distanceMeters = distanceMeters;
        }

        public String contentText() {
            return String.format(
                Locale.US,
                "%s %s (%.5f, %.5f)",
                transition.equals("ENTER") ? "Entered" : "Exited",
                name,
                lat,
                lng
            );
        }
    }
}
