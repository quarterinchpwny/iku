<template>
  <div
    class="fixed bottom-0 left-0 right-0 z-50 shadow-lg md:hidden"
    style="background-color: #181818"
  >
    <nav class="flex h-16 items-center justify-around">
      <NuxtLink
        v-for="(icon, index) in navIcons"
        :key="index"
        :to="`/${icon.link}`"
        class="flex flex-col items-center text-gray-600 hover:text-blue-600"
        active-class="router-link-active"
      >
        <div class="flex flex-col items-center text-orange-600 hover:text-orange-300">
          <Icon :name="icon.icon" size="28" v-if="!icon.isMainIcon" />
          <IkuLogoMark v-else class="w-14" />
          <!-- <div class="pt-1 text-xs">{{ icon.name }}</div> -->
        </div>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup>
const navIcons = [
  {
    name: 'Home',
    link: '',
    icon: 'carbon:home',
    isMainIcon: false
  },
  {
    name: 'Community',
    link: 'community',
    icon: 'carbon:search',
    isMainIcon: false
  },
  {
    name: `let's go!`,
    link: 'map',
    icon: 'carbon:search',
    isMainIcon: true
  },
  {
    name: 'Stats',
    link: 'routes',
    icon: 'carbon:chart-rose',
    isMainIcon: false
  },
  {
    name: 'Profile',
    link: 'settings',
    icon: 'carbon:user',
    isMainIcon: false
  }
];
</script>

<style scoped lang="scss">
.router-link-active {
  color: #2563eb;
  /* blue-600 */
}

nav {
  padding-bottom: constant(safe-area-inset-bottom);
  /* iOS 11.0 */
  padding-bottom: env(safe-area-inset-bottom);
  /* Modern iOS */
  background-color: black;
}
</style>
