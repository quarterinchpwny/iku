

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  css: ['~/assets/css/tailwind.css'],
  ssr: false, // SPA mode

  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxt/eslint',
    '@vueuse/nuxt',
    '@nuxt/test-utils/module',
    '@nuxt/fonts',
    '@nuxtjs/seo',
    '@nuxt/scripts',
    '@nuxt/icon',
    '@formkit/auto-animate/nuxt',
    '@nuxtjs/color-mode',
    '@pinia/nuxt',
    'shadcn-nuxt'
  ],

  icon: {
    serverBundle: 'local', // still lets @nuxt/icon bundle static names
    include: [
      'carbon:home',
      'carbon:search',
      'carbon:chart-rose',
      'carbon:user'
    ]
  },

  shadcn: {
    prefix: '',
    componentDir: './components/ui'
  },

  pinia: {
    storesDirs: ['./stores/**', './custom-folder/stores/**']
  }
})
