// /stores/auth.ts
import { defineStore } from 'pinia';
import { useCookie } from '#app'; // Nuxt 3 composable

export const useAuthStore = defineStore('auth', () => {
  // State
  const token = ref(useCookie('auth_token').value || null);
  const user = ref(null);

  // Getters
  const isAuthenticated = computed(() => !!token.value);

  // Actions
  async function fetchUser() {
    if (!token.value) return;

    const config = useRuntimeConfig();
    try {
      const response = await fetch(`${config.public.cfURL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token.value}`,
        },
      });

      if (!response.ok) throw new Error('Could not fetch user.');

      const data = await response.json();
      user.value = data.user;
    } catch (error) {
      console.error('Error fetching user:', error);
      // If fetching user fails, token is likely invalid, so log out
      logout();
    }
  }

  async function login(username, password) {
    const config = useRuntimeConfig();
    const response = await fetch(`${config.public.cfURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Login failed.');
    }

    const authTokenCookie = useCookie('auth_token', { maxAge: 60 * 60 * 24 * 7 }); // 7 days
    authTokenCookie.value = data.token;
    token.value = data.token;

    await fetchUser();
    
    // Redirect to home page after login
    return navigateTo('/');
  }

  async function register(username, password) {
    const config = useRuntimeConfig();
    const response = await fetch(`${config.public.cfURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Registration failed.');
    }
  }
  
  function logout() {
    const authTokenCookie = useCookie('auth_token');
    authTokenCookie.value = null;
    token.value = null;
    user.value = null;
    
    // Redirect to login page
    return navigateTo('/login');
  }

  return { token, user, isAuthenticated, login, register, logout, fetchUser };
});
