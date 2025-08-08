<template>
  <div>
    <select :value="currentTheme" @change="switchTheme">
      <option v-for="theme in themes" :key="theme" :value="theme">
        {{ theme }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useThemeStore } from '~/stores/theme';

const themes = ref(['dot-matrix', 'classic']);

const themeStore = useThemeStore();
const { currentTheme } = storeToRefs(themeStore);

const switchTheme = (event) => {
  themeStore.setTheme(event.target.value);
};
</script>
