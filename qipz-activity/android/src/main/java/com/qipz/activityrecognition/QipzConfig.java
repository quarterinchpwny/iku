package com.qipz.activityrecognition;

import java.util.concurrent.TimeUnit;

public final class QipzConfig {
    public static final String API_URL = "https://iku.quarterinchpwny.online/api/location/sync";
    public static final int MAX_BATCH_PER_RUN = 5;
    public static final int MAX_QUEUE_ATTEMPTS = 10;
    public static final int MAX_QUEUE_SIZE = 200;
    public static final long LOCATION_ITEM_TTL_MS = TimeUnit.HOURS.toMillis(24);
    public static final long MAX_ITEM_AGE_MS = TimeUnit.DAYS.toMillis(3);
    public static final long STILL_SYNC_INTERVAL = TimeUnit.MINUTES.toMillis(35);
    public static final long UNKNOWN_SYNC_INTERVAL = TimeUnit.MINUTES.toMillis(20);
    public static final int CONNECT_TIMEOUT_MS = 10_000;
    public static final int READ_TIMEOUT_MS = 15_000;
    public static final int MAX_CONSECUTIVE_FAILURES = 5;
    public static final long CIRCUIT_BREAKER_DURATION_MS = TimeUnit.MINUTES.toMillis(30);
    public static final float MIN_DISPLACEMENT_METERS = 15f;
    public static final long DRIVING_INTERVAL_MS = 8_000L;
    public static final long DRIVING_MIN_INTERVAL_MS = 5_000L;
    public static final float DRIVING_MIN_DISTANCE_M = 20f;
    public static final long RUNNING_INTERVAL_MS = 12_000L;
    public static final long RUNNING_MIN_INTERVAL_MS = 8_000L;
    public static final float RUNNING_MIN_DISTANCE_M = 15f;
    public static final long WALKING_INTERVAL_MS = 20_000L;
    public static final long WALKING_MIN_INTERVAL_MS = 15_000L;
    public static final float WALKING_MIN_DISTANCE_M = 15f;
    public static final long STILL_INTERVAL_MS = 300_000L;
    public static final long STILL_MIN_INTERVAL_MS = 180_000L;
    public static final long UNKNOWN_INTERVAL_MS = 60_000L;
    public static final long UNKNOWN_MIN_INTERVAL_MS = 30_000L;
    public static final float UNKNOWN_MIN_DISTANCE_M = 30f;

    private QipzConfig() {}
}
