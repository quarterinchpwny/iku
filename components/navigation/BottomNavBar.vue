<template>
  <div
    class="fixed bottom-0 left-0 right-0 z-50 shadow-lg md:hidden"
    style="background-color: #181818"
  >
    <nav class="flex h-16 items-center justify-around">
      <NuxtLink
        v-for="(item, index) in navIcons"
        :key="index"
        :to="`/${item.link || ''}`"
        class="flex flex-col items-center text-gray-600 hover:text-blue-600"
        active-class="router-link-active"
      >
        <div class="flex flex-col items-center text-orange-600 hover:text-orange-300">
          <!-- Use :icon for imported icons -->
          <Icon :icon="item.icon" size="28" v-if="!item.isMainIcon" />
          <span v-else class="text-3xl font-bold">{{ item.txt || item.name }}</span>
        </div>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup>
// Import from your local @iconify-json/carbon package via Vite Icon Loader
import homeIcon from '~icons/carbon/home';
import searchIcon from '~icons/carbon/search';
import chartIcon from '~icons/carbon/chart-rose';
import userIcon from '~icons/carbon/user';

const navIcons = [
  {
    name: 'Home',
    link: '',
    icon: homeIcon,
    isMainIcon: false
  },
  {
    name: 'Community',
    link: 'community',
    icon: searchIcon,
    isMainIcon: false
  },
  {
    name: `let's go!`,
    link: 'map',
    icon: searchIcon, // Can swap for a different icon if needed
    txt: '行く',
    isMainIcon: true
  },
  {
    name: 'Stats',
    icon: chartIcon,
    isMainIcon: false
  },
  {
    name: 'Profile',
    icon: userIcon,
    isMainIcon: false
  }
];
</script>

<style scoped lang="scss">
.router-link-active {
  color: #2563eb; /* blue-600 */
}
nav {
  padding-bottom: constant(safe-area-inset-bottom); /* iOS 11.0 */
  padding-bottom: env(safe-area-inset-bottom); /* Modern iOS */
  background-color: black;
}
</style>
