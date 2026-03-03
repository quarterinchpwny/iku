import type { CapacitorConfig } from '@capacitor/cli'

const otaBaseUrl = process.env.VITE_CF_API_URL
const otaVersion = process.env.VITE_VERSION

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
      autoUpdate: Boolean(otaBaseUrl),
      updateUrl: otaBaseUrl ? `${otaBaseUrl}/api/ota/check` : '',
      version: otaVersion || 'dev',
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
