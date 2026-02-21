import { registerPlugin } from '@capacitor/core';

import type { HeartbeatPlugin } from './definitions';

const Heartbeat = registerPlugin<HeartbeatPlugin>('qipz-heartbeat');

export * from './definitions';
export { Heartbeat };
