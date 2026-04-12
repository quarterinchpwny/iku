import { defineStore } from 'pinia';

export const useThemeStore = defineStore('theme', {
  state: () => ({
    currentTheme: 'dot-matrix',
  }),
  actions: {
    setTheme(theme: string) {
      this.currentTheme = theme;
    },
  },
});
