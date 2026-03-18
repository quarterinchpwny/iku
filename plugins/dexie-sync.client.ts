import { repairOrphanPointRoutes } from '~/db'

export default defineNuxtPlugin(() => {
  void repairOrphanPointRoutes()
})
