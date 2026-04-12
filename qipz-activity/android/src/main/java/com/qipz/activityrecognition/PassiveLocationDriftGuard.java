package com.qipz.activityrecognition;

import android.location.Location;

final class PassiveLocationDriftGuard {
    private Location pendingLocation;
    private Location pendingSpikeLocation;
    private long pendingSpikeAtMs;
    private Location lastAcceptedLocation;

    void resetPending() {
        pendingLocation = null;
        pendingSpikeLocation = null;
        pendingSpikeAtMs = 0L;
    }

    void resetFull() {
        resetPending();
        lastAcceptedLocation = null;
    }

    boolean hasPendingSpike() {
        return pendingSpikeLocation != null;
    }

    Location[] evaluate(Location previousAcceptedLocation, Location incomingLocation, String activityType) {
        if (incomingLocation == null) {
            resetPending();
            return new Location[0];
        }

        Location acceptedBaseline = previousAcceptedLocation != null ? previousAcceptedLocation : lastAcceptedLocation;
        long incomingTimestamp = incomingLocation.getTime();
        if (acceptedBaseline != null && incomingTimestamp > 0L) {
            long baselineTimestamp = acceptedBaseline.getTime();
            if (baselineTimestamp > 0L && incomingTimestamp - baselineTimestamp > QipzConfig.PASSIVE_BASELINE_STALE_MS) {
                acceptedBaseline = null;
                lastAcceptedLocation = null;
                resetPending();
            }
        }

        if (acceptedBaseline == null) {
            resetPending();
            lastAcceptedLocation = new Location(incomingLocation);
            return new Location[] { incomingLocation };
        }
        if (pendingSpikeLocation != null
            && incomingTimestamp > 0L
            && pendingSpikeAtMs > 0L
            && incomingTimestamp - pendingSpikeAtMs > QipzConfig.PASSIVE_SPIKE_STALE_MS) {
            pendingSpikeLocation = null;
            pendingSpikeAtMs = 0L;
        }

        float impliedSpeed = impliedSpeedMetersPerSecond(acceptedBaseline, incomingLocation);
        if (impliedSpeed > QipzConfig.MAX_PASSIVE_SPEED_MPS) {
            resetPending();
            return new Location[0];
        }

        float distanceFromAccepted = acceptedBaseline.distanceTo(incomingLocation);

        if (pendingSpikeLocation != null) {
            float distanceFromPending = pendingSpikeLocation.distanceTo(incomingLocation);
            if (distanceFromPending <= QipzConfig.PASSIVE_SPIKE_CONFIRM_DISTANCE_METERS) {
                Location first = pendingSpikeLocation;
                resetPending();
                lastAcceptedLocation = new Location(incomingLocation);
                return new Location[] { first, incomingLocation };
            }
            if (distanceFromAccepted <= QipzConfig.PASSIVE_SPIKE_CONFIRM_DISTANCE_METERS) {
                resetPending();
                lastAcceptedLocation = new Location(incomingLocation);
                return new Location[] { incomingLocation };
            }
            if (distanceFromAccepted > QipzConfig.PASSIVE_SPIKE_DISTANCE_METERS) {
                pendingSpikeLocation = new Location(incomingLocation);
                pendingSpikeAtMs = incomingTimestamp;
                return new Location[0];
            }
            resetPending();
        }

        if (distanceFromAccepted > QipzConfig.PASSIVE_SPIKE_DISTANCE_METERS) {
            pendingSpikeLocation = new Location(incomingLocation);
            pendingSpikeAtMs = incomingTimestamp;
            pendingLocation = null;
            return new Location[0];
        }

        if (!isReviewableActivity(activityType)) {
            pendingLocation = null;
            lastAcceptedLocation = new Location(incomingLocation);
            return new Location[] { incomingLocation };
        }

        if (distanceFromAccepted > reviewDistanceMeters(activityType)) {
            pendingLocation = null;
            lastAcceptedLocation = new Location(incomingLocation);
            return new Location[] { incomingLocation };
        }

        if (impliedSpeed > QipzConfig.PASSIVE_CLUSTER_REVIEW_MAX_SPEED_MPS) {
            pendingLocation = null;
            lastAcceptedLocation = new Location(incomingLocation);
            return new Location[] { incomingLocation };
        }

        if (pendingLocation == null) {
            pendingLocation = new Location(incomingLocation);
            return new Location[0];
        }

        if (distanceFromAccepted <= QipzConfig.PASSIVE_CLUSTER_RETURN_DISTANCE_METERS) {
            pendingLocation = null;
            return new Location[0];
        }

        float distanceFromPending = pendingLocation.distanceTo(incomingLocation);
        if (distanceFromPending <= QipzConfig.PASSIVE_CLUSTER_CONFIRM_DISTANCE_METERS) {
            pendingLocation = null;
            lastAcceptedLocation = new Location(incomingLocation);
            return new Location[] { incomingLocation };
        }

        float pendingDistanceFromAccepted = acceptedBaseline.distanceTo(pendingLocation);
        if (distanceFromAccepted >= pendingDistanceFromAccepted + QipzConfig.PASSIVE_CLUSTER_PROGRESS_DISTANCE_METERS) {
            pendingLocation = null;
            lastAcceptedLocation = new Location(incomingLocation);
            return new Location[] { incomingLocation };
        }

        pendingLocation = new Location(incomingLocation);
        return new Location[0];
    }

    private boolean isReviewableActivity(String activityType) {
        return "WALKING".equals(activityType)
            || "RUNNING".equals(activityType)
            || "DRIVING".equals(activityType)
            || "UNKNOWN".equals(activityType);
    }

    private float reviewDistanceMeters(String activityType) {
        if ("WALKING".equals(activityType) || "RUNNING".equals(activityType) || "UNKNOWN".equals(activityType)) {
            return QipzConfig.PASSIVE_CLUSTER_REVIEW_DISTANCE_SLOW_METERS;
        }
        return QipzConfig.PASSIVE_CLUSTER_REVIEW_DISTANCE_METERS;
    }

    private float impliedSpeedMetersPerSecond(Location previousLocation, Location incomingLocation) {
        long deltaMillis = incomingLocation.getTime() - previousLocation.getTime();
        if (deltaMillis <= 0L) {
            return 0f;
        }
        return previousLocation.distanceTo(incomingLocation) / (deltaMillis / 1000f);
    }
}