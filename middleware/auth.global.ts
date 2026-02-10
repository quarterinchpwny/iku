// middleware/auth.global.ts
import { useAuthStore } from '~/stores/auth';

export default defineNuxtRouteMiddleware(async (to, from) => {
  // Skip middleware on server
  if (process.server) return;

  const authStore = useAuthStore();
  
  // Initialize store (load token from Preferences) if not already done
  if (!authStore.isInitialized) {
    await authStore.init();
  }

  // If user is not authenticated and is trying to access a protected page
  if (!authStore.isAuthenticated && to.path !== '/login' && to.path !== '/register') {
    // Redirect to login page
    return navigateTo('/login');
  }

  // If user is authenticated and tries to access login or register page
  if (authStore.isAuthenticated && (to.path === '/login' || to.path === '/register')) {
    // Redirect to home page
    return navigateTo('/');
  }
});
