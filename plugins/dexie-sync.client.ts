import { syncDownFromCloudflare, repairOrphanPointRoutes } from '~/db'

export default defineNuxtPlugin(() => {
  // This will run once, as soon as the Nuxt app starts on the client
  // We run these without await to avoid blocking the initial UI (white screen)
  void syncDownFromCloudflare()
  void repairOrphanPointRoutes()
})
