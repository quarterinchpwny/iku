export interface ActivityEvent {
  type: 'WALKING' | 'RUNNING' | 'DRIVING' | 'STILL' | 'UNKNOWN';
  confidence: number;
}

export interface ActivityStatus {
  enabled: boolean;
  lastType: 'WALKING' | 'RUNNING' | 'DRIVING' | 'STILL' | 'UNKNOWN';
  lastConfidence: number;
  lastEventAt: number;
  lastStartAt: number;
  lastStopAt: number;
  lastError: string;
  lastDebugLabel?: string;
  eventCount?: number;
  canStart?: boolean;
  missingPermissions?: string[];
  permissionError?: string;
  debugEnabled?: boolean;
  activityNotificationsEnabled?: boolean;
  accountKey?: string;
}

export interface ActivityRecognitionPlugin {
  status(): Promise<ActivityStatus>;
  start(): Promise<ActivityStatus>;
  stop(): Promise<ActivityStatus>;
  requestStartPermissions(): Promise<ActivityStatus>;
  checkStartPermissions(): Promise<ActivityStatus>;
  setDebugEnabled(options: { enabled: boolean }): Promise<ActivityStatus>;
  setActivityNotificationsEnabled(options: { enabled: boolean }): Promise<ActivityStatus>;
  setAccountKey(options: { accountKey: string }): Promise<ActivityStatus>;
  drainPendingEvents(): Promise<{ events: ActivityEvent[] }>;
  addListener(
    eventName: 'activityChange',
    listenerFunc: (event: ActivityEvent) => void
  ): Promise<{ remove: () => void }>;
}
