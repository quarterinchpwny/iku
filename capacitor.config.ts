import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'nuxt.app',
  appName: 'nuxt-app',
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
      enabled: false,
    },
    CapacitorUpdater: {
      autoUpdate: true,
      updateUrl: `${process.env.VITE_CF_API_URL}/api/ota/check`,
      version: '0.0.0',
    },
  },
  server: {
    allowNavigation: ['*'],
  },
}

export default config
