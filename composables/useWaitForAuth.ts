import { watch } from 'vue';
import { useAuthStore } from '~/stores/auth';

export function useWaitForAuth() {
  const authStore = useAuthStore();

  return async function waitForAuth() {
    if (authStore.isInitialized) return;
    await new Promise<void>((resolve) => {
      const unwatch = watch(
        () => authStore.isInitialized,
        (val) => {
          if (val) {
            unwatch();
            resolve();
          }
        },
        { immediate: true }
      );
    });
  };
}