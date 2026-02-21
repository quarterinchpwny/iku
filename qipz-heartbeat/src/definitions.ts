export interface HeartbeatStatus {
  enabled: boolean;
  intervalMinutes: number;
  monitoringMode: number;
  exactAlarmGranted: boolean;
  pendingQueueCount: number;
  lastScheduledAt: number;
  lastAlarmAt: number;
  lastServiceStartAt: number;
  lastLocationAt: number;
  lastUploadAt: number;
  lastUploadCode: number;
  lastError: string;
  lastReason: string;
  lastLat: string;
  lastLng: string;
  lastHealthAlertAt: number;
  canStart?: boolean;
  missingPermissions?: string[];
  permissionError?: string;
}

export interface HeartbeatPlugin {
  start(options?: { intervalMinutes?: number }): Promise<HeartbeatStatus>;
  stop(): Promise<HeartbeatStatus>;
  status(): Promise<HeartbeatStatus>;
  runNow(): Promise<HeartbeatStatus>;
  clearDebug(): Promise<HeartbeatStatus>;
  requestExactAlarmPermission(): Promise<HeartbeatStatus>;
  requestStartPermissions(): Promise<HeartbeatStatus>;
  checkStartPermissions(): Promise<HeartbeatStatus>;
  setMonitoringMode(options: { mode: 0 | 1 | 2 | 3 }): Promise<HeartbeatStatus>;
  cycleMonitoringMode(): Promise<HeartbeatStatus>;
  enqueueTransition(options: {
    event?: 'enter' | 'leave' | 'dwell';
    description?: string;
    lat: number;
    lng: number;
    accuracy?: number;
  }): Promise<HeartbeatStatus>;
}
