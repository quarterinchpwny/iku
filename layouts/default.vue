<template>
  <div class="pt-safe relative min-h-screen pt-10">
    <div class="pb-16">
      <slot />
    </div>

    <NavigationBottomNavBar class="fixed bottom-0 left-0 z-50 w-full" />
  </div>
</template>

<style>
/* Tailwind plugin or custom class */
.pt-safe {
  padding-top: env(safe-area-inset-top);
}
</style>
