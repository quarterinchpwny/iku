// middleware/auth.global.ts
import { useAuthStore } from '~/stores/auth';

export default defineNuxtRouteMiddleware(async (to, from) => {
  // Skip middleware on server
  if (process.server) return;

  const authStore = useAuthStore();
  
  // If we haven't checked for a user yet (e.g., on first load with a cookie)
  // try to fetch the user data.
  if (authStore.token && !authStore.user) {
    await authStore.fetchUser();
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
