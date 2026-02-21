package com.qipz.iku;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.qipz.activityrecognition.ActivityRecognitionPlugin;
import com.qipz.heartbeat.HeartbeatPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(ActivityRecognitionPlugin.class);
        registerPlugin(HeartbeatPlugin.class);
    }
}
