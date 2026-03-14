package com.qipz.activityrecognition;

import android.location.Location;

/**
 * Converts a stream of GPS fixes (received while activity=STILL) into
 * discrete place-visit events using a simple centroid + radius clustering
 * approach similar to what Google Timeline uses internally.
 *
 * Algorithm:
 *   1. Accept each new fix while STILL.
 *   2. Maintain a running centroid of all accepted fixes.
 *   3. If the new fix is within CLUSTER_RADIUS_M of the centroid → extend
 *      the current stay, update centroid.
 *   4. If the new fix drifts beyond CLUSTER_RADIUS_M → the device has moved;
 *      flush the completed stay visit.
 *   5. When activity leaves STILL → flush any open stay.
 *
 * Flushing produces a {@link StayVisit} that the caller can persist and
 * surface through the timeline API.
 */
public final class StayPointDetector {

    /** Minimum stay duration to record as a place visit (ms). */
    private static final long MIN_STAY_DURATION_MS = 3 * 60 * 1000L;   // 3 min

    /** Maximum stay gap before splitting into two separate visits (ms). */
    private static final long MAX_STAY_GAP_MS = 10 * 60 * 1000L;       // 10 min

    /**
     * GPS fixes within this radius of the running centroid are considered
     * part of the same stay (metres).
     */
    static final float CLUSTER_RADIUS_M = 80f;

    // Running state
    private double sumLat = 0;
    private double sumLng = 0;
    private int    fixCount = 0;
    private long   stayStartMs = 0;
    private long   lastFixMs   = 0;
    private float  bestAccuracy = Float.MAX_VALUE;

    public StayPointDetector() {}

    /**
     * Feed a new GPS fix while the device is STILL.
     *
     * @return A completed {@link StayVisit} if this fix ended the stay (drift
     *         detected), or {@code null} if the stay is still open.
     */
    public StayVisit onLocationWhileStill(Location location) {
        if (location == null) return null;

        long nowMs = location.getTime() > 0 ? location.getTime() : System.currentTimeMillis();
        float acc  = location.hasAccuracy() ? location.getAccuracy() : 999f;

        if (acc > 80f) return null; // ignore inaccurate fixes

        // No stay open yet → start one
        if (fixCount == 0) {
            sumLat       = location.getLatitude();
            sumLng       = location.getLongitude();
            fixCount     = 1;
            stayStartMs  = nowMs;
            lastFixMs    = nowMs;
            bestAccuracy = acc;
            return null;
        }

        // Gap too long → flush old stay, start fresh
        if (nowMs - lastFixMs > MAX_STAY_GAP_MS) {
            StayVisit flushed = buildVisit(lastFixMs);
            reset();
            sumLat      = location.getLatitude();
            sumLng      = location.getLongitude();
            fixCount    = 1;
            stayStartMs = nowMs;
            lastFixMs   = nowMs;
            bestAccuracy = acc;
            return flushed;
        }

        double centLat = sumLat / fixCount;
        double centLng = sumLng / fixCount;
        float  dist    = distanceMeters(centLat, centLng, location.getLatitude(), location.getLongitude());

        if (dist > CLUSTER_RADIUS_M) {
            // Significant drift → end current stay
            StayVisit flushed = buildVisit(nowMs);
            reset();
            return flushed;
        }

        // Within cluster → extend stay
        sumLat    += location.getLatitude();
        sumLng    += location.getLongitude();
        fixCount  ++;
        lastFixMs  = nowMs;
        if (acc < bestAccuracy) bestAccuracy = acc;
        return null;
    }

    /**
     * Call when the device leaves STILL (starts moving) or when the plugin
     * stops. Flushes any open stay.
     *
     * @param endMs end timestamp in ms
     * @return A {@link StayVisit} if one was open, or {@code null}.
     */
    public StayVisit onActivityLeft(long endMs) {
        if (fixCount == 0) return null;
        StayVisit visit = buildVisit(endMs);
        reset();
        return visit;
    }

    public boolean hasOpenStay() {
        return fixCount > 0;
    }

    public void resetFull() {
        reset();
    }

    // ─────────────────────────────────────────────────────────────────────────

    private StayVisit buildVisit(long endMs) {
        if (fixCount == 0) return null;
        long duration = endMs - stayStartMs;
        if (duration < MIN_STAY_DURATION_MS) return null;
        double lat = sumLat / fixCount;
        double lng = sumLng / fixCount;
        return new StayVisit(lat, lng, bestAccuracy, stayStartMs, endMs, fixCount);
    }

    private void reset() {
        sumLat      = 0;
        sumLng      = 0;
        fixCount    = 0;
        stayStartMs = 0;
        lastFixMs   = 0;
        bestAccuracy = Float.MAX_VALUE;
    }

    private static float distanceMeters(double lat1, double lng1, double lat2, double lng2) {
        final double R = 6_371_000.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a    = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                    + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                    * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return (float) (R * 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a)));
    }

    // ─────────────────────────────────────────────────────────────────────────

    /** Immutable result of a completed stay at one location. */
    public static final class StayVisit {
        public final double lat;
        public final double lng;
        public final float  accuracy;
        public final long   arrivalMs;
        public final long   departureMs;
        public final int    fixCount;

        StayVisit(double lat, double lng, float accuracy,
                  long arrivalMs, long departureMs, int fixCount) {
            this.lat          = lat;
            this.lng          = lng;
            this.accuracy     = accuracy;
            this.arrivalMs    = arrivalMs;
            this.departureMs  = departureMs;
            this.fixCount     = fixCount;
        }

        public long durationMs() {
            return departureMs - arrivalMs;
        }
    }
}
