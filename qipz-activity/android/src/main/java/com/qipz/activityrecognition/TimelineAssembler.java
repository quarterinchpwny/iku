package com.qipz.activityrecognition;

import android.database.sqlite.SQLiteDatabase;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Assembles a Google-Timeline-style day view by merging:
 *   - Place visits (STILL clusters) from {@link PlaceVisitStore}
 *   - Trips (movement sessions) from {@link TripStatisticsStore}
 *
 * The result is a chronological list of alternating "place" and "trip"
 * segments. Gaps between recorded segments (e.g. before the plugin was
 * started) are omitted — the JS layer can render them as blank space.
 *
 * Usage:
 * <pre>
 *   TimelineAssembler.TimelineResult result =
 *       TimelineAssembler.query(db, fromMs, toMs, 200);
 *   // result.segments is a JSON array ready to hand to JavaScript
 * </pre>
 */
public final class TimelineAssembler {

    private TimelineAssembler() {}

    /**
     * Query the timeline for a time window.
     *
     * @param db      readable database
     * @param fromMs  window start (epoch ms, inclusive)
     * @param toMs    window end   (epoch ms, inclusive)
     * @param limit   max total segments to return (trips + visits combined)
     */
    public static TimelineResult query(
        SQLiteDatabase db,
        long fromMs,
        long toMs,
        int limit
    ) {
        int safeLimitEach = Math.max(1, Math.min(500, limit));

        List<PlaceVisitStore.PlaceVisitRecord> places =
            PlaceVisitStore.listVisits(db, fromMs, toMs, safeLimitEach);

        List<TripStatisticsStore.TripRecord> trips =
            TripStatisticsStore.listTrips(db, fromMs, toMs, safeLimitEach);

        // Merge into a single chronological list
        List<Segment> merged = new ArrayList<>(places.size() + trips.size());
        for (PlaceVisitStore.PlaceVisitRecord p : places) {
            merged.add(new Segment(p.arrivalMs, "place", p.toJson()));
        }
        for (TripStatisticsStore.TripRecord t : trips) {
            merged.add(new Segment(t.startMs, "trip", t.toJson()));
        }
        merged.sort(Comparator.comparingLong(s -> s.startMs));

        // Cap at limit
        if (merged.size() > limit) {
            merged = merged.subList(0, limit);
        }

        JSONArray segments = new JSONArray();
        for (Segment s : merged) {
            try {
                JSONObject wrapper = new JSONObject();
                wrapper.put("segmentType", s.type);
                wrapper.put("startMs",     s.startMs);
                // Merge all fields from the inner record into the wrapper
                JSONArray names = s.data.names();
                if (names != null) {
                    for (int i = 0; i < names.length(); i++) {
                        String key = names.getString(i);
                        wrapper.put(key, s.data.get(key));
                    }
                }
                segments.put(wrapper);
            } catch (Exception ignored) {}
        }

        return new TimelineResult(segments, places.size(), trips.size());
    }

    // ── Segment (internal merge node) ─────────────────────────────────────────

    private static final class Segment {
        final long       startMs;
        final String     type;    // "place" | "trip"
        final JSONObject data;

        Segment(long startMs, String type, JSONObject data) {
            this.startMs = startMs;
            this.type    = type;
            this.data    = data;
        }
    }

    // ── Result ────────────────────────────────────────────────────────────────

    public static final class TimelineResult {
        /** Chronologically sorted array of place + trip segments. */
        public final JSONArray segments;
        public final int       placeCount;
        public final int       tripCount;

        TimelineResult(JSONArray segments, int placeCount, int tripCount) {
            this.segments   = segments;
            this.placeCount = placeCount;
            this.tripCount  = tripCount;
        }
    }
}