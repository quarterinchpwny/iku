const enableNuxtFonts = process.env.NUXT_DISABLE_FONTS !== '1';
const bundledWeatherIcons = [
  'meteocons:clear-day-fill',
  'meteocons:clear-night-fill',
  'meteocons:partly-cloudy-day-fill',
  'meteocons:partly-cloudy-night-fill',
  'meteocons:overcast-fill',
  'meteocons:overcast-night-fill',
  'meteocons:fog-day-fill',
  'meteocons:fog-night-fill',
  'meteocons:drizzle-fill',
  'meteocons:partly-cloudy-day-drizzle-fill',
  'meteocons:partly-cloudy-night-drizzle-fill',
  'meteocons:partly-cloudy-day-sleet-fill',
  'meteocons:partly-cloudy-night-sleet-fill',
  'meteocons:sleet-fill',
  'meteocons:partly-cloudy-day-rain-fill',
  'meteocons:partly-cloudy-night-rain-fill',
  'meteocons:rain-fill',
  'meteocons:partly-cloudy-day-snow-fill',
  'meteocons:partly-cloudy-night-snow-fill',
  'meteocons:snow-fill',
  'meteocons:thunderstorms-day-rain-fill',
  'meteocons:thunderstorms-night-rain-fill',
  'meteocons:thunderstorms-rain-fill'
] as const;

export default defineNuxtConfig({
  app: {
    head: {
      meta: [
        {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
        }
      ]
    }
  },
  runtimeConfig: {
    jwtSecret: process.env.NUXT_JWT_SECRET,
    public: {
      cfURL: process.env.VITE_CF_API_URL,
      syncUrl: process.env.NUXT_PUBLIC_SYNC_URL || '/api/sync',
      orsKey: process.env.ORS_KEY
    }
  },
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  css: ['~/assets/css/tailwind.css', '~/assets/styles/main.scss'],
  ssr: false, // SPA mode

  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxt/eslint',
    '@vueuse/nuxt',
    '@nuxt/test-utils/module',
    ...(enableNuxtFonts ? ['@nuxt/fonts'] : []),
    '@nuxtjs/seo',
    '@nuxt/scripts',
    '@nuxt/icon',
    '@formkit/auto-animate/nuxt',
    '@nuxtjs/color-mode',
    '@pinia/nuxt',
    'shadcn-nuxt'
  ],
  fonts: {
    families: [{ name: 'Instrument Sans', provider: 'none' }]
  },

  icon: {
    clientBundle: {
      icons: ['carbon', ...bundledWeatherIcons],

      scan: true,

      includeCustomCollections: true,

      sizeLimitKb: 256
    }
  },

  shadcn: {
    prefix: '',
    componentDir: './components/ui'
  },

  pinia: {
    storesDirs: ['./stores/**', './custom-folder/stores/**']
  }
});
