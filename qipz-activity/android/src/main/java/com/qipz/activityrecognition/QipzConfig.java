package com.qipz.activityrecognition;

import java.util.concurrent.TimeUnit;

public final class QipzConfig {
    public static final String API_URL = "https://iku.quarterinchpwny.online/api/location/sync";

    // ── Upload / queue ────────────────────────────────────────────────────────
    /** How many queue items to drain in a single worker run. */
    public static final int  MAX_BATCH_PER_RUN        = 20;
    /** Maximum number of location rows bundled into a single HTTP POST. */
    public static final int  MAX_UPLOAD_BATCH_SIZE    = 20;
    public static final int  MAX_QUEUE_ATTEMPTS       = 10;
    public static final int  MAX_QUEUE_SIZE           = 200;
    public static final long LOCATION_ITEM_TTL_MS     = TimeUnit.HOURS.toMillis(24);
    public static final long MAX_ITEM_AGE_MS          = TimeUnit.DAYS.toMillis(3);
    public static final int  CONNECT_TIMEOUT_MS       = 10_000;
    public static final int  READ_TIMEOUT_MS          = 15_000;
    public static final int  MAX_CONSECUTIVE_FAILURES = 5;
    public static final long CIRCUIT_BREAKER_DURATION_MS = TimeUnit.MINUTES.toMillis(30);

    // ── Location quality ──────────────────────────────────────────────────────
    /** Drop GPS fixes whose accuracy radius exceeds this value (metres). */
    public static final float MAX_ACCURACY_METERS     = 100f;

    /** Minimum displacement before a new point is recorded (metres). */
    public static final float MIN_DISPLACEMENT_METERS = 5f;

    /**
     * Suppress a point when the device reports near-zero speed while DRIVING.
     * Avoids recording GPS drift at red lights / parking.
     * 0.2 m/s ≈ 0.7 km/h
     */
    public static final float MIN_DRIVING_SPEED_MPS   = 0.2f;

    // ── Still / periodic sync intervals ──────────────────────────────────────
    public static final long STILL_SYNC_INTERVAL  = TimeUnit.MINUTES.toMillis(5);
    public static final long UNKNOWN_SYNC_INTERVAL = TimeUnit.MINUTES.toMillis(20);

    // ── Location request parameters (per activity) ────────────────────────────
    public static final long  DRIVING_INTERVAL_MS      = 4_000L;
    public static final long  DRIVING_MIN_INTERVAL_MS  = 3_000L;
    public static final float DRIVING_MIN_DISTANCE_M   = 5f;

    public static final long  RUNNING_INTERVAL_MS      = 12_000L;
    public static final long  RUNNING_MIN_INTERVAL_MS  = 8_000L;
    public static final float RUNNING_MIN_DISTANCE_M   = 15f;

    public static final long  WALKING_INTERVAL_MS      = 5_000L;
    public static final long  WALKING_MIN_INTERVAL_MS  = 3_000L;
    public static final float WALKING_MIN_DISTANCE_M   = 5f;

    /**
     * STILL uses PRIORITY_PASSIVE + a 50 m distance filter so the OS only
     * wakes the app when the device has meaningfully moved — same approach
     * used by Life360 / OwnTracks for battery-efficient idle tracking.
     */
    public static final long  STILL_INTERVAL_MS        = 300_000L;
    public static final long  STILL_MIN_INTERVAL_MS    = 180_000L;
    public static final float STILL_MIN_DISTANCE_M     = 50f;

    public static final long  UNKNOWN_INTERVAL_MS      = 60_000L;
    public static final long  UNKNOWN_MIN_INTERVAL_MS  = 30_000L;
    public static final float UNKNOWN_MIN_DISTANCE_M   = 30f;

    private QipzConfig() {}
}
