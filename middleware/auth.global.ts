// middleware/auth.global.ts
import { useAuthStore } from '~/stores/auth';

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (process.server) return;

  const authStore = useAuthStore();
  const publicRoutes = new Set(['/login', '/register', '/onboarding']);

  if (!authStore.isInitialized) {
    await authStore.init();
  }

  if (!authStore.isAuthenticated && !publicRoutes.has(to.path)) {
    return navigateTo('/login');
  }

  if (authStore.isAuthenticated && (to.path === '/login' || to.path === '/register')) {
    return navigateTo('/');
  }
});
