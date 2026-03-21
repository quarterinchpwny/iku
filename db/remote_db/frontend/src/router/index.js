import { createRouter, createWebHistory } from 'vue-router'

const EmptyRouteView = {
  render() {
    return null
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'dashboard', component: EmptyRouteView },
    { path: '/map', name: 'map', component: EmptyRouteView },
    { path: '/queue', name: 'queue', component: EmptyRouteView },
    { path: '/logs', name: 'logs', component: EmptyRouteView },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
})

export default router
