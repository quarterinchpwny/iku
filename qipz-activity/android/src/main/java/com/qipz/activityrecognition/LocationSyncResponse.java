package com.qipz.activityrecognition;

import org.json.JSONObject;

final class LocationSyncResponse {
    final int httpCode;
    final int insertedCount;
    final int dedupedCount;
    final int rejectedCount;
    final int authRejectedCount;
    final int signatureRejectedCount;
    final boolean parsed;

    private LocationSyncResponse(
        int httpCode,
        int insertedCount,
        int dedupedCount,
        int rejectedCount,
        int authRejectedCount,
        int signatureRejectedCount,
        boolean parsed
    ) {
        this.httpCode = httpCode;
        this.insertedCount = Math.max(0, insertedCount);
        this.dedupedCount = Math.max(0, dedupedCount);
        this.rejectedCount = Math.max(0, rejectedCount);
        this.authRejectedCount = Math.max(0, authRejectedCount);
        this.signatureRejectedCount = Math.max(0, signatureRejectedCount);
        this.parsed = parsed;
    }

    static LocationSyncResponse from(int httpCode, String body) {
        if (body == null || body.trim().isEmpty()) {
            return new LocationSyncResponse(httpCode, 0, 0, 0, 0, 0, false);
        }
        try {
            JSONObject json = new JSONObject(body);
            return new LocationSyncResponse(
                httpCode,
                json.optInt("insertedCount", 0),
                json.optInt("dedupedCount", 0),
                json.optInt("rejectedCount", 0),
                json.optInt("authRejectedCount", 0),
                json.optInt("signatureRejectedCount", 0),
                true
            );
        } catch (Exception ignored) {
            return new LocationSyncResponse(httpCode, 0, 0, 0, 0, 0, false);
        }
    }

    boolean is2xx() {
        return httpCode >= 200 && httpCode < 300;
    }

    boolean hasHardRejects() {
        return authRejectedCount > 0 || signatureRejectedCount > 0;
    }

    boolean isOnlyRejects() {
        return insertedCount == 0 && dedupedCount == 0 && rejectedCount > 0;
    }

    String compactSummary() {
        return "http=" + httpCode
            + " inserted=" + insertedCount
            + " deduped=" + dedupedCount
            + " rejected=" + rejectedCount
            + " authRejected=" + authRejectedCount
            + " sigRejected=" + signatureRejectedCount
            + " parsed=" + parsed;
    }
}
