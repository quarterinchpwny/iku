<template>
  <div class="bottom-controls">
    <motion.div :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" class="pointer-events-none absolute inset-0 z-[9999]">
      <motion.div :transition="{ duration: 0.6 }" :variants="expandVariants" :animate="willExpand ? 'expand' : 'notexpand'" class="motion-container">
        <motion.nav ref="containerRef" :initial="false" :animate="isOpen ? 'open' : 'closed'" :custom="dimensions.height" class="nav pointer-events-auto">
          <motion.div class="background" :variants="sidebarVariants" />

          <button class="hidden-toggle" @click="willExpand = !willExpand" v-if="willExpand">
            <svg width="23" height="23" viewBox="0 0 23 23">
              <motion.path fill="transparent" stroke-width="3" stroke="hsl(0, 0%, 18%)" stroke-linecap="round" :variants="{ closed: { d: 'M 2 2.5 L 20 2.5' }, open: { d: 'M 3 16.5 L 17 2.5' } }" />
              <motion.path fill="transparent" stroke-width="3" stroke="hsl(0, 0%, 18%)" stroke-linecap="round" d="M 2 9.423 L 20 9.423" :variants="{ closed: { opacity: 1 }, open: { opacity: 0 } }" :transition="{ duration: 0.1 }" />
              <motion.path fill="transparent" stroke-width="3" stroke="hsl(0, 0%, 18%)" stroke-linecap="round" :variants="{ closed: { d: 'M 2 16.346 L 20 16.346' }, open: { d: 'M 3 2.5 L 17 16.346' } }" />
            </svg>
          </button>

          <motion.div class="absolute w-full p-5" :variants="navVariants">
            <motion.div :variants="itemVariants">
              <div class="mt-2 flex flex-col space-y-2">
                <button v-if="!isTracking" class="nav-btn-light nav-btn-light--active" @click="$emit('start')">Start Tracking</button>
                <button v-if="isTracking" class="nav-btn-light nav-btn-light--danger" @click="$emit('stop')">Stop Tracking</button>

                <div class="nav-divider mt-1"><span class="nav-divider-label">WALK ROUTE SEARCH</span></div>

                <input v-model.trim="originText" class="nav-select-light" placeholder="FROM" />
                <input v-model.trim="destinationText" class="nav-select-light" placeholder="TO" />
                <button class="nav-btn-light" :disabled="isRouteSearching" @click="submitWalkingSearch">
                  {{ isRouteSearching ? 'Searching...' : 'Search Walking Route' }}
                </button>
                <div v-if="routeSummary" class="nav-status-ok">{{ routeSummary }}</div>
                <div v-if="routeError" class="nav-status-error">{{ routeError }}</div>

                <div class="nav-divider mt-1"><span class="nav-divider-label">TOOLS</span></div>
                <button class="nav-btn-light" @click="$emit('recenter')">⌖ Recenter</button>
                <button class="nav-btn-light" v-if="isTracking" @click="$emit('toggle-pause')">
                  {{ isPaused ? 'Resume' : 'Pause' }}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </motion.nav>
      </motion.div>
    </motion.div>

    <button v-if="!willExpand" class="toggle-container" @click="toggle">
      <div class="toggle-orb">
        <svg width="20" height="20" viewBox="0 0 23 23">
          <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round" :animate="isOpen ? 'open' : 'closed'" :variants="{ closed: { d: 'M 2 2.5 L 20 2.5' }, open: { d: 'M 3 16.5 L 17 2.5' } }" />
          <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round" d="M 2 9.423 L 20 9.423" :animate="isOpen ? 'open' : 'closed'" :variants="{ closed: { opacity: 1 }, open: { opacity: 0 } }" :transition="{ duration: 0.1 }" />
          <motion.path fill="transparent" stroke-width="2.5" stroke="#f97316" stroke-linecap="round" :animate="isOpen ? 'open' : 'closed'" :variants="{ closed: { d: 'M 2 16.346 L 20 16.346' }, open: { d: 'M 3 2.5 L 17 16.346' } }" />
        </svg>
        <div class="toggle-orb-ring" />
      </div>
    </button>

    <Transition name="scale-fade">
      <button v-if="!isTracking" class="btn-start" @click="$emit('start')">
        <div class="btn-start-inner">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </div>
        <span class="btn-start-label">START</span>
      </button>
    </Transition>

    <Transition name="scale-fade">
      <div v-if="isTracking" class="active-controls">
        <button class="btn-control btn-pause" @click="$emit('toggle-pause')">
          <svg v-if="!isPaused" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
          <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </button>
        <Transition name="scale-fade">
          <button v-if="isPaused" class="btn-control btn-stop" @click="$emit('stop')"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg></button>
        </Transition>
        <button class="btn-control btn-recenter" @click="$emit('recenter')">
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

<style scoped>
.bottom-controls { position: absolute; bottom: 24px; left: 0; right: 0; z-index: 20; display: flex; align-items: flex-end; justify-content: center; gap: 12px; }
.motion-container { position: absolute; max-width: 100%; overflow: hidden; bottom: 110px; right: 0; }
.nav { width: 280px; position: relative; }
.background { background-color: rgba(10, 10, 12, 0.85); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08); border-right: none; border-radius: 16px 0 0 16px; position: absolute; top: 0; left: 0; bottom: 0; width: 100%; }
.toggle-container { position: absolute; bottom: 120px; right: 16px; width: 64px; height: 64px; cursor: pointer; background: none; border: none; z-index: 30; }
.toggle-orb { width: 54px; height: 54px; border-radius: 50%; background: #0a0a0c; border: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: center; position: relative; }
.toggle-orb-ring { position: absolute; inset: -8px; border-radius: 50%; border: 1px solid rgba(249, 115, 22, 0.15); animation: orbRingPulse 3s ease-in-out infinite; }
.hidden-toggle { position: absolute; top: 14px; left: 14px; width: 40px; height: 40px; border-radius: 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); color: #fff; cursor: pointer; }
.nav-divider { display: flex; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 8px; }
.nav-divider-label { font-size: 9px; letter-spacing: 0.15em; color: rgba(255, 255, 255, 0.55); }
.nav-select-light { width: 100%; height: 34px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.16); background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.9); padding: 0 10px; font-size: 12px; }
.nav-btn-light { width: 100%; min-height: 34px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.16); background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.86); font-size: 12px; }
.nav-btn-light--active { border-color: rgba(34, 211, 238, 0.45); color: #67e8f9; }
.nav-btn-light--danger { border-color: rgba(239, 68, 68, 0.45); color: #f87171; }
.nav-status-ok { font-size: 11px; color: #22c55e; }
.nav-status-error { font-size: 11px; color: #ef4444; }
.btn-start { display: flex; flex-direction: column; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; padding: 0; }
.btn-start-inner { width: 72px; height: 72px; border-radius: 50%; background: #f97316; display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 0 0 6px rgba(249, 115, 22, 0.15), 0 0 0 12px rgba(249, 115, 22, 0.06); }
.btn-start-label { font-size: 10px; letter-spacing: 0.25em; color: rgba(255, 255, 255, 0.7); }
.active-controls { display: flex; align-items: center; gap: 16px; }
.btn-control { width: 58px; height: 58px; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.btn-pause { width: 72px; height: 72px; background: #f97316; color: #fff; box-shadow: 0 0 0 6px rgba(249, 115, 22, 0.15); }
.btn-stop { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #ef4444; }
.btn-recenter { background: rgba(0, 0, 0, 0.6); border: 1px solid rgba(255, 255, 255, 0.12); color: rgba(255, 255, 255, 0.7); backdrop-filter: blur(8px); }
@keyframes orbRingPulse { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.1; transform: scale(1.15); } }
</style>
