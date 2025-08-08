// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  css: ['~/assets/css/tailwind.css'],
  ssr: false,

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
  shadcn: {
    /**
     * Prefix for all the imported component
     */
    prefix: '',
    /**
     * Directory that the component lives in.
     * @default "./components/ui"
     */
    componentDir: './components/ui'
  },
  pinia: {
    storesDirs: ['./stores/**', './custom-folder/stores/**']
  }
});
