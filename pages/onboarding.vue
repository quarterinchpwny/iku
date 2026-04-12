<template>
  <div class="bg-[#05070b] font-['Instrument_Sans',system-ui,sans-serif] text-white">
    <div
      class="mx-auto flex min-h-screen w-full max-w-[28rem] flex-col overflow-hidden bg-[#0a0a0c] pt-6"
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

      <main class="flex flex-1 flex-col px-5 pb-4 pt-2">
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
                    <IkuLogoMark class="w-[10.5rem]" />
                    <div class="pt-2 text-3xl font-medium text-slate-300">Let's go!</div>
                  </div>
                </div>
              </template>

              <template v-else-if="currentSlide.id === 'home'">
                <HomeCommuteHeroCard is-onboarding />
              </template>

              <template v-else-if="currentSlide.id === 'routes'">
                <article class="rounded-[1rem] border border-white/10 px-4 py-4">
                  <p class="text-sm font-semibold text-emerald-200">Walk estimate</p>
                  <p class="mt-3 text-2xl font-semibold text-white">73 min</p>
                  <p class="mt-2 text-sm leading-6 text-zinc-300">
                    Riding is still about 51 minutes faster than walking.
                  </p>
                  <dl class="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div class="rounded-[1rem] border border-white/10 bg-black/20 px-3 py-2">
                      <dt class="text-zinc-500">Signal state</dt>
                      <dd class="mt-1 text-white">Live route signal</dd>
                    </div>
                    <div class="rounded-[1rem] border border-white/10 bg-black/20 px-3 py-2">
                      <dt class="text-zinc-500">Confidence</dt>
                      <dd class="mt-1 text-white">High confidence</dd>
                    </div>
                    <div class="rounded-[1rem] border border-white/10 bg-black/20 px-3 py-2">
                      <dt class="text-zinc-500">Timing call</dt>
                      <dd class="mt-1 text-white">Leave now</dd>
                    </div>
                    <div class="rounded-[1rem] border border-white/10 bg-black/20 px-3 py-2">
                      <dt class="text-zinc-500">Signal path</dt>
                      <dd class="mt-1 text-white">Healthy</dd>
                    </div>
                  </dl>
                </article>
              </template>

              <template v-else-if="currentSlide.id === 'timeline'">
                <div>
                  <img :src="TimelineScreenCapture" />
                </div>
                <!-- <div
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
                </div> -->
              </template>

              <template v-else>
                <div
                  class="bg-orange-500/8 absolute inset-x-4 top-10 h-48 rounded-[1.8rem] blur-3xl"
                ></div>
                <div class="relative z-10 rounded-[1rem] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
                  <div class="text-center">
                    <div class="mt-4 text-3xl font-semibold text-white">Setup is 90% done.</div>
                    <div class="mt-2 text-sm leading-6 text-zinc-400">
                      Sign in to finish the last bit.
                    </div>
                  </div>

                  <div class="mt-5 space-y-2">
                    <div class="rounded-[1rem] px-3 py-2.5">
                      <div class="text-sm font-bold text-zinc-100">Don't turn off permissions</div>
                      <div class="mt-1 text-[12px] text-zinc-600">
                        Your route history only works with background location on.
                      </div>
                    </div>
                    <div class="px-3 py-2.5">
                      <div class="text-sm font-bold text-zinc-100">Turn off battery saver</div>
                      <div class="mt-1 text-[12px] text-zinc-600">
                        Open app settings and disable battery saver for accurate tracking.
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

          <div class="flex items-center gap-3 pt-4">
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
                class="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-white px-3 text-sm font-medium text-black transition hover:bg-zinc-200"
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
import HomeCommuteHeroCard from '~/components/home/HomeCommuteHeroCard.vue';
import TimelineScreenCapture from '~/assets/imgs/screen-cap.png';
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
    description: 'The rest can happen after you get in.'
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
</style>
