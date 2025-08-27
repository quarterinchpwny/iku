<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { motion, useDomRef, type MotionProps } from 'motion-v';

const isOpen = ref(false);
const containerRef = useDomRef();
const dimensions = ref({ width: 0, height: 0 });
const willExpand = ref(false);

onMounted(() => {
  if (containerRef.value) {
    dimensions.value.width = containerRef.value.offsetWidth;
    dimensions.value.height = containerRef.value.offsetHeight;
  }
});

const toggle = () => {
  isOpen.value = !isOpen.value;
};

const navVariants: MotionProps['variants'] = {
  open: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } },
  closed: { transition: { staggerChildren: 0.05, staggerDirection: -1 } }
};

const itemVariants = {
  open: { y: 0, opacity: 1, transition: { y: { stiffness: 1000, velocity: -100 } } },
  closed: { y: 50, opacity: 0, transition: { y: { stiffness: 1000 } } }
};

const sidebarVariants: MotionProps['variants'] = {
  open: (height: any = 1000) => ({
    clipPath: `circle(${height * 2 + 200}px at calc(100% - 40px) calc(100% - 40px))`,
    transition: { type: 'spring', stiffness: 20, restDelta: 2 }
  }),
  closed: {
    clipPath: 'circle(30px at calc(100% - 40px) calc(100% - 40px))',
    transition: { type: 'spring', stiffness: 400, damping: 40 }
  }
};

const expandVariants: MotionProps['variants'] = {
  expand: {
    height: '100vh',
    width: '100vw',
    top: 0,
    left: 0,
    bottom: '60px',
    right: '0',
    borderRadius: '0px',
    transition: { duration: 0.2 }
  },
  notexpand: {
    height: '400px',
    width: '500px',
    bottom: '60px',
    right: '0',
    top: 'auto',
    left: 'auto',
    borderRadius: '20px',
    transition: { duration: 0.3, ease: 'easeIn' }
  }
};

watch(isOpen, (value) => {
  if (!value) willExpand.value = false;
});

const colors = ['#FF008C', '#D309E1', '#9C1AFF', '#7700FF', '#4400FF'];
</script>

<template>
  <motion.div :initial="{ opacity: 0 }" :animate="{ opacity: 1 }">
    <motion.div
      :transition="{ duration: 0.6 }"
      :variants="expandVariants"
      :animate="willExpand ? 'expand' : 'notexpand'"
      class="container"
    >
      <motion.nav
        :initial="false"
        :animate="isOpen ? 'open' : 'closed'"
        :custom="dimensions.height"
        ref="containerRef"
        class="nav"
      >
        <motion.div class="background" :variants="sidebarVariants" />
        <button class="hidden-toggle" @click="willExpand = !willExpand" v-if="willExpand">
          <svg width="23" height="23" viewBox="0 0 23 23">
            <motion.path
              fill="transparent"
              stroke-width="3"
              stroke="hsl(0, 0%, 18%)"
              stroke-linecap="round"
              :variants="{ closed: { d: 'M 2 2.5 L 20 2.5' }, open: { d: 'M 3 16.5 L 17 2.5' } }"
            />
            <motion.path
              fill="transparent"
              stroke-width="3"
              stroke="hsl(0, 0%, 18%)"
              stroke-linecap="round"
              d="M 2 9.423 L 20 9.423"
              :variants="{ closed: { opacity: 1 }, open: { opacity: 0 } }"
              :transition="{ duration: 0.1 }"
            />
            <motion.path
              fill="transparent"
              stroke-width="3"
              stroke="hsl(0, 0%, 18%)"
              stroke-linecap="round"
              :variants="{
                closed: { d: 'M 2 16.346 L 20 16.346' },
                open: { d: 'M 3 2.5 L 17 16.346' }
              }"
            />
          </svg>
        </button>

        <motion.ul class="list" :variants="navVariants">
          <template v-if="!willExpand && isOpen">
            <motion.li
              v-for="i in 5"
              :key="i - 1"
              class="list-item"
              :variants="itemVariants"
              :whilePress="{ scale: 0.95 }"
              :whileHover="{ scale: 1.1 }"
            >
              <div
                class="icon-placeholder"
                :style="{ border: `2px solid ${colors[i - 1]}` }"
                @click="willExpand = !willExpand"
              />
              <div class="text-placeholder" :style="{ border: `2px solid ${colors[i - 1]}` }" />
            </motion.li>
          </template>
          <template v-if="willExpand">
            <motion.div
              :initial="{ opacity: 0, scale: 0 }"
              :animate="{ opacity: 1, scale: 1 }"
              :transition="{
                duration: 0.3,
                scale: { type: 'spring', visualDuration: 0.4, bounce: 0.5 },
                delay: 0.3
              }"
              class="ball"
            >
              balagbag
            </motion.div>
          </template>
        </motion.ul>

        <button class="toggle-container" @click="toggle" v-if="!willExpand">
          <svg width="23" height="23" viewBox="0 0 23 23">
            <motion.path
              fill="transparent"
              stroke-width="3"
              stroke="hsl(0, 0%, 18%)"
              stroke-linecap="round"
              :variants="{ closed: { d: 'M 2 2.5 L 20 2.5' }, open: { d: 'M 3 16.5 L 17 2.5' } }"
            />
            <motion.path
              fill="transparent"
              stroke-width="3"
              stroke="hsl(0, 0%, 18%)"
              stroke-linecap="round"
              d="M 2 9.423 L 20 9.423"
              :variants="{ closed: { opacity: 1 }, open: { opacity: 0 } }"
              :transition="{ duration: 0.1 }"
            />
            <motion.path
              fill="transparent"
              stroke-width="3"
              stroke="hsl(0, 0%, 18%)"
              stroke-linecap="round"
              :variants="{
                closed: { d: 'M 2 16.346 L 20 16.346' },
                open: { d: 'M 3 2.5 L 17 16.346' }
              }"
            />
          </svg>
        </button>
      </motion.nav>
    </motion.div>
  </motion.div>
</template>

<style scoped>
.container {
  position: absolute;
  max-width: 100%;
  background-color: var(--accent);
  overflow: hidden;
  bottom: 60px;
  right: 0;
  top: auto;
  left: auto;
}
.nav {
  width: 300px;
}
.background {
  background-color: #f5f5f5;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 100%;
}
.toggle-container,
.hidden-toggle {
  outline: none;
  border: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  cursor: pointer;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: transparent;
}
.toggle-container {
  position: absolute;
  bottom: 12px;
  right: 0;
}
.hidden-toggle {
  position: absolute;
  top: 0px;
  left: 20px;
}
.list {
  list-style: none;
  padding: 25px;
  margin: 0;
  position: absolute;
  width: 230px;
}
.list-item {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 20px;
  cursor: pointer;
}
.icon-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex: 40px 0;
  margin-right: 20px;
}
.text-placeholder {
  border-radius: 5px;
  width: 200px;
  height: 20px;
  flex: 1;
}
.ball {
  width: 100px;
  height: 100px;
  background-color: #8df0cc;
  border-radius: 50%;
}
</style>
