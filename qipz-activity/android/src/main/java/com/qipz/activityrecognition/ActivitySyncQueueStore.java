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
  private static final int DB_VERSION = 1;
  private static final String TABLE = "activity_queue";

  public static final class QueueItem {
    public final long id;
    public final String payload;
    public final int attempts;
    public final long createdAt;

    public QueueItem(long id, String payload, int attempts, long createdAt) {
      this.id = id;
      this.payload = payload;
      this.attempts = attempts;
      this.createdAt = createdAt;
    }
  }

  public ActivitySyncQueueStore(Context context) {
    super(context, DB_NAME, null, DB_VERSION);
  }

  @Override
  public void onCreate(SQLiteDatabase db) {
    db.execSQL(
      "CREATE TABLE IF NOT EXISTS " + TABLE + " ("
        + "id INTEGER PRIMARY KEY AUTOINCREMENT,"
        + "payload TEXT NOT NULL,"
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

  @Override
  public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
    // No-op for initial schema.
  }

  public long enqueue(String payload, long nowMillis, long expiresAtMillis) {
    SQLiteDatabase db = getWritableDatabase();
    ContentValues values = new ContentValues();
    values.put("payload", payload);
    values.put("attempts", 0);
    values.put("next_retry_at", nowMillis);
    values.put("expires_at", Math.max(0L, expiresAtMillis));
    values.put("created_at", nowMillis);
    return db.insert(TABLE, null, values);
  }

  public List<QueueItem> getDue(long nowMillis, int limit) {
    List<QueueItem> items = new ArrayList<>();
    SQLiteDatabase db = getReadableDatabase();
    try (Cursor cursor = db.query(
      TABLE,
      new String[] {"id", "payload", "attempts", "created_at"},
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
          cursor.getInt(2),
          cursor.getLong(3)
        ));
      }
    }
    return items;
  }

  public void markSuccess(long id) {
    SQLiteDatabase db = getWritableDatabase();
    db.delete(TABLE, "id = ?", new String[] {Long.toString(id)});
  }

  public void markFailure(long id, int attempts, long nextRetryAt, String error) {
    SQLiteDatabase db = getWritableDatabase();
    ContentValues values = new ContentValues();
    values.put("attempts", attempts + 1);
    values.put("next_retry_at", nextRetryAt);
    values.put("last_error", error == null ? "" : error);
    db.update(TABLE, values, "id = ?", new String[] {Long.toString(id)});
  }

  public int pruneExpired(long nowMillis) {
    SQLiteDatabase db = getWritableDatabase();
    return db.delete(
      TABLE,
      "expires_at > 0 AND expires_at < ?",
      new String[] {Long.toString(nowMillis)}
    );
  }

  public int pruneDeadLetters(int maxAttempts, long oldestCreatedAtMillis) {
    SQLiteDatabase db = getWritableDatabase();
    return db.delete(
      TABLE,
      "attempts >= ? OR created_at < ?",
      new String[] {Integer.toString(maxAttempts), Long.toString(oldestCreatedAtMillis)}
    );
  }

  public int countPending() {
    SQLiteDatabase db = getReadableDatabase();
    try (Cursor cursor = db.rawQuery("SELECT COUNT(*) FROM " + TABLE, null)) {
      if (cursor.moveToFirst()) {
        return cursor.getInt(0);
      }
      return 0;
    }
  }
}
