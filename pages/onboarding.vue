<template>
  <div class="bg-[#05070b] text-white">
    <div
      class="mx-auto flex min-h-screen w-full max-w-[28rem] flex-col overflow-hidden bg-[#0a0a0c] pt-8"
    >
      <div class="flex items-center justify-end px-5">
        <NuxtLink
          to="/login"
          class="inline-flex items-center gap-1 text-sm font-medium text-zinc-500 transition hover:text-zinc-300"
        >
          Skip
          <span aria-hidden="true">›</span>
        </NuxtLink>
      </div>

      <main class="flex flex-1 flex-col px-5 pb-6 pt-2">
        <Transition name="fade" mode="out-in">
          <section :key="currentSlide.id" class="flex flex-1 flex-col">
            <div
              class="relative flex min-h-[24rem] flex-1 items-center justify-center overflow-hidden"
            >
              <template v-if="currentSlide.id === 'splash'">
                <div class="flex h-full w-full items-center justify-center">
                  <div
                    class="flex flex-col items-center justify-center rounded-[1.6rem] p-6 text-orange-400"
                  >
                    <div
                      class="iku-logo-mark flex items-center justify-center text-center text-7xl font-bold text-orange-600"
                    >
                      行く!
                    </div>
                    <div class="pt-2 text-3xl font-medium text-slate-300">Let's go!</div>
                  </div>
                </div>
              </template>

              <template v-else-if="currentSlide.id === 'home'">
                <div
                  class="bg-orange-500/8 absolute inset-x-6 top-12 h-44 rounded-[1.8rem] blur-3xl"
                ></div>
                <div
                  class="border-white/6 absolute -left-2 top-20 h-44 w-44 rounded-[2rem] border bg-[#111216] opacity-60 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
                  style="transform: rotate(-18deg)"
                ></div>
                <div
                  class="absolute right-2 top-12 h-36 w-32 rounded-[2rem] border border-orange-500/10 bg-[#151113] opacity-70 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
                  style="transform: rotate(15deg)"
                ></div>
                <div
                  class="relative z-10 w-[17rem] rounded-[1.6rem] border border-white/10 bg-[#202127]/90 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur"
                >
                  <div class="text-[13px] leading-5 text-zinc-100">
                    Show my usual commute, weather, and route signal the moment I open the app.
                  </div>
                  <div class="mt-4 flex items-center justify-between">
                    <div class="flex items-center gap-2 text-[11px] text-zinc-400">
                      <span class="bg-white/6 rounded-full px-2 py-1">Home</span>
                      <span class="bg-white/6 rounded-full px-2 py-1">ETA</span>
                    </div>
                    <span
                      class="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black"
                    >
                      →
                    </span>
                  </div>
                </div>
              </template>

              <template v-else-if="currentSlide.id === 'routes'">
                <div
                  class="bg-orange-500/8 absolute inset-x-4 top-10 h-48 rounded-[1.8rem] blur-3xl"
                ></div>
                <div class="relative z-10 flex w-full flex-col items-center gap-4">
                  <div
                    class="w-[18rem] rounded-[1.5rem] border border-white/10 bg-[#23242a]/95 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
                  >
                    <div class="flex items-center gap-2 overflow-hidden">
                      <span
                        v-for="badge in routeBadges"
                        :key="badge"
                        class="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-white text-xs font-semibold text-black"
                      >
                        {{ badge }}
                      </span>
                    </div>
                    <div class="mt-3 flex items-center justify-between">
                      <div class="text-[13px] text-zinc-200">
                        Add your route and compare options fast.
                      </div>
                      <span
                        class="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black"
                      >
                        →
                      </span>
                    </div>
                  </div>

                  <div class="flex flex-wrap justify-center gap-2 px-3">
                    <div
                      v-for="chip in integrationChips"
                      :key="chip"
                      class="bg-white/6 rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-zinc-300"
                    >
                      {{ chip }}
                    </div>
                  </div>
                </div>
              </template>

              <template v-else-if="currentSlide.id === 'timeline'">
                <div
                  class="bg-orange-500/8 absolute inset-x-4 top-10 h-48 rounded-[1.8rem] blur-3xl"
                ></div>
                <div
                  class="relative z-10 w-[18rem] rounded-[1.6rem] border border-white/10 bg-[#202127]/95 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
                >
                  <div class="space-y-3">
                    <div class="rounded-[1rem] border border-zinc-700 bg-[#111216] px-3 py-2.5">
                      <div class="flex items-center justify-between">
                        <div class="text-sm font-medium text-white">Home</div>
                        <div class="text-[11px] text-zinc-500">7:10 AM</div>
                      </div>
                      <div class="mt-1 text-[12px] text-zinc-500">Stayed until departure</div>
                    </div>

                    <div class="rounded-[1rem] border border-orange-500/20 bg-[#18120d] px-3 py-3">
                      <div class="flex items-end justify-between">
                        <div>
                          <div class="text-sm font-medium text-orange-200">Trip detected</div>
                          <div class="mt-1 text-[12px] text-orange-100/70">
                            Passive timeline segment
                          </div>
                        </div>
                        <div class="text-right">
                          <div class="text-xl font-semibold text-orange-400">38m</div>
                          <div class="text-[11px] text-orange-100/60">current route</div>
                        </div>
                      </div>

                      <div class="mt-4 flex h-24 items-end gap-1">
                        <span
                          v-for="(height, index) in chartHeights"
                          :key="`bar-${index}`"
                          class="flex-1 rounded-full bg-gradient-to-t from-orange-500 to-orange-300/70"
                          :style="{ height }"
                        ></span>
                      </div>
                    </div>

                    <div class="rounded-[1rem] border border-zinc-700 bg-[#111216] px-3 py-2.5">
                      <div class="flex items-center justify-between">
                        <div class="text-sm font-medium text-white">Office</div>
                        <div class="text-[11px] text-zinc-500">7:48 AM</div>
                      </div>
                      <div class="mt-1 text-[12px] text-zinc-500">
                        Readable stop-to-stop history
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <template v-else>
                <div
                  class="bg-orange-500/8 absolute inset-x-4 top-10 h-48 rounded-[1.8rem] blur-3xl"
                ></div>
                <div
                  class="relative z-10 w-[18rem] rounded-[1.6rem] border border-white/10 bg-[#23242a]/95 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
                >
                  <div class="text-center">
                    <div
                      class="mx-auto flex h-14 w-14 items-center justify-center rounded-[1rem] bg-white text-xl font-semibold text-black"
                    >
                      行
                    </div>
                    <div class="mt-4 text-xl font-semibold text-white">You are ready.</div>
                    <div class="mt-2 text-sm leading-6 text-zinc-400">
                      Create an account or sign in and finish setup inside the normal app flow.
                    </div>
                  </div>

                  <div class="mt-5 space-y-2">
                    <div class="rounded-[1rem] border border-zinc-700 bg-[#111216] px-3 py-2.5">
                      <div class="text-sm font-medium text-zinc-100">
                        Keep permissions available
                      </div>
                      <div class="mt-1 text-[12px] text-zinc-500">
                        Background location and activity access are what fill the route history
                        later.
                      </div>
                    </div>
                    <div class="rounded-[1rem] border border-zinc-700 bg-[#111216] px-3 py-2.5">
                      <div class="text-sm font-medium text-zinc-100">
                        Pick your corridor after login
                      </div>
                      <div class="mt-1 text-[12px] text-zinc-500">
                        Open Routes once and choose the one you check most often.
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <div class="space-y-3 pb-2">
              <div class="text-4xl font-semibold leading-[1.05] tracking-tight text-white">
                {{ currentSlide.title }}
              </div>
              <div class="max-w-[20rem] text-base leading-7 text-zinc-400">
                {{ currentSlide.description }}
              </div>
            </div>
          </section>
        </Transition>

        <div class="mt-auto space-y-4">
          <div class="flex items-center gap-2 pt-4">
            <button
              v-for="(slide, index) in slides"
              :key="slide.id"
              type="button"
              class="h-2 rounded-full transition-all"
              :class="index === currentSlideIndex ? 'w-7 bg-white' : 'w-2 bg-white/20'"
              @click="goToSlide(index)"
            ></button>
          </div>

          <div class="flex items-center gap-3 pt-10">
            <button
              v-if="currentSlideIndex > 0"
              type="button"
              class="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
              @click="goBack"
            >
              ‹
            </button>

            <button
              v-if="!isLastSlide"
              type="button"
              class="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-white px-5 text-sm font-medium text-black transition hover:bg-zinc-200"
              @click="goNext"
            >
              Continue
            </button>

            <div v-else class="flex flex-1 gap-3">
              <NuxtLink
                to="/register"
                class="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-white px-5 text-sm font-medium text-black transition hover:bg-zinc-200"
              >
                Create account
              </NuxtLink>
              <NuxtLink
                to="/login"
                class="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Log in
              </NuxtLink>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const slides = [
  {
    id: 'splash',
    title: 'Know how the route looks before you leave.',
    description: 'IKU keeps commute context, passive movement, and route timing in one app.'
  },
  {
    id: 'home',
    title: 'Open straight into your normal route.',
    description: 'Home should already know the route, timing, and signal you actually check.'
  },
  {
    id: 'routes',
    title: 'Compare ride, wait, or walk fast.',
    description: 'Use Routes when you need a quick corridor decision instead of a long setup flow.'
  },
  {
    id: 'timeline',
    title: 'Let the day timeline build itself.',
    description:
      'Passive history stays readable when the app can keep location and activity access on.'
  },
  {
    id: 'ready',
    title: 'Finish setup inside the app.',
    description: 'Create an account or sign in now. The rest can happen after you get in.'
  }
] as const;

const routeBadges = ['IKU', 'ETA', 'MAP', 'GO'];
const integrationChips = ['Weather', 'History', 'Routes', 'Signals'];
const chartHeights = ['38%', '55%', '44%', '70%', '49%', '86%', '58%', '92%', '64%', '80%'];

const currentSlideIndex = ref(0);

const currentSlide = computed(() => slides[currentSlideIndex.value] ?? slides[0]);
const isLastSlide = computed(() => currentSlideIndex.value === slides.length - 1);

function goToSlide(index: number) {
  if (index < 0 || index >= slides.length) return;
  currentSlideIndex.value = index;
}

function goNext() {
  if (isLastSlide.value) return;
  currentSlideIndex.value += 1;
}

function goBack() {
  if (currentSlideIndex.value <= 0) return;
  currentSlideIndex.value -= 1;
}

definePageMeta({
  layout: false
});

useHead({
  title: 'Onboarding'
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
.iku-logo-mark {
  position: relative;
  transform-origin: center;
  text-shadow: 0 0 0.45rem rgba(249, 115, 22, 0.08);
  animation:
    iku-logo-float 6s ease-in-out infinite,
    iku-logo-glow 6s ease-in-out infinite;
}

.iku-logo-mark::before {
  content: '';
  position: absolute;
  inset: -0.2rem -0.35rem;
  z-index: -1;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.12), transparent 68%);
  filter: blur(8px);
  opacity: 0.4;
  animation: iku-logo-aura 6s ease-in-out infinite;
}

@keyframes iku-logo-float {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }

  50% {
    transform: translate3d(0, -0.12rem, 0);
  }
}

@keyframes iku-logo-glow {
  0%,
  100% {
    text-shadow: 0 0 0.45rem rgba(249, 115, 22, 0.06);
  }

  50% {
    text-shadow: 0 0 0.7rem rgba(249, 115, 22, 0.14);
  }
}

@keyframes iku-logo-aura {
  0%,
  100% {
    transform: scale(0.96);
    opacity: 0.28;
  }

  50% {
    transform: scale(1.03);
    opacity: 0.42;
  }
}
</style>
