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
			autoUpdate: false,
		}
  },
  server: {
    allowNavigation: ['*'],
  },
}

export default config
