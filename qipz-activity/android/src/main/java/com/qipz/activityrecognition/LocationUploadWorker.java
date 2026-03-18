package com.qipz.activityrecognition;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Drains the SQLite queue in batches and sends each batch as a single HTTP
 * POST to the backend's /sync endpoint.  Batching means N queued points → 1
 * network round-trip instead of N — better battery, fewer rate-limit hits.
 *
 * <p>Payload shape (matches the backend exactly):
 * <pre>
 * {
 *   "table": "passive_locations",
 *   "changes": [ { ...sample1 }, { ...sample2 }, ... ]
 * }
 * </pre>
 */
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

        // Prune stale / exhausted items before uploading
        store.pruneExpired(now);
        store.pruneDeadLetters(QipzConfig.MAX_QUEUE_ATTEMPTS, now - QipzConfig.MAX_ITEM_AGE_MS);
        store.prunePassiveHistoryBefore(now - QipzConfig.PASSIVE_HISTORY_RETENTION_MS);

        int totalProcessed = 0;

        while (totalProcessed < QipzConfig.MAX_BATCH_PER_RUN) {
            // Fetch a full batch at once
            int remaining = QipzConfig.MAX_BATCH_PER_RUN - totalProcessed;
            int batchSize = Math.min(remaining, QipzConfig.MAX_UPLOAD_BATCH_SIZE);
            List<ActivitySyncQueueStore.QueueItem> batch =
                store.getDue(System.currentTimeMillis(), batchSize);

            if (batch.isEmpty()) break;

            // Merge all individual { table, changes:[x] } payloads into one POST body
            List<JSONObject> samples = new ArrayList<>(batch.size());
            Set<String> seenSampleHashes = new HashSet<>();
            for (ActivitySyncQueueStore.QueueItem item : batch) {
                try {
                    JSONObject wrapper = new JSONObject(item.payload);
                    JSONArray  changes = wrapper.optJSONArray("changes");
                    if (changes != null) {
                        for (int i = 0; i < changes.length(); i++) {
                            JSONObject s = changes.optJSONObject(i);
                            if (s == null) continue;
                            String sampleHash = s.optString("sampleHash", "");
                            if (!sampleHash.isEmpty() && !seenSampleHashes.add(sampleHash)) continue;
                            samples.add(s);
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "skipping_malformed_payload id=" + item.id, e);
                }
            }

            if (samples.isEmpty()) {
                // All items malformed — discard them so the queue doesn't block
                for (ActivitySyncQueueStore.QueueItem item : batch) {
                    store.markSuccess(item.id);
                }
                PluginLogStore.append(
                    getApplicationContext(),
                    "upload.worker",
                    "WARN",
                    "discarded_malformed_batch size=" + batch.size()
                );
                totalProcessed += batch.size();
                continue;
            }

            try {
                JSONObject body = new JSONObject();
                body.put("table", "passive_locations");
                JSONArray changesArray = new JSONArray();
                for (JSONObject s : samples) changesArray.put(s);
                body.put("changes", changesArray);

                String bodyStr = body.toString();
                HttpResult response = postPayload(bodyStr);
                LocationSyncResponse syncResponse =
                    LocationSyncResponse.from(response.code, response.responseBody);
                int code = response.code;

                if (code >= 200 && code < 300) {
                    if (syncResponse.parsed && (syncResponse.hasHardRejects() || syncResponse.isOnlyRejects())) {
                        for (ActivitySyncQueueStore.QueueItem item : batch) {
                            store.markFailure(item.id, item.attempts,
                                computeBackoffMillis(item.attempts), "sync_rejected_2xx");
                        }
                        PluginLogStore.append(
                            getApplicationContext(),
                            "upload.worker",
                            "WARN",
                            "retry_rejected_2xx " + syncResponse.compactSummary()
                        );
                        Log.w(TAG, "batch_retry_rejected_2xx " + syncResponse.compactSummary());
                        return Result.retry();
                    }
                    for (ActivitySyncQueueStore.QueueItem item : batch) {
                        store.markUploadedSuccess(item.id, System.currentTimeMillis());
                    }
                    // FIX: Stamp lastStillSyncAt after confirmed upload success.
                    // This was previously stamped at enqueue time in ActivityLocationSyncService,
                    // meaning a failed upload would still eat the 5-minute cooldown window.
                    for (JSONObject s : samples) {
                        if ("STILL".equals(s.optString("activityType", ""))) {
                            ActivityRecognitionDebug.setLastStillSyncAt(
                                getApplicationContext(), System.currentTimeMillis());
                            break;
                        }
                    }
                    PluginLogStore.append(
                        getApplicationContext(),
                        "upload.worker",
                        "INFO",
                        "uploaded size=" + batch.size() + " " + syncResponse.compactSummary()
                    );
                    Log.i(TAG, "batch_uploaded count=" + batch.size() + " " + syncResponse.compactSummary());

                } else if (code == 401 || code == 403) {
                    long retryAt = System.currentTimeMillis() + 30 * 60 * 1000L;
                    for (ActivitySyncQueueStore.QueueItem item : batch) {
                        store.markFailure(item.id, item.attempts, retryAt, "auth_" + code);
                    }
                    PluginLogStore.append(
                        getApplicationContext(),
                        "upload.worker",
                        "ERROR",
                        "auth_failure http=" + code + " size=" + batch.size()
                    );
                    Log.w(TAG, "batch_auth_failure http=" + code);
                    return Result.failure();

                } else if (code == 400 || code == 404 || code == 422) {
                    for (ActivitySyncQueueStore.QueueItem item : batch) {
                        store.markSuccess(item.id);
                    }
                    PluginLogStore.append(
                        getApplicationContext(),
                        "upload.worker",
                        "WARN",
                        "discarded_client_error http=" + code + " size=" + batch.size()
                    );
                    Log.w(TAG, "batch_discarded_client_error http=" + code);

                } else {
                    for (ActivitySyncQueueStore.QueueItem item : batch) {
                        store.markFailure(item.id, item.attempts,
                            computeBackoffMillis(item.attempts), "http_" + code);
                    }
                    PluginLogStore.append(
                        getApplicationContext(),
                        "upload.worker",
                        "WARN",
                        "retry_http http=" + code + " size=" + batch.size()
                    );
                    Log.w(TAG, "batch_retry http=" + code);
                    return Result.retry();
                }

            } catch (Exception e) {
                PluginLogStore.append(
                    getApplicationContext(),
                    "upload.worker",
                    "ERROR",
                    "exception=" + e.getClass().getSimpleName()
                );
                Log.e(TAG, "upload_failed", e);
                return Result.retry();
            }

            totalProcessed += batch.size();
        }

        return Result.success();
    }

    // ── HTTP ──────────────────────────────────────────────────────────────────

    private HttpResult postPayload(String payload) throws Exception {
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
            int code = connection.getResponseCode();
            String responseBody = readBody(connection, code);
            return new HttpResult(code, responseBody);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String readBody(HttpURLConnection connection, int code) {
        InputStream stream = null;
        try {
            stream = code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream();
            if (stream == null) return "";
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int read;
            while ((read = stream.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            return out.toString(StandardCharsets.UTF_8.name());
        } catch (Exception ignored) {
            return "";
        } finally {
            if (stream != null) {
                try { stream.close(); } catch (Exception ignored) {}
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static final class HttpResult {
        final int code;
        final String responseBody;

        HttpResult(int code, String responseBody) {
            this.code = code;
            this.responseBody = responseBody == null ? "" : responseBody;
        }
    }

    private long computeBackoffMillis(int attempts) {
        int nextAttempt = attempts + 1;
        long base = 30_000L;
        long cap  = 6L * 60L * 60L * 1000L;
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