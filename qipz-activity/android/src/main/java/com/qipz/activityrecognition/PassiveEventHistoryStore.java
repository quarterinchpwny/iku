package com.qipz.activityrecognition;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public final class PassiveEventHistoryStore {
    private static final String TABLE = "passive_event_history";
    private static final String TAG = "QipzPassiveHistory";

    public static final class PassiveEventRecord {
        public final long id;
        public final long timestamp;
        public final double lat;
        public final double lng;
        public final String activityType;
        public final int activityConfidence;
        public final String reason;
        public final String trigger;
        public final double acc;
        public final double vel;
        public final double cog;
        public final double alt;
        public final String provider;
        public final String deviceId;
        public final String accountKey;
        public final String sampleHash;
        public final int payloadVersion;
        public final String source;
        public final long createdAt;
        public final Long uploadedAt;
        public final Long queueItemId;

        public PassiveEventRecord(
            long id,
            long timestamp,
            double lat,
            double lng,
            String activityType,
            int activityConfidence,
            String reason,
            String trigger,
            double acc,
            double vel,
            double cog,
            double alt,
            String provider,
            String deviceId,
            String accountKey,
            String sampleHash,
            int payloadVersion,
            String source,
            long createdAt,
            Long uploadedAt,
            Long queueItemId
        ) {
            this.id = id;
            this.timestamp = timestamp;
            this.lat = lat;
            this.lng = lng;
            this.activityType = activityType;
            this.activityConfidence = activityConfidence;
            this.reason = reason;
            this.trigger = trigger;
            this.acc = acc;
            this.vel = vel;
            this.cog = cog;
            this.alt = alt;
            this.provider = provider;
            this.deviceId = deviceId;
            this.accountKey = accountKey;
            this.sampleHash = sampleHash;
            this.payloadVersion = payloadVersion;
            this.source = source;
            this.createdAt = createdAt;
            this.uploadedAt = uploadedAt;
            this.queueItemId = queueItemId;
        }
    }

    private PassiveEventHistoryStore() {}

    public static void createTable(SQLiteDatabase db) {
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS " + TABLE + " ("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "queue_item_id INTEGER,"
                + "sample_hash TEXT NOT NULL,"
                + "timestamp INTEGER NOT NULL,"
                + "lat REAL NOT NULL,"
                + "lng REAL NOT NULL,"
                + "activity_type TEXT,"
                + "activity_confidence INTEGER NOT NULL DEFAULT 0,"
                + "reason TEXT,"
                + "trigger TEXT,"
                + "acc REAL,"
                + "vel REAL,"
                + "cog REAL,"
                + "alt REAL,"
                + "provider TEXT,"
                + "device_id TEXT,"
                + "account_key TEXT,"
                + "payload_version INTEGER NOT NULL DEFAULT 1,"
                + "source TEXT NOT NULL DEFAULT 'unknown',"
                + "created_at INTEGER NOT NULL,"
                + "uploaded_at INTEGER"
                + ")"
        );
        db.execSQL(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_passive_event_history_sample_hash ON "
                + TABLE + "(sample_hash)"
        );
        db.execSQL(
            "CREATE INDEX IF NOT EXISTS idx_passive_event_history_timestamp ON "
                + TABLE + "(timestamp)"
        );
        db.execSQL(
            "CREATE INDEX IF NOT EXISTS idx_passive_event_history_uploaded_at ON "
                + TABLE + "(uploaded_at)"
        );
        ensureSchema(db);
    }

    public static void ensureSchema(SQLiteDatabase db) {
        addColumnIfMissing(db, "queue_item_id", "INTEGER");
        addColumnIfMissing(db, "sample_hash", "TEXT");
        addColumnIfMissing(db, "timestamp", "INTEGER NOT NULL DEFAULT 0");
        addColumnIfMissing(db, "lat", "REAL NOT NULL DEFAULT 0");
        addColumnIfMissing(db, "lng", "REAL NOT NULL DEFAULT 0");
        addColumnIfMissing(db, "activity_type", "TEXT");
        addColumnIfMissing(db, "activity_confidence", "INTEGER NOT NULL DEFAULT 0");
        addColumnIfMissing(db, "reason", "TEXT");
        addColumnIfMissing(db, "trigger", "TEXT");
        addColumnIfMissing(db, "acc", "REAL");
        addColumnIfMissing(db, "vel", "REAL");
        addColumnIfMissing(db, "cog", "REAL");
        addColumnIfMissing(db, "alt", "REAL");
        addColumnIfMissing(db, "provider", "TEXT");
        addColumnIfMissing(db, "device_id", "TEXT");
        addColumnIfMissing(db, "account_key", "TEXT");
        addColumnIfMissing(db, "payload_version", "INTEGER NOT NULL DEFAULT 1");
        addColumnIfMissing(db, "source", "TEXT NOT NULL DEFAULT 'unknown'");
        addColumnIfMissing(db, "created_at", "INTEGER NOT NULL DEFAULT 0");
        addColumnIfMissing(db, "uploaded_at", "INTEGER");
    }

    public static void writeFromPayload(
        SQLiteDatabase db,
        long queueId,
        String payload,
        String source,
        long createdAt
    ) {
        try {
            JSONObject wrapper = new JSONObject(payload);
            String table = wrapper.optString("table", "");
            if (!"passive_locations".equalsIgnoreCase(table)) return;
            JSONArray changes = wrapper.optJSONArray("changes");
            if (changes == null || changes.length() == 0) return;
            for (int i = 0; i < changes.length(); i++) {
                JSONObject sample = changes.optJSONObject(i);
                if (sample == null) continue;
                String sampleHash = sample.optString("sampleHash", "").trim();
                if (sampleHash.isEmpty()) continue;
                double lat = sample.optDouble("lat", Double.NaN);
                double lng = sample.optDouble("lng", Double.NaN);
                if (!isFiniteDouble(lat) || !isFiniteDouble(lng)) continue;
                long timestamp = sample.optLong("timestamp", createdAt);
                int payloadVersion = sample.optInt("payloadVersion", 1);
                ContentValues values = new ContentValues();
                values.put("queue_item_id", queueId);
                values.put("sample_hash", sampleHash);
                values.put("timestamp", timestamp > 0 ? timestamp : createdAt);
                values.put("lat", lat);
                values.put("lng", lng);
                values.put("activity_type", nullableSampleText(sample, "activityType"));
                values.put("activity_confidence", sample.optInt("activityConfidence", 0));
                values.put("reason", nullableSampleText(sample, "reason"));
                values.put("trigger", nullableSampleText(sample, "trigger"));
                values.put("acc", nullableSampleNumber(sample, "acc"));
                values.put("vel", nullableSampleNumber(sample, "vel"));
                values.put("cog", nullableSampleNumber(sample, "cog"));
                values.put("alt", nullableSampleNumber(sample, "alt"));
                values.put("provider", nullableSampleText(sample, "provider"));
                values.put("device_id", nullableSampleText(sample, "deviceId"));
                values.put("account_key", nullableSampleText(sample, "accountKey"));
                values.put("payload_version", Math.max(1, payloadVersion));
                values.put("source", source == null ? "unknown" : source);
                values.put("created_at", createdAt);
                db.insertWithOnConflict(TABLE, null, values, SQLiteDatabase.CONFLICT_IGNORE);
            }
        } catch (Exception e) {
            Log.e(TAG, "writeFromPayload failed", e);
        }
    }

    public static int pruneBefore(SQLiteDatabase db, long timestampCutoff) {
        return db.delete(
            TABLE,
            "timestamp < ?",
            new String[] {Long.toString(timestampCutoff)}
        );
    }

    public static int markUploadedForQueueItem(SQLiteDatabase db, long queueItemId, long uploadedAt) {
        ContentValues values = new ContentValues();
        values.put("uploaded_at", Math.max(0L, uploadedAt));
        return db.update(
            TABLE,
            values,
            "queue_item_id = ? AND (uploaded_at IS NULL OR uploaded_at = 0)",
            new String[] {Long.toString(queueItemId)}
        );
    }

    public static List<PassiveEventRecord> list(
        SQLiteDatabase db,
        long fromTimestamp,
        long toTimestamp,
        long cursorId,
        int limit
    ) {
        int safeLimit = Math.max(1, Math.min(400, limit));
        long safeFrom = Math.max(0L, fromTimestamp);
        long safeTo = toTimestamp > 0 ? toTimestamp : Long.MAX_VALUE;
        StringBuilder where = new StringBuilder("timestamp >= ? AND timestamp <= ?");
        List<String> args = new ArrayList<>();
        args.add(Long.toString(safeFrom));
        args.add(Long.toString(safeTo));
        if (cursorId > 0) {
            where.append(" AND id < ?");
            args.add(Long.toString(cursorId));
        }

        List<PassiveEventRecord> rows = new ArrayList<>();
        try (Cursor cursor = db.query(
            TABLE,
            new String[] {
                "id",
                "timestamp",
                "lat",
                "lng",
                "activity_type",
                "activity_confidence",
                "reason",
                "trigger",
                "acc",
                "vel",
                "cog",
                "alt",
                "provider",
                "device_id",
                "account_key",
                "sample_hash",
                "payload_version",
                "source",
                "created_at",
                "uploaded_at",
                "queue_item_id"
            },
            where.toString(),
            args.toArray(new String[0]),
            null,
            null,
            "id DESC",
            Integer.toString(safeLimit)
        )) {
            while (cursor.moveToNext()) {
                Long uploadedAt = cursor.isNull(19) ? null : cursor.getLong(19);
                Long queueItemId = cursor.isNull(20) ? null : cursor.getLong(20);
                rows.add(new PassiveEventRecord(
                    cursor.getLong(0),
                    cursor.getLong(1),
                    cursor.getDouble(2),
                    cursor.getDouble(3),
                    nullableString(cursor, 4),
                    cursor.getInt(5),
                    nullableString(cursor, 6),
                    nullableString(cursor, 7),
                    cursor.isNull(8) ? Double.NaN : cursor.getDouble(8),
                    cursor.isNull(9) ? Double.NaN : cursor.getDouble(9),
                    cursor.isNull(10) ? Double.NaN : cursor.getDouble(10),
                    cursor.isNull(11) ? Double.NaN : cursor.getDouble(11),
                    nullableString(cursor, 12),
                    nullableString(cursor, 13),
                    nullableString(cursor, 14),
                    nullableString(cursor, 15),
                    cursor.getInt(16),
                    nullableString(cursor, 17),
                    cursor.getLong(18),
                    uploadedAt,
                    queueItemId
                ));
            }
        }
        return rows;
    }

    private static boolean isFiniteDouble(double value) {
        return !Double.isNaN(value) && !Double.isInfinite(value);
    }

    private static String nullableSampleText(JSONObject obj, String key) {
        String value = obj.optString(key, "").trim();
        return value.isEmpty() ? null : value;
    }

    private static Double nullableSampleNumber(JSONObject obj, String key) {
        if (!obj.has(key) || obj.isNull(key)) return null;
        double value = obj.optDouble(key, Double.NaN);
        return isFiniteDouble(value) ? value : null;
    }

    private static String nullableString(Cursor cursor, int index) {
        return cursor.isNull(index) ? null : cursor.getString(index);
    }

    private static void addColumnIfMissing(SQLiteDatabase db, String column, String definition) {
        if (hasColumn(db, column)) return;
        db.execSQL("ALTER TABLE " + TABLE + " ADD COLUMN " + column + " " + definition);
    }

    private static boolean hasColumn(SQLiteDatabase db, String column) {
        try (Cursor cursor = db.rawQuery("PRAGMA table_info(" + TABLE + ")", null)) {
            while (cursor.moveToNext()) {
                if (column.equalsIgnoreCase(cursor.getString(1))) return true;
            }
        }
        return false;
    }
}
