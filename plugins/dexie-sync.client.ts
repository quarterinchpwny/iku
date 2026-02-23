import { syncDownFromCloudflare, repairOrphanPointRoutes } from '~/db'

export default defineNuxtPlugin(async () => {
  // This will run once, as soon as the Nuxt app starts on the client
  await syncDownFromCloudflare()
  await repairOrphanPointRoutes()
})
