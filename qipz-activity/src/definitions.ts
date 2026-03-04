export interface ActivityEvent {
  type: 'WALKING' | 'RUNNING' | 'DRIVING' | 'STILL' | 'UNKNOWN';
  confidence: number;
}

export interface GeofenceTransitionEvent {
  id: string;
  name: string;
  transition: 'ENTER' | 'EXIT';
  state: 'inside' | 'outside';
  lat: number;
  lng: number;
  distanceMeters: number;
  timestamp: number;
}

export interface GeofenceConfig {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  enabled?: boolean;
  lastState?: 'inside' | 'outside';
  lastTransitionAt?: number;
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
  canNotify?: boolean;
  notificationsGranted?: boolean;
  missingPermissions?: string[];
  permissionError?: string;
  debugEnabled?: boolean;
  activityNotificationsEnabled?: boolean;
  highReliabilityModeEnabled?: boolean;
  accountKey?: string;
  jsPassiveActive?: boolean;
  geofenceCount?: number;
}

export interface ActivityRecognitionPlugin {
  status(): Promise<ActivityStatus>;
  start(): Promise<ActivityStatus>;
  stop(): Promise<ActivityStatus>;
  requestStartPermissions(): Promise<ActivityStatus>;
  checkStartPermissions(): Promise<ActivityStatus>;
  setDebugEnabled(options: { enabled: boolean }): Promise<ActivityStatus>;
  setActivityNotificationsEnabled(options: { enabled: boolean }): Promise<ActivityStatus>;
  setHighReliabilityMode(options: { enabled: boolean }): Promise<ActivityStatus>;
  setAccountKey(options: { accountKey: string }): Promise<ActivityStatus>;
  setJsPassiveActive(options: { active: boolean }): Promise<ActivityStatus>;
  setGeofences(options: { geofences: GeofenceConfig[] }): Promise<ActivityStatus>;
  drainPendingEvents(): Promise<{ events: ActivityEvent[] }>;
  addListener(
    eventName: 'activityChange',
    listenerFunc: (event: ActivityEvent) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: 'geofenceTransition',
    listenerFunc: (event: GeofenceTransitionEvent) => void
  ): Promise<{ remove: () => void }>;
}
