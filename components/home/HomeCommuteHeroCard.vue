<template>
  <div class="grid w-full gap-3">
    <article
      class="relative min-h-[200px] w-full overflow-hidden rounded-[1rem] border-white/10 bg-[#1a1c1e] text-white shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(255,255,255,0.05)] backdrop-blur-xl"
    >
      <!-- Error state -->
      <div
        v-if="error && !isLoading"
        class="relative grid min-h-[200px] place-content-center justify-items-center gap-3 p-6 text-center font-bold"
        style="z-index: 9999; position: relative"
      >
        <div class="text-slate-400">{{ error }}</div>
        <button
          class="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
          @click="refreshCommute"
        >
          Retry
        </button>
      </div>

      <!-- Main -->
      <div v-else class="relative h-full min-h-[260px]">
        <!-- Map Background -->
        <div class="absolute inset-0 opacity-100" style="z-index: 0; isolation: isolate">
          <HomeTripMap :featured="true" :fill="true" :frameless="true" :points="mapPoints" />
        </div>

        <!-- Gradient Overlay for readability -->
        <div
          class="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80"
          style="z-index: 1"
        ></div>

        <!-- Content Overlay -->
        <div class="absolute inset-0 flex flex-col justify-between p-5" style="z-index: 10">
          <div class="flex items-start justify-between">
            <div class="flex flex-col gap-0.5">
              <p
                class="text-[0.65rem] font-black uppercase tracking-widest text-slate-300 opacity-80"
              >
                {{ routeParts.title }}
              </p>
              <h2 class="text-2xl font-bold tracking-tight text-white drop-shadow-md">
                {{ headlineLabel }}
              </h2>
              <p class="mt-1 max-w-[18rem] text-[0.72rem] font-medium leading-5 text-slate-200/90">
                {{ predictionMessages?.action || signalState.detail }}
              </p>
            </div>
          </div>

          <div class="mt-auto space-y-3">
            <div class="flex items-end justify-between gap-3">
              <div class="flex flex-col gap-2">
                <div>
                  <p class="text-[0.5rem] font-black uppercase tracking-wider text-slate-400">
                    TIME TO DESTINATION:
                  </p>
                  <p class="text-3xl font-black leading-none tracking-tighter text-orange-500">
                    {{ durationLabel }}
                  </p>
                </div>

                <p class="font-black leading-none tracking-tight text-white">ETA: {{ etaLabel }}</p>
              </div>

              <div v-if="!isWeatherLoading" class="flex flex-col items-end">
                <div class="flex items-center gap-1.5">
                  <Icon :name="currentCondition.icon" class="text-2xl text-amber-400" />
                  <span class="text-2xl font-bold">{{ temperatureLabel }}</span>
                </div>
                <span class="text-[0.7rem] font-bold text-slate-300 opacity-90">
                  {{ currentCondition.label }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>

    <!-- <div class="rounded-[1rem] border border-white/10 bg-black/40 px-4 py-3">
      <div class="grid grid-cols-3">
        <div class="rounded-xl border px-3 py-2.5" :class="queueTrustPanelClass(signalState.tone)">
          <p class="text-[0.58rem] font-black uppercase tracking-[0.18em] text-slate-500">Signal</p>
          <p class="mt-1 text-sm font-semibold" :class="queueTrustLabelClass(signalState.tone)">
            {{ signalState.label }}
          </p>
        </div>

        <div
          class="rounded-[1rem] border px-3 py-2.5"
          :class="queueTrustPanelClass(confidenceState.tone)"
        >
          <p class="text-[0.58rem] font-black uppercase tracking-[0.18em] text-slate-500">
            Confidence
          </p>
          <p class="mt-1 text-sm font-semibold" :class="queueTrustLabelClass(confidenceState.tone)">
            {{ confidenceState.label }}
          </p>
        </div>

        <div
          class="rounded-xl border px-3 py-2.5"
          :class="queueTrustPanelClass(departureCall.tone)"
        >
          <p class="text-[0.58rem] font-black uppercase tracking-[0.18em] text-slate-500">
            Timing call
          </p>
        </div>
      </div>
    </div> -->
    <div
      class="flex flex-col justify-between rounded-[1rem] border border-white/10 bg-black/40 px-4 py-3"
    >
      <div>
        <p class="mt-1 text-sm font-semibold" :class="queueTrustLabelClass(departureCall.tone)">
          Best option is to {{ predictionRecommendation.best_option }}.
        </p>
        <p class="mt-1 text-[0.72rem] leading-5 text-slate-300/90">
          {{ departureCall.detail }}
        </p>
      </div>

      <!-- Ride vs Walk bar -->
      <div class="mt-4 space-y-1.5">
        <div class="flex items-center gap-2">
          <span class="w-8 text-[0.65rem] text-white/40">Ride</span>
          <div class="h-[3px] flex-1 rounded-full bg-white/10">
            <div
              class="h-full rounded-full bg-white/60"
              :style="{
                width:
                  (predictionRecommendation.ride_total_minutes /
                    predictionRecommendation.walk_total_minutes) *
                    100 +
                  '%'
              }"
            />
          </div>
          <span class="text-[0.65rem] text-white/40"
            >{{ predictionRecommendation.ride_total_minutes }}m</span
          >
        </div>
        <div class="flex items-center gap-2">
          <span class="w-8 text-[0.65rem] text-white/40">Walk</span>
          <div class="h-[3px] flex-1 rounded-full bg-white/10">
            <div class="h-full w-full rounded-full bg-white/20" />
          </div>
          <span class="text-[0.65rem] text-white/40"
            >{{ predictionRecommendation.walk_total_minutes }}m</span
          >
        </div>
      </div>
      <div class="flex justify-between gap-2 px-3 py-3">
        <!-- Total -->
        <div>
          <p class="mb-0.5 text-[0.6rem] uppercase tracking-wide text-white/30">Walk total</p>
          <p class="text-2xl font-bold leading-none text-white">
            {{ predictionRecommendation.walk_total_minutes
            }}<span class="ml-1 text-xs font-normal text-white/40">min</span>
          </p>
        </div>

        <div class="border-t border-white/5" />

        <!-- Wait -->
        <div>
          <p class="mb-0.5 text-[0.6rem] uppercase tracking-wide text-white/30">Wait</p>
          <p class="text-2xl font-bold leading-none text-white">
            {{ predictionRecommendation.ride_wait_minutes
            }}<span class="ml-1 text-xs font-normal text-white/40">min</span>
          </p>
        </div>

        <!-- In vehicle -->
        <div>
          <p class="mb-0.5 text-[0.6rem] uppercase tracking-wide text-white/30">In vehicle</p>
          <p class="text-2xl font-bold leading-none text-white">
            {{ predictionRecommendation.ride_in_vehicle_minutes
            }}<span class="ml-1 text-xs font-normal text-white/40">min</span>
          </p>
        </div>

        <div class="border-t border-white/5" />

        <!-- Saved -->
        <div>
          <p class="mb-0.5 text-[0.6rem] uppercase tracking-wide text-white/30">Saved</p>
          <p class="text-2xl font-bold leading-none text-white">
            {{ predictionRecommendation.time_saved_minutes
            }}<span class="ml-1 text-xs font-normal text-white/40">min</span>
          </p>
        </div>
      </div>
    </div>

    <!-- <div class="rounded-[1rem] border border-white/10 bg-black/40 px-4 py-3">
      <button
        class="flex w-full items-center justify-between text-left"
        @click="presetsOpen = !presetsOpen"
      >
        <div>
          <p class="text-sm font-semibold text-white">Saved commute presets</p>
          <p class="mt-1 text-xs text-slate-400">
            {{ presets.length ? `${presets.length} saved routes` : 'No saved presets yet' }}
          </p>
        </div>
        <span class="text-sm font-semibold text-orange-400">
          {{ presetsOpen ? 'Hide' : 'Show' }}
        </span>
      </button>

      <QueuePresetManager
        v-if="presetsOpen"
        class="mt-3"
        :presets="presets"
        :routes="routes"
        :save-disabled="!selectedRoute"
        :selected-preset-id="selectedPresetId"
        :selected-route-key="selectedRoute?.route_key || ''"
        title="Saved commute presets"
        @delete-preset="deletePreset"
        @save-preset="saveCurrentPreset($event.label, $event.is_default)"
        @select-preset="selectPreset"
      />
    </div> -->
  </div>
</template>
<script setup lang="ts">
import '~/assets/styles/home-commute-hero.scss';

import { computed, ref } from 'vue';
import HomeTripMap from '~/components/home/HomeTripMap.vue';
import QueuePresetManager from '~/components/queue/QueuePresetManager.vue';
import { useHomeCommuteHero } from '~/composables/home/useHomeCommuteHero';
import { useHomeWeatherBento } from '~/composables/home/useHomeWeatherBento';
import { queueTrustLabelClass, queueTrustPanelClass } from '~/lib/queueEstimateTrust';

const props = withDefaults(
  defineProps<{
    commute?: ReturnType<typeof useHomeCommuteHero>;
    weather?: ReturnType<typeof useHomeWeatherBento>;
    isOnboarding?: boolean;
    routeOnly?: boolean;
    suggestionOnly?: boolean;
  }>(),
  {
    isOnboarding: false,
    routeOnly: false,
    suggestionOnly: false
  }
);

// ─── Onboarding mock data ─────────────────────────────────────────────────────

const MOCK_COMMUTE = {
  mapPoints: ref(
    [
      [121.061596, 14.584698],
      [121.061596, 14.584668],
      [121.061594, 14.584573],
      [121.061595, 14.584465],
      [121.061502, 14.584468],
      [121.061422, 14.584467],
      [121.060967, 14.584462],
      [121.060496, 14.584465],
      [121.060068, 14.584461],
      [121.059981, 14.58446],
      [121.059887, 14.58446],
      [121.05989, 14.584376],
      [121.059896, 14.584283],
      [121.059926, 14.583834],
      [121.059943, 14.583551],
      [121.059948, 14.583456],
      [121.059967, 14.583093],
      [121.05997, 14.583037],
      [121.059971, 14.583007],
      [121.060004, 14.582215],
      [121.060013, 14.582004],
      [121.060019, 14.581883],
      [121.060002, 14.5818],
      [121.059954, 14.581706],
      [121.059656, 14.581319],
      [121.059588, 14.581232],
      [121.059532, 14.581154],
      [121.059122, 14.580635],
      [121.059101, 14.580608],
      [121.058873, 14.58032],
      [121.058812, 14.580244],
      [121.058761, 14.580182],
      [121.05823, 14.579539],
      [121.058209, 14.579516],
      [121.058113, 14.5794],
      [121.057734, 14.578906],
      [121.057433, 14.578511],
      [121.057258, 14.578286],
      [121.057225, 14.578244],
      [121.057165, 14.578168],
      [121.057246, 14.578098],
      [121.057285, 14.578065],
      [121.05759, 14.577801],
      [121.058003, 14.577443],
      [121.058094, 14.577365],
      [121.058614, 14.576915],
      [121.058733, 14.576812],
      [121.05888, 14.576684],
      [121.059229, 14.576383],
      [121.059327, 14.576298],
      [121.05941, 14.57623],
      [121.059522, 14.576138],
      [121.059598, 14.576073],
      [121.059679, 14.576003],
      [121.060846, 14.57502],
      [121.060916, 14.574959],
      [121.06096, 14.574922],
      [121.060983, 14.574902],
      [121.061076, 14.574817],
      [121.061105, 14.57479],
      [121.061194, 14.574711],
      [121.06127, 14.574642],
      [121.061409, 14.574518],
      [121.061501, 14.574436],
      [121.061585, 14.574361],
      [121.061741, 14.574221],
      [121.061791, 14.574177],
      [121.061834, 14.57414],
      [121.0619, 14.574078],
      [121.061935, 14.574047],
      [121.06211, 14.573888],
      [121.062749, 14.573353],
      [121.063049, 14.573098],
      [121.063137, 14.573023],
      [121.063191, 14.572977],
      [121.063492, 14.572721],
      [121.063516, 14.572701],
      [121.063597, 14.572631],
      [121.063998, 14.572305],
      [121.06436, 14.571983],
      [121.064429, 14.571922],
      [121.064503, 14.571859],
      [121.064544, 14.571826],
      [121.064847, 14.571582],
      [121.064983, 14.571471],
      [121.065158, 14.571331],
      [121.065302, 14.571212],
      [121.06537, 14.571158],
      [121.065778, 14.570839],
      [121.065844, 14.570782],
      [121.066041, 14.570612],
      [121.066198, 14.570473],
      [121.066365, 14.570326],
      [121.066385, 14.570305],
      [121.066407, 14.570277],
      [121.06642, 14.570255],
      [121.066433, 14.570228],
      [121.066442, 14.570202],
      [121.06645, 14.570175],
      [121.066455, 14.570152],
      [121.066459, 14.570125],
      [121.066462, 14.570096],
      [121.066465, 14.570062],
      [121.066465, 14.570034],
      [121.066463, 14.56999],
      [121.066454, 14.569917],
      [121.066469, 14.569761],
      [121.066466, 14.569739],
      [121.066457, 14.569685],
      [121.06643, 14.569536],
      [121.066299, 14.568787],
      [121.066169, 14.568031],
      [121.06616, 14.567984],
      [121.066143, 14.567884],
      [121.066103, 14.567659],
      [121.066073, 14.56749],
      [121.066037, 14.567293],
      [121.066021, 14.567209],
      [121.06598, 14.56697],
      [121.06594, 14.566745],
      [121.065932, 14.566704],
      [121.065917, 14.566619],
      [121.06586, 14.5663],
      [121.065839, 14.566185],
      [121.065806, 14.566003],
      [121.065788, 14.565901],
      [121.065781, 14.565864],
      [121.065763, 14.565754],
      [121.065711, 14.565432],
      [121.065657, 14.565304],
      [121.065613, 14.565056],
      [121.065559, 14.56474],
      [121.065523, 14.56453],
      [121.065425, 14.563991],
      [121.065406, 14.563884],
      [121.065381, 14.563751],
      [121.065367, 14.563655],
      [121.065365, 14.563559],
      [121.065382, 14.563441],
      [121.065401, 14.56338],
      [121.065444, 14.563317],
      [121.065514, 14.563244],
      [121.065606, 14.563185],
      [121.065744, 14.563134],
      [121.065836, 14.563107],
      [121.065996, 14.56306],
      [121.06618, 14.56301],
      [121.066362, 14.562957],
      [121.066524, 14.562919],
      [121.066703, 14.562883],
      [121.066837, 14.562863],
      [121.066971, 14.562846],
      [121.067105, 14.562835],
      [121.06724, 14.562828],
      [121.067375, 14.562825],
      [121.06751, 14.562827],
      [121.067645, 14.562834],
      [121.06778, 14.562844],
      [121.067914, 14.56286],
      [121.068047, 14.56288],
      [121.068166, 14.562901],
      [121.068241, 14.562917],
      [121.068444, 14.562967],
      [121.068637, 14.563042],
      [121.068743, 14.563092],
      [121.068775, 14.563109],
      [121.069177, 14.563366],
      [121.069259, 14.563293],
      [121.069294, 14.563262],
      [121.069433, 14.563138],
      [121.069543, 14.56304],
      [121.069719, 14.562883],
      [121.069688, 14.562851],
      [121.069394, 14.562543],
      [121.069352, 14.562498],
      [121.069407, 14.562446],
      [121.07043, 14.561487],
      [121.070469, 14.56145],
      [121.070569, 14.561545],
      [121.070625, 14.56149],
      [121.071241, 14.560912],
      [121.071381, 14.560648],
      [121.071606, 14.560455],
      [121.072547, 14.559625],
      [121.073149, 14.559057],
      [121.073182, 14.559027],
      [121.073223, 14.558989],
      [121.073275, 14.558945],
      [121.073327, 14.558898],
      [121.074, 14.558312],
      [121.074375, 14.557904],
      [121.074414, 14.557865],
      [121.074633, 14.557657],
      [121.074834, 14.557542],
      [121.075026, 14.55748],
      [121.075069, 14.557464],
      [121.075171, 14.55743],
      [121.075182, 14.557426],
      [121.075211, 14.557417],
      [121.07526, 14.557403],
      [121.075772, 14.557258],
      [121.075822, 14.557248],
      [121.075796, 14.557117],
      [121.075785, 14.557043],
      [121.075778, 14.556897],
      [121.075776, 14.556848],
      [121.075785, 14.556478],
      [121.07589, 14.555994],
      [121.075895, 14.55597],
      [121.075994, 14.555554],
      [121.076045, 14.555346],
      [121.076095, 14.555138],
      [121.076132, 14.554952],
      [121.076215, 14.554533],
      [121.076223, 14.554426],
      [121.076222, 14.554262],
      [121.075839, 14.553336],
      [121.075685, 14.553094],
      [121.075189, 14.552465],
      [121.075145, 14.552412],
      [121.075127, 14.55239],
      [121.07504, 14.552284],
      [121.074655, 14.551815],
      [121.074545, 14.551682],
      [121.074509, 14.551637],
      [121.074678, 14.551538],
      [121.07471, 14.551523],
      [121.074756, 14.551487],
      [121.074774, 14.551476],
      [121.074924, 14.551421],
      [121.075121, 14.551347],
      [121.075378, 14.551254],
      [121.075472, 14.551222],
      [121.075539, 14.551198],
      [121.07575, 14.551122],
      [121.075784, 14.55111],
      [121.075831, 14.551094],
      [121.075871, 14.551079],
      [121.076062, 14.551011],
      [121.076121, 14.55099],
      [121.076174, 14.55097],
      [121.076212, 14.550957],
      [121.076307, 14.550924],
      [121.076357, 14.550906],
      [121.076655, 14.5509],
      [121.076699, 14.550912],
      [121.076786, 14.550909],
      [121.077586, 14.550896],
      [121.077794, 14.550894],
      [121.078099, 14.55089],
      [121.078399, 14.550887],
      [121.078478, 14.550886],
      [121.078558, 14.550885],
      [121.078895, 14.550882],
      [121.078922, 14.549572],
      [121.078922, 14.549555],
      [121.078924, 14.549335],
      [121.078914, 14.549045],
      [121.078894, 14.548793],
      [121.078846, 14.548573],
      [121.078835, 14.548523],
      [121.078829, 14.548508],
      [121.078656, 14.547988],
      [121.078527, 14.547565],
      [121.078407, 14.547181],
      [121.078385, 14.547108],
      [121.078355, 14.546994],
      [121.078349, 14.546968],
      [121.078337, 14.546907],
      [121.07831, 14.546716],
      [121.078288, 14.546526],
      [121.07828, 14.546247],
      [121.078277, 14.545984],
      [121.078275, 14.545864],
      [121.078275, 14.545705],
      [121.078272, 14.545593],
      [121.078244, 14.545333],
      [121.078215, 14.545213],
      [121.078162, 14.545087],
      [121.078547, 14.544636],
      [121.078674, 14.544461],
      [121.078793, 14.544293],
      [121.078828, 14.544239],
      [121.078917, 14.544101],
      [121.079045, 14.543902],
      [121.079099, 14.543915],
      [121.079261, 14.543935],
      [121.079421, 14.543956]
    ].map(([lng, lat]) => ({ lat, lng }))
  ),
  confidenceState: ref({ label: 'High', tone: 'positive' as const }),
  departureCall: ref({
    tone: 'positive' as const,
    detail: 'Traffic is light right now. Riding is faster than walking today.'
  }),
  deletePreset: () => {},
  durationLabel: ref('24 min'),
  error: ref<string | null>(null),
  etaLabel: ref('8:42 AM'),
  headlineLabel: ref('Home → Office'),
  isLoading: ref(false),
  predictionMessages: ref({ action: 'Conditions look great for your commute.' }),
  presets: ref([]),
  refreshCommute: () => {},
  routes: ref([]),
  routeParts: ref({ title: 'Morning commute' }),
  saveCurrentPreset: () => {},
  signalState: ref({
    label: 'Clear',
    tone: 'positive' as const,
    detail: 'No delays detected on your route.'
  }),
  selectedPresetId: ref<string | null>(null),
  selectPreset: () => {},
  selectedRoute: ref(null),
  predictionRecommendation: ref({
    best_option: 'ride',
    ride_total_minutes: 24,
    walk_total_minutes: 38,
    ride_wait_minutes: 4,
    ride_in_vehicle_minutes: 20,
    time_saved_minutes: 14
  })
};

const MOCK_WEATHER = {
  temperatureLabel: ref('28°C'),
  currentCondition: ref({ icon: 'ph:sun-bold', label: 'Sunny' }),
  isLoading: ref(false)
};

// ─── Resolve real vs mock ─────────────────────────────────────────────────────

const commute = props.isOnboarding ? MOCK_COMMUTE : (props.commute ?? useHomeCommuteHero());

const weather = props.isOnboarding ? MOCK_WEATHER : (props.weather ?? useHomeWeatherBento());

const {
  confidenceState,
  departureCall,
  deletePreset,
  durationLabel,
  error,
  etaLabel,
  headlineLabel,
  isLoading,
  mapPoints,
  predictionMessages,
  presets,
  refreshCommute,
  routes,
  routeParts,
  saveCurrentPreset,
  signalState,
  selectedPresetId,
  selectPreset,
  selectedRoute,
  predictionRecommendation
} = commute;

const { temperatureLabel, currentCondition, isLoading: isWeatherLoading } = weather;

const presetsOpen = ref(false);
</script>
