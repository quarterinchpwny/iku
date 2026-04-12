package com.qipz.activityrecognition;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Persists place visits detected by {@link StayPointDetector} and provides
 * the frequency-based "home / work" labeling that Google Timeline and Life360
 * both use to surface meaningful places.
 *
 * Schema lives in the existing iku_activity_queue.db (added via onUpgrade).
 * Two tables:
 *   place_visits  – one row per stay visit
 *   place_labels  – user-visible label for a cluster centroid (home, work, …)
 */
public final class PlaceVisitStore {

    static final String TABLE_VISITS = "place_visits";
    static final String TABLE_LABELS = "place_labels";

    /**
     * Minimum number of distinct-day visits before a place is auto-labeled
     * as "Frequent place". Life360 uses ~5 days across 2 weeks.
     */
    private static final int AUTO_LABEL_MIN_DAYS = 5;
    private static final float LABEL_CLUSTER_RADIUS_M = 120f;

    private PlaceVisitStore() {}

    // ── Schema ────────────────────────────────────────────────────────────────

    public static void createTables(SQLiteDatabase db) {
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS " + TABLE_VISITS + " ("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "lat REAL NOT NULL,"
                + "lng REAL NOT NULL,"
                + "accuracy REAL NOT NULL DEFAULT 0,"
                + "arrival_ms INTEGER NOT NULL,"
                + "departure_ms INTEGER NOT NULL,"
                + "duration_ms INTEGER NOT NULL,"
                + "fix_count INTEGER NOT NULL DEFAULT 0,"
                + "label_id INTEGER,"          // FK → place_labels.id (nullable)
                + "uploaded_at INTEGER"
                + ")"
        );
        db.execSQL(
            "CREATE INDEX IF NOT EXISTS idx_place_visits_arrival ON "
                + TABLE_VISITS + "(arrival_ms)"
        );
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS " + TABLE_LABELS + " ("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "lat REAL NOT NULL,"
                + "lng REAL NOT NULL,"
                + "name TEXT NOT NULL DEFAULT '',"   // user-provided OR auto
                + "auto_label TEXT NOT NULL DEFAULT 'frequent',"
                + "visit_count INTEGER NOT NULL DEFAULT 0,"
                + "first_seen_ms INTEGER NOT NULL,"
                + "last_seen_ms INTEGER NOT NULL"
                + ")"
        );
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    /**
     * Persists a completed stay visit. Also runs frequency-based labeling
     * in the same transaction.
     */
    public static long insertVisit(SQLiteDatabase db, StayPointDetector.StayVisit visit) {
        if (visit == null) return -1;

        db.beginTransaction();
        try {
            // 1. Find or create a place label for this location
            long labelId = findOrCreateLabel(db, visit);

            // 2. Insert the visit
            ContentValues cv = new ContentValues();
            cv.put("lat",          visit.lat);
            cv.put("lng",          visit.lng);
            cv.put("accuracy",     visit.accuracy);
            cv.put("arrival_ms",   visit.arrivalMs);
            cv.put("departure_ms", visit.departureMs);
            cv.put("duration_ms",  visit.durationMs());
            cv.put("fix_count",    visit.fixCount);
            if (labelId > 0) cv.put("label_id", labelId);
            long id = db.insert(TABLE_VISITS, null, cv);

            db.setTransactionSuccessful();
            return id;
        } finally {
            db.endTransaction();
        }
    }

    // ── Frequency labeling ────────────────────────────────────────────────────

    /**
     * Searches existing labels within {@link #LABEL_CLUSTER_RADIUS_M} of the
     * visit centroid. If found, increments its counter; otherwise creates a
     * new one. Returns the label id.
     */
    private static long findOrCreateLabel(SQLiteDatabase db, StayPointDetector.StayVisit visit) {
        // Broad lat/lng window then precise distance filter
        double latDelta = LABEL_CLUSTER_RADIUS_M / 111_000.0;
        double lngDelta = LABEL_CLUSTER_RADIUS_M / (111_000.0 * Math.cos(Math.toRadians(visit.lat)));

        try (Cursor c = db.query(
            TABLE_LABELS,
            new String[]{"id", "lat", "lng", "visit_count"},
            "lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?",
            new String[]{
                String.valueOf(visit.lat - latDelta),
                String.valueOf(visit.lat + latDelta),
                String.valueOf(visit.lng - lngDelta),
                String.valueOf(visit.lng + lngDelta)
            },
            null, null, "visit_count DESC", "10"
        )) {
            while (c.moveToNext()) {
                long   id  = c.getLong(0);
                double lat = c.getDouble(1);
                double lng = c.getDouble(2);
                int    cnt = c.getInt(3);
                if (distanceMeters(lat, lng, visit.lat, visit.lng) <= LABEL_CLUSTER_RADIUS_M) {
                    // Update existing label
                    ContentValues cv = new ContentValues();
                    cv.put("visit_count",  cnt + 1);
                    cv.put("last_seen_ms", visit.departureMs);
                    // Upgrade auto_label once threshold is crossed
                    if (cnt + 1 >= AUTO_LABEL_MIN_DAYS) {
                        cv.put("auto_label", "frequent");
                    }
                    db.update(TABLE_LABELS, cv, "id = ?", new String[]{Long.toString(id)});
                    return id;
                }
            }
        }

        // No nearby label → create
        ContentValues cv = new ContentValues();
        cv.put("lat",          visit.lat);
        cv.put("lng",          visit.lng);
        cv.put("name",         "");
        cv.put("auto_label",   "new");
        cv.put("visit_count",  1);
        cv.put("first_seen_ms", visit.arrivalMs);
        cv.put("last_seen_ms",  visit.departureMs);
        return db.insert(TABLE_LABELS, null, cv);
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    public static List<PlaceVisitRecord> listVisits(
        SQLiteDatabase db,
        long fromMs,
        long toMs,
        int limit
    ) {
        int safe = Math.max(1, Math.min(500, limit));
        List<PlaceVisitRecord> rows = new ArrayList<>();
        try (Cursor c = db.rawQuery(
            "SELECT v.id, v.lat, v.lng, v.accuracy, v.arrival_ms, v.departure_ms, "
                + "v.duration_ms, v.fix_count, v.label_id, "
                + "COALESCE(l.name, '') as label_name, "
                + "COALESCE(l.auto_label, '') as auto_label, "
                + "COALESCE(l.visit_count, 0) as visit_count "
                + "FROM " + TABLE_VISITS + " v "
                + "LEFT JOIN " + TABLE_LABELS + " l ON l.id = v.label_id "
                + "WHERE v.arrival_ms >= ? AND v.arrival_ms <= ? "
                + "ORDER BY v.arrival_ms ASC "
                + "LIMIT ?",
            new String[]{Long.toString(fromMs), Long.toString(toMs), Integer.toString(safe)}
        )) {
            while (c.moveToNext()) {
                rows.add(new PlaceVisitRecord(
                    c.getLong(0),
                    c.getDouble(1),
                    c.getDouble(2),
                    c.getFloat(3),
                    c.getLong(4),
                    c.getLong(5),
                    c.getLong(6),
                    c.getInt(7),
                    c.isNull(8) ? null : c.getLong(8),
                    c.getString(9),
                    c.getString(10),
                    c.getInt(11)
                ));
            }
        }
        return rows;
    }

    /** Set a user-defined name on a place label. */
    public static void setLabelName(SQLiteDatabase db, long labelId, String name) {
        ContentValues cv = new ContentValues();
        cv.put("name", name == null ? "" : name.trim());
        db.update(TABLE_LABELS, cv, "id = ?", new String[]{Long.toString(labelId)});
    }

    public static int pruneVisitsBefore(SQLiteDatabase db, long cutoffMs) {
        return db.delete(TABLE_VISITS, "departure_ms < ?",
            new String[]{Long.toString(cutoffMs)});
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static float distanceMeters(double lat1, double lng1, double lat2, double lng2) {
        final double R = 6_371_000.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a    = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                    + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                    * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return (float) (R * 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a)));
    }

    // ── Record ────────────────────────────────────────────────────────────────

    public static final class PlaceVisitRecord {
        public final long    id;
        public final double  lat;
        public final double  lng;
        public final float   accuracy;
        public final long    arrivalMs;
        public final long    departureMs;
        public final long    durationMs;
        public final int     fixCount;
        public final Long    labelId;       // nullable
        public final String  labelName;     // "" if none set
        public final String  autoLabel;     // "new", "frequent", etc.
        public final int     visitCount;

        PlaceVisitRecord(long id, double lat, double lng, float accuracy,
                         long arrivalMs, long departureMs, long durationMs,
                         int fixCount, Long labelId, String labelName,
                         String autoLabel, int visitCount) {
            this.id          = id;
            this.lat         = lat;
            this.lng         = lng;
            this.accuracy    = accuracy;
            this.arrivalMs   = arrivalMs;
            this.departureMs = departureMs;
            this.durationMs  = durationMs;
            this.fixCount    = fixCount;
            this.labelId     = labelId;
            this.labelName   = labelName == null ? "" : labelName;
            this.autoLabel   = autoLabel == null ? "" : autoLabel;
            this.visitCount  = visitCount;
        }

        public JSONObject toJson() {
            JSONObject o = new JSONObject();
            try {
                o.put("id",          id);
                o.put("lat",         lat);
                o.put("lng",         lng);
                o.put("accuracy",    accuracy);
                o.put("arrivalMs",   arrivalMs);
                o.put("departureMs", departureMs);
                o.put("durationMs",  durationMs);
                o.put("fixCount",    fixCount);
                if (labelId != null) o.put("labelId", labelId);
                if (!labelName.isEmpty()) o.put("labelName", labelName);
                if (!autoLabel.isEmpty()) o.put("autoLabel", autoLabel);
                o.put("visitCount",  visitCount);
            } catch (Exception ignored) {}
            return o;
        }
    }
}