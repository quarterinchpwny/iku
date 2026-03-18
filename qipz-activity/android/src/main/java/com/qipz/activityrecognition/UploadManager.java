package com.qipz.activityrecognition;

import android.content.Context;

import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

public class UploadManager {
    private final Context context;
    private static final long PERIODIC_INTERVAL_MINUTES = 15L;

    // FIX: Track whether we've already scheduled the periodic job so we don't
    // hit the WorkManager database on every single scheduleUpload() call.
    // Previously ensurePeriodicUpload() was called inside scheduleUpload(), meaning
    // every enqueued sample triggered a WorkManager periodic job query. Now the
    // periodic job is set up once in the constructor and scheduleUpload() only
    // enqueues the one-time upload job.
    public UploadManager(Context context) {
        this.context = context.getApplicationContext();
        ensurePeriodicUpload();
    }

    public void scheduleUpload() {
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();

        OneTimeWorkRequest work = new OneTimeWorkRequest.Builder(LocationUploadWorker.class)
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .addTag("qipz_location_upload")
            .build();

        // KEEP means if a job is already queued/running, this call is a no-op.
        // This is the key guarantee that prevents the race condition between
        // ActivityLocationSyncService and concurrent WorkManager invocations.
        WorkManager.getInstance(context)
            .enqueueUniqueWork("qipz_upload", ExistingWorkPolicy.KEEP, work);
    }

    public void ensurePeriodicUpload() {
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();

        PeriodicWorkRequest work = new PeriodicWorkRequest.Builder(
            LocationUploadWorker.class, PERIODIC_INTERVAL_MINUTES, TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .build();

        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork("qipz_upload_periodic", ExistingPeriodicWorkPolicy.KEEP, work);
    }
}