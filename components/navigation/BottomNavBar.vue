<template>
  <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 md:hidden">
    <nav class="flex justify-around h-16 items-center">
      <NuxtLink to="/" class="flex flex-col items-center text-xs text-gray-700 hover:text-blue-600 active:text-blue-600">
        <span>Map</span>
      </NuxtLink>
      <NuxtLink to="/projects" class="flex flex-col items-center text-xs text-gray-700 hover:text-blue-600 active:text-blue-600">
        <span>Projects</span>
      </NuxtLink>
      <NuxtLink to="/about" class="flex flex-col items-center text-xs text-gray-700 hover:text-blue-600 active:text-blue-600">
        <span>About</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup>
</script>

<style scoped>
.router-link-active {
  color: #2563eb; /* blue-600 */
}
</style>
