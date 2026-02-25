package com.qipz.activityrecognition;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public class LocationUploadWorker extends Worker {
    private static final String TAG = "QipzUpload";

    public LocationUploadWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        ActivitySyncQueueStore store = new ActivitySyncQueueStore(getApplicationContext());
        long now = System.currentTimeMillis();
        store.pruneExpired(now);
        store.pruneDeadLetters(QipzConfig.MAX_QUEUE_ATTEMPTS, now - QipzConfig.MAX_ITEM_AGE_MS);

        int processed = 0;
        while (processed < QipzConfig.MAX_BATCH_PER_RUN) {
            List<ActivitySyncQueueStore.QueueItem> due = store.getDue(System.currentTimeMillis(), 1);
            if (due.isEmpty()) break;

            ActivitySyncQueueStore.QueueItem item = due.get(0);
            try {
                int code = postPayload(item.payload);
                if (code >= 200 && code < 300) {
                    store.markSuccess(item.id);
                } else if (code == 401 || code == 403) {
                    store.markFailure(item.id, item.attempts,
                        System.currentTimeMillis() + 30 * 60 * 1000L, "auth_" + code);
                    return Result.failure();
                } else if (code == 400 || code == 404 || code == 422) {
                    store.markSuccess(item.id);
                } else {
                    store.markFailure(item.id, item.attempts,
                        computeBackoffMillis(item.attempts), "http_" + code);
                    return Result.retry();
                }
            } catch (Exception e) {
                Log.e(TAG, "upload_failed", e);
                return Result.retry();
            }
            processed++;
        }

        return Result.success();
    }

    private int postPayload(String payload) throws Exception {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(QipzConfig.API_URL);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(QipzConfig.CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(QipzConfig.READ_TIMEOUT_MS);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");

            String accountKey = ActivityRecognitionDebug.getAccountKey(getApplicationContext());
            if (!accountKey.isEmpty()) {
                connection.setRequestProperty("Authorization", "Bearer " + accountKey);
                connection.setRequestProperty("X-Payload-Sig", buildHmacSignature(payload, accountKey));
            }

            try (OutputStream os = connection.getOutputStream()) {
                os.write(payload.getBytes(StandardCharsets.UTF_8));
            }
            return connection.getResponseCode();
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private long computeBackoffMillis(int attempts) {
        int nextAttempt = attempts + 1;
        long base = 30_000L;
        long cap = 6L * 60L * 60L * 1000L;
        long delay = base * (1L << Math.min(nextAttempt, 8));
        return System.currentTimeMillis() + Math.min(delay, cap);
    }

    private String buildHmacSignature(String payload, String key) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] bytes = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) sb.append(String.format(Locale.US, "%02x", b));
            return sb.toString();
        } catch (Exception e) {
            Log.w(TAG, "hmac_failed: " + e.getMessage());
            return "";
        }
    }
}
