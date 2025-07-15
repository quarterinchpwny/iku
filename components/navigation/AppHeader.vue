<template>
  <header class="container flex items-center justify-between p-5 text-center md:mx-auto">
    <div class="logo">qipz</div>
    <div class="navigation">
      <div class="navigation-section px-3">
        <template v-for="link in navigationLinks" :key="link">
          <NuxtLink :to="{ name: link.to }" active-class="underline" class="mx-3">
            {{ link.label }}
          </NuxtLink>
        </template>
      </div>
    </div>
    <div class="quickmenu hidden items-center gap-2 md:flex">
      <div class="flex gap-2 pr-2">
        <template v-for="(link, index) in socialLinks" :key="index">
          <div class="social">
            <Icon :name="link.icon" class="h-7 w-7" />
          </div>
        </template>
      </div>

      <div class="theme flex cursor-pointer gap-1 p-2">
        <div>
          <Icon :name="modeIcon" class="h-7 w-7" @click="onChangeColorMode" />
        </div>
      </div>
    </div>
  </header>
</template>
<script setup>
const modeIcon = computed(() => {
  return colorMode.preference === 'light' ? 'tabler:sun-filled' : 'tabler:moon-filled';
});
const navigationLinks = [
  {
    label: 'home',
    to: 'index'
  },
  {
    label: 'about',
    to: 'about'
  },
  {
    label: 'projects',
    to: 'projects'
  }
  // {
  //     label: 'blog',
  //     to: 'blogs-view'
  // }
];

const socialLinks = [
  {
    label: 'github',
    to: 'home-view',
    icon: 'tabler-brand-github'
  },

  {
    label: 'linkedin',
    to: 'projects-view',
    icon: 'tabler-brand-linkedin'
  }
];
const colorMode = useColorMode();
const onChangeColorMode = () => {
  colorMode.preference = colorMode.preference === 'light' ? 'dark' : 'light';
};
</script>
<style scoped lang="scss">
.quickmenu-links {
  cursor: pointer;
  &:hover {
    stroke: var(--link-color-hover);
  }
}
.navigation-active {
  border-radius: 2px;
  height: 4px;
  box-shadow: 0 2px 25px 2px #fff;
}
.navigation-section {
  backdrop-filter: blur(15px);
  // background-color: rgba(242, 242, 242, 0.5);
  border: 1px solid rgba(242, 242, 242, 0.21);
  border-radius: 24px;
  justify-content: space-between;
  align-items: center;
  height: 48px;
  display: flex;
  position: relative;
  box-shadow: var(--box-shadow);
}
</style>
