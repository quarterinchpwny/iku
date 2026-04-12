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

export interface PluginLogEntry {
  timestamp: number;
  source: string;
  level: string;
  message: string;
}

export interface PassiveEventRecord {
  id: number;
  timestamp: number;
  lat: number;
  lng: number;
  activityType?: string | null;
  activityConfidence?: number;
  reason?: string | null;
  trigger?: string | null;
  acc?: number;
  vel?: number;
  cog?: number;
  alt?: number;
  provider?: string | null;
  deviceId?: string | null;
  accountKey?: string | null;
  sampleHash: string;
  payloadVersion: number;
  source: string;
  createdAt: number;
  uploadedAt?: number | null;
  queueItemId?: number | null;
}

export interface GetPassiveEventsOptions {
  fromTs?: number;
  toTs?: number;
  cursor?: number;
  limit?: number;
}

export interface GetPassiveEventsResult {
  events: PassiveEventRecord[];
  limit: number;
  hasMore: boolean;
  nextCursor?: number | null;
}

export interface PlaceVisitRecord {
  id: number;
  lat: number;
  lng: number;
  accuracy: number;
  arrivalMs: number;
  departureMs: number;
  durationMs: number;
  fixCount: number;
  labelId?: number | null;
  labelName?: string;
  autoLabel?: string;
  visitCount: number;
}

export interface TimelineTripWaypoint {
  lat: number;
  lng: number;
}

export interface TimelineTripSegment {
  segmentType: 'trip';
  startMs: number;
  endMs: number;
  durationMs: number;
  id?: number;
  tripId?: string;
  routeId?: number;
  distanceM?: number;
  distanceMeters?: number;
  dominantMode?: string;
  pointCount?: number;
  status?: string;
  waypoints?: Array<[number, number]> | TimelineTripWaypoint[];
  startPlaceId?: number;
  endPlaceId?: number;
}

export interface TimelinePlaceSegment extends PlaceVisitRecord {
  segmentType: 'place';
  startMs: number;
}

export interface GetTimelineResult {
  segments: Array<TimelinePlaceSegment | TimelineTripSegment>;
  placeCount: number;
  tripCount: number;
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
  getPluginLogs(options?: { limit?: number }): Promise<{ logs: PluginLogEntry[] }>;
  getPassiveEvents(options?: GetPassiveEventsOptions): Promise<GetPassiveEventsResult>;
  getTimeline(options?: { fromMs?: number; toMs?: number; limit?: number }): Promise<GetTimelineResult>;
  getPlaceVisits(options?: { fromMs?: number; toMs?: number; limit?: number }): Promise<{ visits: PlaceVisitRecord[]; count: number }>;
  setPlaceLabel(options: { labelId: number; name: string }): Promise<{ ok: boolean }>;
  clearPluginLogs(): Promise<{ ok: boolean }>;
  addListener(
    eventName: 'activityChange',
    listenerFunc: (event: ActivityEvent) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: 'geofenceTransition',
    listenerFunc: (event: GeofenceTransitionEvent) => void
  ): Promise<{ remove: () => void }>;
}
