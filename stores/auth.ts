// /stores/auth.ts
import { defineStore } from 'pinia';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { ActivityRecognition } from '@/src/plugins/activityRecognition';

export const useAuthStore = defineStore('auth', () => {
  // State
  const token = ref(null);
  const user = ref(null);
  const isInitialized = ref(false);

  // Getters
  const isAuthenticated = computed(() => !!token.value);

  // Actions
  async function init() {
    if (isInitialized.value) return;
    
    try {
      const { value } = await Preferences.get({ key: 'auth_token' });
      if (value) {
        token.value = value;
        await fetchUser();
      }
    } catch (e) {
      console.error('Error initializing auth store:', e);
    } finally {
      isInitialized.value = true;
    }
  }

  async function fetchUser() {
    if (!token.value) return;

    const config = useRuntimeConfig();
    try {
      const response = await fetch(`${config.public.cfURL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token.value}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Could not parse error response' }));
        console.error('Error fetching user. Status:', response.status, 'Data:', errorData);
        throw new Error('Could not fetch user.');
      }

      const data = await response.json();
      user.value = data.user;
      const accountKey = String(data?.user?.username || data?.user?.id || '').trim();
      if (accountKey) {
        localStorage.setItem('auth_account_key', accountKey);
        if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('qipz-activity')) {
          try {
            await ActivityRecognition.setAccountKey({ accountKey });
          } catch (_err) {
            // Non-blocking: auth should not fail if plugin bridge is unavailable.
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      await logout();
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

    // Persist token using Preferences
    await Preferences.set({
      key: 'auth_token',
      value: data.token
    });
    
    token.value = data.token;
    await fetchUser();
    
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
  
  async function logout() {
    // Clear token from Preferences
    await Preferences.remove({ key: 'auth_token' });
    
    token.value = null;
    user.value = null;
    localStorage.removeItem('auth_account_key');
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('qipz-activity')) {
      try {
        await ActivityRecognition.setAccountKey({ accountKey: '' });
      } catch (_err) {
        // Non-blocking cleanup.
      }
    }
    
    return navigateTo('/login');
  }

  return { token, user, isAuthenticated, isInitialized, init, login, register, logout, fetchUser };
});
