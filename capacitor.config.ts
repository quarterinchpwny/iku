import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.qipz.iku',
  appName: 'iku!',
  webDir: '.output/public',
  plugins: {
    PrivacyScreen: {
      enable: false,
    },
    Keyboard: {
      resize: true,
      resizeOnFullScreen: true,
    },
    CapacitorHttp: {
      enabled: true,
    },
    CapacitorUpdater: {
      autoUpdate: true,
      updateUrl: `${process.env.VITE_CF_API_URL}/api/ota/check`,
      version: `${process.env.VITE_VERSION}`,
    },
    BackgroundRunner: {
      label: 'com.qipz.iku.background.task',
      src: 'runners/runner.js',
      event: 'checkLocation',
      repeat: true,
      interval: 15,
      autoStart: true,
    },
  },
  server: {
    allowNavigation: ['*'],
  },
  android: {
    useLegacyBridge: true,
  },
}

export default config
