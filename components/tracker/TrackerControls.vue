<template>
  <div
    class="absolute inset-x-0 bottom-[calc(24px+env(safe-area-inset-bottom)+64px)] z-20 flex items-end justify-center gap-3 sm:bottom-[calc(24px+env(safe-area-inset-bottom))]"
  >
    <motion.div
      :initial="{ opacity: 0 }"
      :animate="{ opacity: 1 }"
      class="pointer-events-none absolute inset-0 z-[9999]"
    >
      <motion.div
        :transition="{ duration: 0.6 }"
        :variants="expandVariants"
        :animate="willExpand ? 'expand' : 'notexpand'"
        class="absolute bottom-[110px] right-0 max-w-full overflow-hidden"
      >
        <motion.nav
          ref="containerRef"
          :initial="false"
          :animate="isOpen ? 'open' : 'closed'"
          :custom="dimensions.height"
          class="pointer-events-auto relative w-[280px]"
        >
          <motion.div
            class="absolute inset-0 w-full rounded-l-2xl border border-r-0 border-white/10 bg-[rgba(10,10,12,0.85)] backdrop-blur-2xl"
            :variants="sidebarVariants"
          />

          <button
            v-if="willExpand"
            class="absolute left-3.5 top-3.5 h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] text-white"
            @click="willExpand = !willExpand"
          >
            <svg width="23" height="23" viewBox="0 0 23 23">
              <motion.path fill="transparent" stroke-width="3" stroke="hsl(0, 0%, 18%)" stroke-linecap="round" :variants="{ closed: { d: 'M 2 2.5 L 20 2.5' }, open: { d: 'M 3 16.5 L 17 2.5' } }" />
              <motion.path fill="transparent" stroke-width="3" stroke="hsl(0, 0%, 18%)" stroke-linecap="round" d="M 2 9.423 L 20 9.423" :variants="{ closed: { opacity: 1 }, open: { opacity: 0 } }" :transition="{ duration: 0.1 }" />
              <motion.path fill="transparent" stroke-width="3" stroke="hsl(0, 0%, 18%)" stroke-linecap="round" :variants="{ closed: { d: 'M 2 16.346 L 20 16.346' }, open: { d: 'M 3 2.5 L 17 16.346' } }" />
            </svg>
          </button>

          <motion.div class="absolute w-full p-5" :variants="navVariants">
            <motion.div :variants="itemVariants">
              <div class="mt-2 flex flex-col space-y-2">
                <button
                  v-if="!isTracking"
                  class="min-h-[34px] w-full rounded-lg border border-cyan-400/45 bg-white/5 px-3 text-left text-xs text-cyan-300"
                  @click="$emit('start')"
                >
                  Start Tracking
                </button>
                <button
                  v-if="isTracking"
                  class="min-h-[34px] w-full rounded-lg border border-red-400/45 bg-white/5 px-3 text-left text-xs text-red-400"
                  @click="$emit('stop')"
                >
                  Stop Tracking
                </button>

                <div class="mt-1 flex items-center border-t border-white/10 pt-2">
                  <span class="text-[9px] tracking-[0.15em] text-white/55">WALK ROUTE SEARCH</span>
                </div>

                <input
                  v-model.trim="originText"
                  class="h-[34px] w-full rounded-lg border border-white/15 bg-white/5 px-2.5 text-xs text-white/90"
                  placeholder="FROM"
                />
                <input
                  v-model.trim="destinationText"
                  class="h-[34px] w-full rounded-lg border border-white/15 bg-white/5 px-2.5 text-xs text-white/90"
                  placeholder="TO"
                />
                <button
                  class="min-h-[34px] w-full rounded-lg border border-white/15 bg-white/5 px-3 text-left text-xs text-white/85 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isRouteSearching"
                  @click="submitWalkingSearch"
                >
                  {{ isRouteSearching ? 'Searching...' : 'Search Walking Route' }}
                </button>
                <div v-if="routeSummary" class="text-[11px] text-green-500">{{ routeSummary }}</div>
                <div v-if="routeError" class="text-[11px] text-red-500">{{ routeError }}</div>

                <div class="mt-1 flex items-center border-t border-white/10 pt-2">
                  <span class="text-[9px] tracking-[0.15em] text-white/55">TOOLS</span>
                </div>
                <button
                  class="min-h-[34px] w-full rounded-lg border border-white/15 bg-white/5 px-3 text-left text-xs text-white/85"
                  @click="$emit('recenter')"
                >
                  ⌖ Recenter
                </button>
                <button
                  v-if="isTracking"
                  class="min-h-[34px] w-full rounded-lg border border-white/15 bg-white/5 px-3 text-left text-xs text-white/85"
                  @click="$emit('toggle-pause')"
                >
                  {{ isPaused ? 'Resume' : 'Pause' }}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </motion.nav>
      </motion.div>
    </motion.div>

    <button
      v-if="!willExpand"
      class="absolute bottom-[120px] right-4 z-30 h-16 w-16 bg-transparent"
      @click="toggle"
    >
      <div
        class="relative flex h-[54px] w-[54px] items-center justify-center rounded-full border border-white/10 bg-[#0a0a0c]"
      >
        <svg width="20" height="20" viewBox="0 0 23 23">
          <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round" :animate="isOpen ? 'open' : 'closed'" :variants="{ closed: { d: 'M 2 2.5 L 20 2.5' }, open: { d: 'M 3 16.5 L 17 2.5' } }" />
          <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round" d="M 2 9.423 L 20 9.423" :animate="isOpen ? 'open' : 'closed'" :variants="{ closed: { opacity: 1 }, open: { opacity: 0 } }" :transition="{ duration: 0.1 }" />
          <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round" :animate="isOpen ? 'open' : 'closed'" :variants="{ closed: { d: 'M 2 16.346 L 20 16.346' }, open: { d: 'M 3 2.5 L 17 16.346' } }" />
        </svg>
        <div class="absolute inset-[-8px] animate-pulse rounded-full border border-orange-500/15" />
      </div>
    </button>

    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="scale-90 opacity-0"
      leave-active-class="transition duration-300 ease-in"
      leave-to-class="scale-90 opacity-0"
    >
      <button
        v-if="!isTracking"
        class="flex flex-col items-center gap-2 bg-transparent p-0"
        @click="$emit('start')"
      >
        <div
          class="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-orange-500 text-white shadow-[0_0_0_6px_rgba(249,115,22,0.15),0_0_0_12px_rgba(249,115,22,0.06)]"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </div>
        <span class="text-[10px] tracking-[0.25em] text-white/70">START</span>
      </button>
    </Transition>

    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="scale-90 opacity-0"
      leave-active-class="transition duration-300 ease-in"
      leave-to-class="scale-90 opacity-0"
    >
      <div v-if="isTracking" class="flex items-center gap-4">
        <button
          class="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-orange-500 text-white shadow-[0_0_0_6px_rgba(249,115,22,0.15)]"
          @click="$emit('toggle-pause')"
        >
          <svg v-if="!isPaused" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
          <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </button>
        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="scale-90 opacity-0"
          leave-active-class="transition duration-300 ease-in"
          leave-to-class="scale-90 opacity-0"
        >
          <button
            v-if="isPaused"
            class="flex h-[58px] w-[58px] items-center justify-center rounded-full border border-red-500/40 bg-red-500/15 text-red-500"
            @click="$emit('stop')"
          ><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg></button>
        </Transition>
        <button
          class="flex h-[58px] w-[58px] items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/70 backdrop-blur"
          @click="$emit('recenter')"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { motion, useDomRef, type MotionProps } from 'motion-v';

defineProps<{ isTracking: boolean; isPaused: boolean; isRouteSearching: boolean; routeError: string; routeSummary: string }>();

const emit = defineEmits<{
  (e: 'start'): void;
  (e: 'toggle-pause'): void;
  (e: 'stop'): void;
  (e: 'recenter'): void;
  (e: 'search-walking', payload: { from: string; to: string }): void;
}>();

const isOpen = ref(false);
const willExpand = ref(false);
const containerRef = useDomRef();
const dimensions = ref({ width: 0, height: 1000 });
const originText = ref('');
const destinationText = ref('');

const navVariants: MotionProps['variants'] = {
  open: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } },
  closed: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
};

const itemVariants: MotionProps['variants'] = {
  open: { y: 0, opacity: 1, transition: { y: { stiffness: 1000, velocity: -100 } } },
  closed: { y: 50, opacity: 0, transition: { y: { stiffness: 1000 } } },
};

const sidebarVariants: MotionProps['variants'] = {
  open: (height: number = 1000) => ({
    clipPath: `circle(${height * 2 + 200}px at 100% 100%)`,
    transition: { type: 'spring', stiffness: 20, restDelta: 2 },
  }),
  closed: {
    clipPath: 'circle(0px at 100% 100%)',
    transition: { type: 'spring', stiffness: 400, damping: 40 },
  },
};

const expandVariants: MotionProps['variants'] = {
  expand: { height: '100vh', width: '100vw', top: 0, left: 0, bottom: '0', right: '0', borderRadius: '0px', transition: { duration: 0.2 } },
  notexpand: { height: '420px', width: '280px', bottom: '110px', right: '0', top: 'auto', left: 'auto', borderRadius: '16px 0 0 16px', transition: { duration: 0.3, ease: 'easeIn' } },
};

function toggle() {
  isOpen.value = !isOpen.value;
}

function submitWalkingSearch() {
  emit('search-walking', { from: originText.value, to: destinationText.value });
}

function syncDimensions() {
  dimensions.value = { width: window.innerWidth, height: window.innerHeight };
}

onMounted(() => {
  syncDimensions();
  window.addEventListener('resize', syncDimensions);
});

onUnmounted(() => {
  window.removeEventListener('resize', syncDimensions);
});
</script>
