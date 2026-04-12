package com.qipz.activityrecognition;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.List;

/**
 * SQLite helper for all qipz persistence.
 *
 * DB_VERSION history:
 *  1 – initial (activity_queue)
 *  2 – added source column
 *  3 – added passive_event_history
 *  4 – added place_visits, place_labels, trip_statistics   ← new
 */
public class ActivitySyncQueueStore extends SQLiteOpenHelper {
    private static final String DB_NAME    = "iku_activity_queue.db";
    private static final int    DB_VERSION = 5;
    private static final String TABLE      = "activity_queue";

    public static final class QueueItem {
        public final long   id;
        public final String payload;
        public final String source;
        public final int    attempts;
        public final long   createdAt;

        public QueueItem(long id, String payload, String source, int attempts, long createdAt) {
            this.id        = id;
            this.payload   = payload;
            this.source    = source;
            this.attempts  = attempts;
            this.createdAt = createdAt;
        }
    }

    public ActivitySyncQueueStore(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        createQueueTable(db);
        PassiveEventHistoryStore.createTable(db);
        PlaceVisitStore.createTables(db);       // new
        TripStatisticsStore.createTable(db);    // new
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (oldVersion < 2 && !hasColumn(db, TABLE, "source")) {
            db.execSQL("ALTER TABLE " + TABLE
                + " ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown'");
        }
        if (oldVersion < 3) {
            PassiveEventHistoryStore.createTable(db);
        }
        if (oldVersion < 4) {
            PlaceVisitStore.createTables(db);
            TripStatisticsStore.createTable(db);
        }
        if (oldVersion < 5) {
            PassiveEventHistoryStore.ensureSchema(db);
        }
    }

    // ── Queue table ───────────────────────────────────────────────────────────

    private void createQueueTable(SQLiteDatabase db) {
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS " + TABLE + " ("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "payload TEXT NOT NULL,"
                + "source TEXT NOT NULL DEFAULT 'unknown',"
                + "attempts INTEGER NOT NULL DEFAULT 0,"
                + "next_retry_at INTEGER NOT NULL DEFAULT 0,"
                + "expires_at INTEGER NOT NULL DEFAULT 0,"
                + "last_error TEXT,"
                + "created_at INTEGER NOT NULL"
                + ")"
        );
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_activity_queue_retry ON "
            + TABLE + "(next_retry_at)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_activity_queue_expires ON "
            + TABLE + "(expires_at)");
    }

    private boolean hasColumn(SQLiteDatabase db, String table, String column) {
        try (Cursor cursor = db.rawQuery("PRAGMA table_info(" + table + ")", null)) {
            while (cursor.moveToNext()) {
                if (column.equalsIgnoreCase(cursor.getString(1))) return true;
            }
        }
        return false;
    }

    // ── Enqueue ───────────────────────────────────────────────────────────────

    public long enqueue(String payload, long nowMillis, long expiresAtMillis) {
        return enqueue(payload, "unknown", nowMillis, expiresAtMillis);
    }

    public long enqueue(String payload, String source, long nowMillis, long expiresAtMillis) {
        pruneOverflow(QipzConfig.MAX_QUEUE_SIZE);
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            ContentValues values = new ContentValues();
            values.put("payload",      payload);
            values.put("source",       source == null ? "unknown" : source);
            values.put("attempts",     0);
            values.put("next_retry_at", nowMillis);
            values.put("expires_at",   Math.max(0L, expiresAtMillis));
            values.put("created_at",   nowMillis);
            long queueId = db.insert(TABLE, null, values);
            if (queueId > 0) {
                PassiveEventHistoryStore.writeFromPayload(db, queueId, payload, source, nowMillis);
            }
            db.setTransactionSuccessful();
            return queueId;
        } finally {
            db.endTransaction();
        }
    }

    // ── Queue reads / updates ─────────────────────────────────────────────────

    public List<QueueItem> getDue(long nowMillis, int limit) {
        List<QueueItem> items = new ArrayList<>();
        SQLiteDatabase db = getReadableDatabase();
        try (Cursor cursor = db.query(
            TABLE,
            new String[]{"id", "payload", "source", "attempts", "created_at"},
            "next_retry_at <= ? AND (expires_at = 0 OR expires_at >= ?)",
            new String[]{Long.toString(nowMillis), Long.toString(nowMillis)},
            null, null, "id ASC", Integer.toString(limit)
        )) {
            while (cursor.moveToNext()) {
                items.add(new QueueItem(
                    cursor.getLong(0),
                    cursor.getString(1),
                    cursor.getString(2),
                    cursor.getInt(3),
                    cursor.getLong(4)
                ));
            }
        }
        return items;
    }

    public void markSuccess(long id) {
        getWritableDatabase().delete(TABLE, "id = ?", new String[]{Long.toString(id)});
    }

    public void markUploadedSuccess(long id, long uploadedAt) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            PassiveEventHistoryStore.markUploadedForQueueItem(db, id, uploadedAt);
            db.delete(TABLE, "id = ?", new String[]{Long.toString(id)});
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    public void markFailure(long id, int attempts, long nextRetryAt, String error) {
        ContentValues values = new ContentValues();
        values.put("attempts",      attempts + 1);
        values.put("next_retry_at", nextRetryAt);
        values.put("last_error",    error == null ? "" : error);
        getWritableDatabase().update(TABLE, values, "id = ?", new String[]{Long.toString(id)});
    }

    // ── Pruning ───────────────────────────────────────────────────────────────

    public int pruneExpired(long nowMillis) {
        return getWritableDatabase().delete(TABLE,
            "expires_at > 0 AND expires_at < ?",
            new String[]{Long.toString(nowMillis)});
    }

    public int pruneDeadLetters(int maxAttempts, long oldestCreatedAtMillis) {
        return getWritableDatabase().delete(TABLE,
            "attempts >= ? OR created_at < ?",
            new String[]{Integer.toString(maxAttempts), Long.toString(oldestCreatedAtMillis)});
    }

    public void pruneOverflow(int maxItems) {
        getWritableDatabase().execSQL(
            "DELETE FROM " + TABLE + " WHERE id NOT IN "
                + "(SELECT id FROM " + TABLE + " ORDER BY created_at DESC LIMIT ?)",
            new Object[]{maxItems});
    }

    public int countPending() {
        try (Cursor cursor = getReadableDatabase().rawQuery(
            "SELECT COUNT(*) FROM " + TABLE, null)) {
            return cursor.moveToFirst() ? cursor.getInt(0) : 0;
        }
    }

    public int prunePassiveHistoryBefore(long timestampCutoff) {
        return PassiveEventHistoryStore.pruneBefore(getWritableDatabase(), timestampCutoff);
    }

    public List<PassiveEventHistoryStore.PassiveEventRecord> getPassiveEvents(
        long fromTimestamp, long toTimestamp, long cursorId, int limit
    ) {
        return PassiveEventHistoryStore.list(
            getReadableDatabase(), fromTimestamp, toTimestamp, cursorId, limit);
    }

    // ── Place visit helpers (delegates) ───────────────────────────────────────

    /**
     * Persists a completed stay visit. Call from LocationForegroundService
     * when the stay-point detector fires.
     */
    public long insertPlaceVisit(StayPointDetector.StayVisit visit) {
        return PlaceVisitStore.insertVisit(getWritableDatabase(), visit);
    }

    public List<PlaceVisitStore.PlaceVisitRecord> getPlaceVisits(
        long fromMs, long toMs, int limit
    ) {
        return PlaceVisitStore.listVisits(getReadableDatabase(), fromMs, toMs, limit);
    }

    public void setPlaceLabel(long labelId, String name) {
        PlaceVisitStore.setLabelName(getWritableDatabase(), labelId, name);
    }

    public int prunePlaceVisitsBefore(long cutoffMs) {
        return PlaceVisitStore.pruneVisitsBefore(getWritableDatabase(), cutoffMs);
    }

    // ── Trip statistics helpers (delegates) ───────────────────────────────────

    public long insertTripStats(TripStatisticsStore.TripBuilder builder, long endMs) {
        long id = builder.flush(getWritableDatabase(), endMs);
        return id;
    }

    public List<TripStatisticsStore.TripRecord> getTripStats(
        long fromMs, long toMs, int limit
    ) {
        return TripStatisticsStore.listTrips(getReadableDatabase(), fromMs, toMs, limit);
    }

    public int pruneTripStatsBefore(long cutoffMs) {
        return TripStatisticsStore.pruneTripsOlderThan(getWritableDatabase(), cutoffMs);
    }

    // ── Timeline ──────────────────────────────────────────────────────────────

    /**
     * Assembles a merged chronological timeline of place visits and trips.
     * Ready to hand directly to JavaScript via the plugin's getTimeline() method.
     */
    public TimelineAssembler.TimelineResult getTimeline(long fromMs, long toMs, int limit) {
        return TimelineAssembler.query(getReadableDatabase(), fromMs, toMs, limit);
    }
}
