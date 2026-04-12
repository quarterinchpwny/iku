package com.qipz.activityrecognition;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.location.Location;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Stores enriched trip records that go beyond the basic tripId/duration
 * summary already in the codebase. Each row captures:
 *   - Total distance travelled (metres)
 *   - Mode breakdown (% walking / driving / running / cycling)
 *   - Simplified path (start + end + up to N waypoints)
 *   - Start and end place-visit IDs (nullable) for timeline stitching
 *
 * This is what lets the JS layer render a Google-Timeline-style day view:
 * alternating place-visit cards and trip cards with mode icons and distances.
 */
public final class TripStatisticsStore {

    static final String TABLE = "trip_statistics";

    /** Maximum waypoints stored per trip (start + N intermediates + end). */
    private static final int MAX_WAYPOINTS = 20;

    private TripStatisticsStore() {}

    // ── Schema ────────────────────────────────────────────────────────────────

    public static void createTable(SQLiteDatabase db) {
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS " + TABLE + " ("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "trip_id TEXT NOT NULL UNIQUE,"
                + "start_ms INTEGER NOT NULL,"
                + "end_ms INTEGER NOT NULL,"
                + "duration_ms INTEGER NOT NULL,"
                + "distance_m REAL NOT NULL DEFAULT 0,"
                + "dominant_mode TEXT NOT NULL DEFAULT 'UNKNOWN',"
                + "pct_walking INTEGER NOT NULL DEFAULT 0,"
                + "pct_running INTEGER NOT NULL DEFAULT 0,"
                + "pct_driving INTEGER NOT NULL DEFAULT 0,"
                + "pct_cycling INTEGER NOT NULL DEFAULT 0,"
                + "waypoints_json TEXT NOT NULL DEFAULT '[]',"  // JSON array of {lat,lng}
                + "start_place_id INTEGER,"    // FK → place_visits.id (nullable)
                + "end_place_id INTEGER,"      // FK → place_visits.id (nullable)
                + "uploaded_at INTEGER"
                + ")"
        );
        db.execSQL(
            "CREATE INDEX IF NOT EXISTS idx_trip_stats_start ON "
                + TABLE + "(start_ms)"
        );
    }

    // ── Builder (used during a live trip) ─────────────────────────────────────

    /**
     * Mutable builder accumulated in memory during a trip. Commit with
     * {@link #flush(SQLiteDatabase)} when the trip ends.
     */
    public static final class TripBuilder {
        private final String tripId;
        private final long startMs;

        // Mode accumulation (seconds in each mode)
        private long secsWalking  = 0;
        private long secsRunning  = 0;
        private long secsDriving  = 0;
        private long secsCycling  = 0;
        private String lastMode   = "UNKNOWN";
        private long lastModeAt   = 0;

        // Distance accumulation
        private double distanceM  = 0;
        private Location lastLoc  = null;

        // Waypoint downsampling (reservoir-sample approach)
        private final List<double[]> waypoints = new ArrayList<>(); // [lat, lng]
        private int totalFixesSeen = 0;

        public TripBuilder(String tripId, long startMs) {
            this.tripId  = tripId;
            this.startMs = startMs;
            this.lastModeAt = startMs;
        }

        /** Feed each accepted GPS fix during the trip. */
        public void onLocation(Location loc, String activityMode) {
            if (loc == null) return;
            totalFixesSeen++;

            // Distance
            if (lastLoc != null) {
                distanceM += lastLoc.distanceTo(loc);
            }
            lastLoc = loc;

            // Mode accumulation
            long nowMs = loc.getTime() > 0 ? loc.getTime() : System.currentTimeMillis();
            if (!activityMode.equals(lastMode) && lastModeAt > 0) {
                accumulateMode(lastMode, (nowMs - lastModeAt) / 1000L);
            }
            lastMode   = activityMode;
            lastModeAt = nowMs;

            // Reservoir sampling: keep at most MAX_WAYPOINTS evenly distributed fixes
            if (waypoints.size() < MAX_WAYPOINTS) {
                waypoints.add(new double[]{loc.getLatitude(), loc.getLongitude()});
            } else {
                // Replace a random earlier waypoint (skip first and last slots)
                int replaceIdx = 1 + (int) (Math.random() * (MAX_WAYPOINTS - 2));
                waypoints.set(replaceIdx, new double[]{loc.getLatitude(), loc.getLongitude()});
            }
        }

        /** Call when the trip ends. Persists the trip record and returns its db id. */
        public long flush(SQLiteDatabase db, long endMs) {
            // Flush remaining mode time
            if (lastModeAt > 0 && lastModeAt < endMs) {
                accumulateMode(lastMode, (endMs - lastModeAt) / 1000L);
            }

            long totalSecs = secsWalking + secsRunning + secsDriving + secsCycling;
            int pctW = totalSecs > 0 ? (int) (secsWalking  * 100 / totalSecs) : 0;
            int pctR = totalSecs > 0 ? (int) (secsRunning  * 100 / totalSecs) : 0;
            int pctD = totalSecs > 0 ? (int) (secsDriving  * 100 / totalSecs) : 0;
            int pctC = totalSecs > 0 ? (int) (secsCycling  * 100 / totalSecs) : 0;

            String dominant = dominantMode();

            JSONArray waypointsJson = new JSONArray();
            for (double[] wp : waypoints) {
                JSONObject pt = new JSONObject();
                try {
                    pt.put("lat", Math.round(wp[0] * 1e5) / 1e5);
                    pt.put("lng", Math.round(wp[1] * 1e5) / 1e5);
                } catch (Exception ignored) {}
                waypointsJson.put(pt);
            }

            ContentValues cv = new ContentValues();
            cv.put("trip_id",      tripId);
            cv.put("start_ms",     startMs);
            cv.put("end_ms",       endMs);
            cv.put("duration_ms",  endMs - startMs);
            cv.put("distance_m",   distanceM);
            cv.put("dominant_mode", dominant);
            cv.put("pct_walking",  pctW);
            cv.put("pct_running",  pctR);
            cv.put("pct_driving",  pctD);
            cv.put("pct_cycling",  pctC);
            cv.put("waypoints_json", waypointsJson.toString());

            return db.insertWithOnConflict(TABLE, null, cv, SQLiteDatabase.CONFLICT_REPLACE);
        }

        private void accumulateMode(String mode, long secs) {
            switch (mode) {
                case "WALKING":  secsWalking  += secs; break;
                case "RUNNING":  secsRunning  += secs; break;
                case "DRIVING":  secsDriving  += secs; break;
                case "CYCLING":  secsCycling  += secs; break;
            }
        }

        private String dominantMode() {
            long best = Math.max(Math.max(secsWalking, secsRunning),
                                 Math.max(secsDriving, secsCycling));
            if (best == 0)       return "UNKNOWN";
            if (best == secsWalking) return "WALKING";
            if (best == secsRunning) return "RUNNING";
            if (best == secsDriving) return "DRIVING";
            return "CYCLING";
        }

        public String getTripId()  { return tripId; }
        public double getDistanceM() { return distanceM; }
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    public static List<TripRecord> listTrips(SQLiteDatabase db, long fromMs, long toMs, int limit) {
        int safe = Math.max(1, Math.min(500, limit));
        List<TripRecord> rows = new ArrayList<>();
        try (Cursor c = db.query(
            TABLE,
            null,
            "start_ms >= ? AND start_ms <= ?",
            new String[]{Long.toString(fromMs), Long.toString(toMs)},
            null, null, "start_ms ASC", Integer.toString(safe)
        )) {
            while (c.moveToNext()) {
                rows.add(recordFromCursor(c));
            }
        }
        return rows;
    }

    /** Link an end place-visit to the most recent trip that ended near then. */
    public static void linkEndPlace(SQLiteDatabase db, long tripEndMs, long placeVisitId) {
        ContentValues cv = new ContentValues();
        cv.put("end_place_id", placeVisitId);
        db.update(TABLE, cv, "ABS(end_ms - ?) < 300000 AND end_place_id IS NULL",
            new String[]{Long.toString(tripEndMs)});
    }

    public static int pruneTripsOlderThan(SQLiteDatabase db, long cutoffMs) {
        return db.delete(TABLE, "end_ms < ?", new String[]{Long.toString(cutoffMs)});
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static TripRecord recordFromCursor(Cursor c) {
        return new TripRecord(
            c.getLong(c.getColumnIndexOrThrow("id")),
            c.getString(c.getColumnIndexOrThrow("trip_id")),
            c.getLong(c.getColumnIndexOrThrow("start_ms")),
            c.getLong(c.getColumnIndexOrThrow("end_ms")),
            c.getLong(c.getColumnIndexOrThrow("duration_ms")),
            c.getDouble(c.getColumnIndexOrThrow("distance_m")),
            c.getString(c.getColumnIndexOrThrow("dominant_mode")),
            c.getInt(c.getColumnIndexOrThrow("pct_walking")),
            c.getInt(c.getColumnIndexOrThrow("pct_running")),
            c.getInt(c.getColumnIndexOrThrow("pct_driving")),
            c.getInt(c.getColumnIndexOrThrow("pct_cycling")),
            c.getString(c.getColumnIndexOrThrow("waypoints_json")),
            c.isNull(c.getColumnIndexOrThrow("start_place_id")) ? null
                : c.getLong(c.getColumnIndexOrThrow("start_place_id")),
            c.isNull(c.getColumnIndexOrThrow("end_place_id")) ? null
                : c.getLong(c.getColumnIndexOrThrow("end_place_id"))
        );
    }

    // ── Record ────────────────────────────────────────────────────────────────

    public static final class TripRecord {
        public final long    id;
        public final String  tripId;
        public final long    startMs;
        public final long    endMs;
        public final long    durationMs;
        public final double  distanceM;
        public final String  dominantMode;
        public final int     pctWalking;
        public final int     pctRunning;
        public final int     pctDriving;
        public final int     pctCycling;
        public final String  waypointsJson;
        public final Long    startPlaceId;
        public final Long    endPlaceId;

        TripRecord(long id, String tripId, long startMs, long endMs, long durationMs,
                   double distanceM, String dominantMode,
                   int pctWalking, int pctRunning, int pctDriving, int pctCycling,
                   String waypointsJson, Long startPlaceId, Long endPlaceId) {
            this.id            = id;
            this.tripId        = tripId;
            this.startMs       = startMs;
            this.endMs         = endMs;
            this.durationMs    = durationMs;
            this.distanceM     = distanceM;
            this.dominantMode  = dominantMode;
            this.pctWalking    = pctWalking;
            this.pctRunning    = pctRunning;
            this.pctDriving    = pctDriving;
            this.pctCycling    = pctCycling;
            this.waypointsJson = waypointsJson == null ? "[]" : waypointsJson;
            this.startPlaceId  = startPlaceId;
            this.endPlaceId    = endPlaceId;
        }

        public JSONObject toJson() {
            JSONObject o = new JSONObject();
            try {
                o.put("id",           id);
                o.put("tripId",       tripId);
                o.put("startMs",      startMs);
                o.put("endMs",        endMs);
                o.put("durationMs",   durationMs);
                o.put("distanceM",    Math.round(distanceM));
                o.put("dominantMode", dominantMode);
                o.put("pctWalking",   pctWalking);
                o.put("pctRunning",   pctRunning);
                o.put("pctDriving",   pctDriving);
                o.put("pctCycling",   pctCycling);
                o.put("waypoints",    new JSONArray(waypointsJson));
                if (startPlaceId != null) o.put("startPlaceId", startPlaceId);
                if (endPlaceId   != null) o.put("endPlaceId",   endPlaceId);
            } catch (Exception ignored) {}
            return o;
        }
    }
}