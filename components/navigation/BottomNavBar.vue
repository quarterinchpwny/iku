<template>
  <div class="fixed bottom-0 left-0 right-0 z-50 pb-4 shadow-lg md:hidden">
    <nav class="flex h-16 items-center justify-around">
      <NuxtLink
        v-for="(icon, index) in navIcons"
        :key="index"
        :to="`/${icon.name.toLowerCase()}`"
        class="flex flex-col items-center text-gray-600 hover:text-blue-600"
        active-class="router-link-active"
      >
        <div class="flex flex-col items-center text-orange-600">
          <Icon :name="icon.icon" size="32" v-if="!icon.isMainIcon" />
          <span v-else class="text-3xl font-bold"> {{ icon.txt || icon.name }} </span>
          <div class="pt-1 text-xs">{{ icon.name }}</div>
        </div>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup>
const navIcons = [
  {
    name: 'Home',
    icon: 'carbon:home',
    isMainIcon: false
  },
  {
    name: 'Community',
    icon: 'carbon:search',
    isMainIcon: false
  },
  {
    name: `let's go!`,
    icon: 'carbon:search',
    txt: 'ᜆᜍ',
    isMainIcon: true
  },
  {
    name: 'Stats',
    icon: 'carbon:chart-rose',
    isMainIcon: false
  },
  {
    name: 'Profile',
    icon: 'carbon:user',
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
