package com.qipz.activityrecognition;

import android.content.Context;

import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

public class UploadManager {
    private final Context context;

    public UploadManager(Context context) {
        this.context = context.getApplicationContext();
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

        WorkManager.getInstance(context)
            .enqueueUniqueWork("qipz_upload", ExistingWorkPolicy.KEEP, work);
    }
}
