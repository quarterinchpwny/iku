import { registerPlugin } from '@capacitor/core';

import type { ActivityRecognitionPlugin } from './definitions';

const ActivityRecognition = registerPlugin<ActivityRecognitionPlugin>('qipz-activity', {
  web: () => import('./web').then((m) => new m.ActivityRecognitionWeb()),
});

export * from './definitions';
export { ActivityRecognition };
