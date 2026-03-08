package com.qipz.activityrecognition;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import java.util.ArrayList;
import java.util.List;

public class ActivitySyncQueueStore extends SQLiteOpenHelper {
    private static final String DB_NAME = "iku_activity_queue.db";
    private static final int DB_VERSION = 3;
    private static final String TABLE = "activity_queue";

    public static final class QueueItem {
        public final long id;
        public final String payload;
        public final String source;
        public final int attempts;
        public final long createdAt;

        public QueueItem(long id, String payload, String source, int attempts, long createdAt) {
            this.id = id;
            this.payload = payload;
            this.source = source;
            this.attempts = attempts;
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
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (oldVersion < 2 && !hasColumn(db, TABLE, "source")) {
            db.execSQL("ALTER TABLE " + TABLE + " ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown'");
        }
        if (oldVersion < 3) {
            PassiveEventHistoryStore.createTable(db);
        }
    }

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
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_activity_queue_retry ON " + TABLE + "(next_retry_at)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_activity_queue_expires ON " + TABLE + "(expires_at)");
    }

    private boolean hasColumn(SQLiteDatabase db, String table, String column) {
        try (Cursor cursor = db.rawQuery("PRAGMA table_info(" + table + ")", null)) {
            while (cursor.moveToNext()) {
                String name = cursor.getString(1);
                if (column.equalsIgnoreCase(name)) return true;
            }
        }
        return false;
    }

    public long enqueue(String payload, long nowMillis, long expiresAtMillis) {
        return enqueue(payload, "unknown", nowMillis, expiresAtMillis);
    }

    public long enqueue(String payload, String source, long nowMillis, long expiresAtMillis) {
        pruneOverflow(QipzConfig.MAX_QUEUE_SIZE);
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            ContentValues values = new ContentValues();
            values.put("payload", payload);
            values.put("source", source == null ? "unknown" : source);
            values.put("attempts", 0);
            values.put("next_retry_at", nowMillis);
            values.put("expires_at", Math.max(0L, expiresAtMillis));
            values.put("created_at", nowMillis);
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

    public List<QueueItem> getDue(long nowMillis, int limit) {
        List<QueueItem> items = new ArrayList<>();
        SQLiteDatabase db = getReadableDatabase();
        try (Cursor cursor = db.query(
            TABLE,
            new String[] {"id", "payload", "source", "attempts", "created_at"},
            "next_retry_at <= ? AND (expires_at = 0 OR expires_at >= ?)",
            new String[] {Long.toString(nowMillis), Long.toString(nowMillis)},
            null,
            null,
            "id ASC",
            Integer.toString(limit)
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
        getWritableDatabase().delete(TABLE, "id = ?", new String[] {Long.toString(id)});
    }

    public void markUploadedSuccess(long id, long uploadedAt) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            PassiveEventHistoryStore.markUploadedForQueueItem(db, id, uploadedAt);
            db.delete(TABLE, "id = ?", new String[] {Long.toString(id)});
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    public void markFailure(long id, int attempts, long nextRetryAt, String error) {
        ContentValues values = new ContentValues();
        values.put("attempts", attempts + 1);
        values.put("next_retry_at", nextRetryAt);
        values.put("last_error", error == null ? "" : error);
        getWritableDatabase().update(TABLE, values, "id = ?", new String[] {Long.toString(id)});
    }

    public int pruneExpired(long nowMillis) {
        return getWritableDatabase().delete(
            TABLE,
            "expires_at > 0 AND expires_at < ?",
            new String[] {Long.toString(nowMillis)}
        );
    }

    public int pruneDeadLetters(int maxAttempts, long oldestCreatedAtMillis) {
        return getWritableDatabase().delete(
            TABLE,
            "attempts >= ? OR created_at < ?",
            new String[] {Integer.toString(maxAttempts), Long.toString(oldestCreatedAtMillis)}
        );
    }

    public void pruneOverflow(int maxItems) {
        getWritableDatabase().execSQL(
            "DELETE FROM " + TABLE + " WHERE id NOT IN "
                + "(SELECT id FROM " + TABLE + " ORDER BY created_at DESC LIMIT ?)",
            new Object[] {maxItems}
        );
    }

    public int countPending() {
        try (Cursor cursor = getReadableDatabase().rawQuery("SELECT COUNT(*) FROM " + TABLE, null)) {
            return cursor.moveToFirst() ? cursor.getInt(0) : 0;
        }
    }

    public int prunePassiveHistoryBefore(long timestampCutoff) {
        return PassiveEventHistoryStore.pruneBefore(getWritableDatabase(), timestampCutoff);
    }

    public List<PassiveEventHistoryStore.PassiveEventRecord> getPassiveEvents(
        long fromTimestamp,
        long toTimestamp,
        long cursorId,
        int limit
    ) {
        return PassiveEventHistoryStore.list(getReadableDatabase(), fromTimestamp, toTimestamp, cursorId, limit);
    }
}
