const enableNuxtFonts = process.env.NUXT_DISABLE_FONTS !== '1'

export default defineNuxtConfig({
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
  css: ['~/assets/css/tailwind.css','~/assets/styles/main.scss'],
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

  icon: {
    clientBundle: {
      // list of icons to include in the client bundle
      icons: [
        'carbon'
      ],

      // scan all components in the project and include icons 
      scan: true,

      // include all custom collections in the client bundle
      includeCustomCollections: true, 

      // guard for uncompressed bundle size, will fail the build if exceeds
      sizeLimitKb: 256,
    },
  },

  shadcn: {
    prefix: '',
    componentDir: './components/ui'
  },

  pinia: {
    storesDirs: ['./stores/**', './custom-folder/stores/**']
  }
})
