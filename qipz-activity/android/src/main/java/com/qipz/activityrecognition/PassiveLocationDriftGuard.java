package com.qipz.activityrecognition;

import android.location.Location;

final class PassiveLocationDriftGuard {
    private Location pendingLocation;

    void reset() {
        pendingLocation = null;
    }

    boolean shouldDrop(Location previousAcceptedLocation, Location incomingLocation, String activityType) {
        if (previousAcceptedLocation == null || incomingLocation == null) {
            pendingLocation = null;
            return false;
        }

        float impliedSpeed = impliedSpeedMetersPerSecond(previousAcceptedLocation, incomingLocation);
        if (impliedSpeed > QipzConfig.MAX_PASSIVE_SPEED_MPS) {
            pendingLocation = null;
            return true;
        }

        if (!isReviewableActivity(activityType)) {
            pendingLocation = null;
            return false;
        }

        float distanceFromAccepted = previousAcceptedLocation.distanceTo(incomingLocation);
        if (distanceFromAccepted > reviewDistanceMeters(activityType)) {
            pendingLocation = null;
            return false;
        }

        if (impliedSpeed > QipzConfig.PASSIVE_CLUSTER_REVIEW_MAX_SPEED_MPS) {
            pendingLocation = null;
            return false;
        }

        if (pendingLocation == null) {
            pendingLocation = new Location(incomingLocation);
            return true;
        }

        if (distanceFromAccepted <= QipzConfig.PASSIVE_CLUSTER_RETURN_DISTANCE_METERS) {
            pendingLocation = null;
            return true;
        }

        float distanceFromPending = pendingLocation.distanceTo(incomingLocation);
        if (distanceFromPending <= QipzConfig.PASSIVE_CLUSTER_CONFIRM_DISTANCE_METERS) {
            pendingLocation = null;
            return false;
        }

        float pendingDistanceFromAccepted = previousAcceptedLocation.distanceTo(pendingLocation);
        if (distanceFromAccepted >= pendingDistanceFromAccepted + QipzConfig.PASSIVE_CLUSTER_PROGRESS_DISTANCE_METERS) {
            pendingLocation = null;
            return false;
        }

        pendingLocation = new Location(incomingLocation);
        return true;
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
