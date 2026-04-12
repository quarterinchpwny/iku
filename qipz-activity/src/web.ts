import { WebPlugin } from '@capacitor/core';

import type { ActivityRecognitionPlugin } from './definitions';
import type { ActivityStatus } from './definitions';

export class ActivityRecognitionWeb extends WebPlugin implements ActivityRecognitionPlugin {
  async status(): Promise<ActivityStatus> {
    throw this.unimplemented('Not implemented on web.');
  }

  async start(): Promise<ActivityStatus> {
    throw this.unimplemented('Not implemented on web.');
  }

  async stop(): Promise<ActivityStatus> {
    throw this.unimplemented('Not implemented on web.');
  }

  async requestStartPermissions(): Promise<ActivityStatus> {
    throw this.unimplemented('Not implemented on web.');
  }

  async checkStartPermissions(): Promise<ActivityStatus> {
    throw this.unimplemented('Not implemented on web.');
  }

  async setDebugEnabled(_options: { enabled: boolean }): Promise<ActivityStatus> {
    throw this.unimplemented('Not implemented on web.');
  }

  async setActivityNotificationsEnabled(_options: { enabled: boolean }): Promise<ActivityStatus> {
    throw this.unimplemented('Not implemented on web.');
  }

  async setHighReliabilityMode(_options: { enabled: boolean }): Promise<ActivityStatus> {
    throw this.unimplemented('Not implemented on web.');
  }

  async setAccountKey(_options: { accountKey: string }): Promise<ActivityStatus> {
    throw this.unimplemented('Not implemented on web.');
  }

  async setJsPassiveActive(_options: { active: boolean }): Promise<ActivityStatus> {
    throw this.unimplemented('Not implemented on web.');
  }

  async setGeofences(_options: { geofences: import('./definitions').GeofenceConfig[] }): Promise<ActivityStatus> {
    throw this.unimplemented('Not implemented on web.');
  }

  async drainPendingEvents(): Promise<{ events: import('./definitions').ActivityEvent[] }> {
    throw this.unimplemented('Not implemented on web.');
  }

  async getPluginLogs(_options?: { limit?: number }): Promise<{ logs: import('./definitions').PluginLogEntry[] }> {
    throw this.unimplemented('Not implemented on web.');
  }

  async getPassiveEvents(
    _options?: import('./definitions').GetPassiveEventsOptions
  ): Promise<import('./definitions').GetPassiveEventsResult> {
    throw this.unimplemented('Not implemented on web.');
  }

  async getTimeline(
    _options?: { fromMs?: number; toMs?: number; limit?: number }
  ): Promise<import('./definitions').GetTimelineResult> {
    throw this.unimplemented('Not implemented on web.');
  }

  async getPlaceVisits(
    _options?: { fromMs?: number; toMs?: number; limit?: number }
  ): Promise<{ visits: import('./definitions').PlaceVisitRecord[]; count: number }> {
    throw this.unimplemented('Not implemented on web.');
  }

  async setPlaceLabel(_options: { labelId: number; name: string }): Promise<{ ok: boolean }> {
    throw this.unimplemented('Not implemented on web.');
  }

  async clearPluginLogs(): Promise<{ ok: boolean }> {
    throw this.unimplemented('Not implemented on web.');
  }
}
