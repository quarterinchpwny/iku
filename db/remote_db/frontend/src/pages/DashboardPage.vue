<template>
  <main class="mx-auto max-w-7xl px-4 py-8 text-white sm:px-6 lg:px-8">
    <div class="mb-6 rounded-[1rem] border border-zinc-800 bg-zinc-950/90 p-5">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold tracking-wide text-white">Visited Places</h3>
          <p class="mt-1 text-xs text-zinc-500">
            Real place visits with reverse-geocoded labels from `/api/location/places` and
            `/api/location/timeline`.
          </p>
        </div>
        <div class="grid grid-cols-2 gap-2 text-[11px]">
          <div class="rounded-lg border border-zinc-800 bg-[#090a0c]/90 px-2 py-1.5">
            <div class="text-zinc-500">Places</div>
            <div class="font-semibold text-zinc-100">{{ visitedTopPlaces.length }}</div>
          </div>
          <div class="rounded-lg border border-zinc-800 bg-[#090a0c]/90 px-2 py-1.5">
            <div class="text-zinc-500">Timeline</div>
            <div class="font-semibold text-zinc-100">{{ visitedTimelineSegments.length }}</div>
          </div>
        </div>
      </div>
      <div
        v-if="visitedPlacesLoading"
        class="rounded-[1rem] border border-zinc-800 bg-[#090a0c]/90 px-3 py-4 text-center text-xs text-zinc-500"
      >
        Loading visited places...
      </div>
      <div
        v-else-if="visitedPlacesError"
        class="rounded-[1rem] border border-rose-900 bg-rose-950/50 px-3 py-4 text-center text-xs text-rose-300"
      >
        {{ visitedPlacesError }}
      </div>
      <div
        v-else-if="visitedTopPlaces.length === 0 && visitedTimelineDays.length === 0"
        class="rounded-[1rem] border border-zinc-800 bg-[#090a0c]/90 px-3 py-4 text-center text-xs text-zinc-500"
      >
        No visited-place records yet.
      </div>
      <div v-else class="space-y-4">
        <div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div class="rounded-[1rem] border border-zinc-800 bg-[#090a0c]/90 p-4 xl:col-span-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Top Places
              </div>
              <div
                v-if="visitedActivePlace"
                class="rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 font-mono text-[10px] text-orange-200"
              >
                {{ visitedActivePlace.visitCount }} visits
              </div>
            </div>
            <div class="max-h-[32rem] space-y-2 overflow-auto pr-1">
              <button
                v-for="place in visitedTopPlaces"
                :key="`visited-place-${place.id}`"
                type="button"
                @click="selectVisitedPlace(place.id)"
                :class="[
                  'w-full rounded-lg border px-3 py-3 text-left transition-colors',
                  visitedActivePlace?.id === place.id
                    ? 'border-orange-500/50 bg-orange-500/10'
                    : 'border-zinc-800 bg-zinc-950/90 hover:border-zinc-700'
                ]"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="truncate text-sm font-semibold text-zinc-100">
                      {{ place.name }}
                    </div>
                    <div class="mt-1 truncate text-[10px] text-zinc-500">
                      {{ place.geocodeName || 'Saved visited place centroid' }}
                    </div>
                    <div class="mt-1 truncate font-mono text-[10px] text-zinc-500">
                      {{ place.lat.toFixed(5) }}, {{ place.lng.toFixed(5) }}
                    </div>
                  </div>
                  <div
                    :class="[
                      'rounded-full border px-2 py-0.5 font-mono text-[10px]',
                      visitedActivePlace?.id === place.id
                        ? 'border-orange-500/40 bg-orange-500/10 text-orange-200'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-300'
                    ]"
                  >
                    {{ place.visitCount }}
                  </div>
                </div>
                <div class="mt-2 text-[10px] text-zinc-500">
                  Last seen {{ new Date(place.lastSeenMs).toLocaleString() }}
                </div>
              </button>
            </div>
          </div>

          <div class="rounded-[1rem] border border-zinc-800 bg-[#090a0c]/90 p-4 xl:col-span-8">
            <div
              v-if="visitedActivePlace"
              class="mb-3 flex flex-col gap-3 border-b border-zinc-800 pb-3 md:flex-row md:items-start md:justify-between"
            >
              <div class="min-w-0">
                <div
                  class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500"
                >
                  <MapPinned :size="12" /><span>Selected Place</span>
                </div>
                <div class="mt-1 truncate text-lg font-semibold text-zinc-100">
                  {{ visitedActivePlace.name }}
                </div>
                <div class="mt-1 truncate text-xs text-zinc-500">
                  {{ visitedActivePlace.geocodeName || 'Saved visited place centroid' }}
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2 text-[10px] md:min-w-[13rem]">
                <div class="rounded border border-zinc-800 bg-zinc-950/90 px-2 py-1.5">
                  <div class="text-zinc-500">Coordinates</div>
                  <div class="mt-1 font-mono text-zinc-300">
                    {{ visitedActivePlace.lat.toFixed(5) }}, {{ visitedActivePlace.lng.toFixed(5) }}
                  </div>
                </div>
                <div class="rounded border border-zinc-800 bg-zinc-950/90 px-2 py-1.5">
                  <div class="text-zinc-500">Last seen</div>
                  <div class="mt-1 text-zinc-300">
                    {{ new Date(visitedActivePlace.lastSeenMs).toLocaleDateString() }}
                  </div>
                </div>
              </div>
            </div>
            <div
              :ref="setVisitedPlaceMapRef"
              class="h-[24rem] w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 md:h-[28rem]"
            ></div>
          </div>
        </div>

        <div class="rounded-[1rem] border border-zinc-800 bg-[#090a0c]/90 p-4">
          <div class="mb-3 flex flex-wrap gap-2">
            <button
              v-for="day in visitedTimelineDays"
              :key="`visited-day-${day.dayKey}`"
              @click="visitedTimelineDayKey = day.dayKey"
              :class="[
                'rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors',
                visitedTimelineActiveDay?.dayKey === day.dayKey
                  ? 'border-orange-500/50 bg-orange-500/10 text-orange-300'
                  : 'border-zinc-700 bg-zinc-950/90 text-zinc-400 hover:border-orange-500/40 hover:text-zinc-100'
              ]"
            >
              <span>{{ day.label }}</span>
              <span class="ml-2 font-mono text-[10px]">
                {{ day.placeCount }} places / {{ day.tripCount }} trips
              </span>
            </button>
          </div>
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div class="rounded-[1rem] border border-zinc-800 bg-[#090a0c]/90 p-4 lg:col-span-4">
              <div class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {{ visitedTimelineActiveDay?.label || 'Recent day' }}
              </div>
              <div class="mt-2 text-sm font-medium text-zinc-100">
                {{ visitedTimelineActiveDay?.summary || 'No visited-place summary available.' }}
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div class="rounded-lg border border-zinc-800 bg-zinc-950/90 px-2 py-1.5">
                  <div class="text-zinc-500">Places</div>
                  <div class="font-semibold text-zinc-100">
                    {{ visitedTimelineStats.placeCount }}
                  </div>
                </div>
                <div class="rounded-lg border border-zinc-800 bg-zinc-950/90 px-2 py-1.5">
                  <div class="text-zinc-500">Trips</div>
                  <div class="font-semibold text-zinc-100">
                    {{ visitedTimelineStats.tripCount }}
                  </div>
                </div>
                <div class="rounded-lg border border-zinc-800 bg-zinc-950/90 px-2 py-1.5">
                  <div class="text-zinc-500">Distance</div>
                  <div class="font-semibold text-zinc-100">
                    {{ visitedTimelineStats.distanceLabel }}
                  </div>
                </div>
                <div class="rounded-lg border border-zinc-800 bg-zinc-950/90 px-2 py-1.5">
                  <div class="text-zinc-500">Duration</div>
                  <div class="font-semibold text-zinc-100">
                    {{ visitedTimelineStats.durationLabel }}
                  </div>
                </div>
              </div>
            </div>
            <div class="lg:col-span-8">
              <div
                class="max-h-72 space-y-3 overflow-auto rounded-[1rem] border border-zinc-800 bg-[#090a0c]/90 p-3"
              >
                <div
                  v-for="row in visitedTimelineRows"
                  :key="row.id"
                  class="rounded-lg border border-zinc-800 bg-zinc-950/90 p-3"
                >
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span
                        class="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300"
                      >
                        {{ row.eyebrow }}
                      </span>
                      <span class="text-xs font-semibold text-zinc-100">{{ row.title }}</span>
                    </div>
                    <div class="flex items-center gap-1 font-mono text-[10px] text-zinc-500">
                      <Clock :size="12" /><span>{{ row.rangeLabel }}</span>
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-1.5 text-[10px]">
                    <span
                      class="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-zinc-300"
                    >
                      {{ row.metaLabel }}
                    </span>
                    <span
                      class="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-zinc-300"
                    >
                      {{ row.detailLabel }}
                    </span>
                  </div>
                </div>
                <div
                  v-if="visitedTimelineRows.length === 0"
                  class="rounded-lg border border-zinc-800 bg-zinc-950/90 px-3 py-4 text-center text-xs text-zinc-500"
                >
                  No visited-place timeline for the selected day.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <DashboardQueueMapPanel class="mb-6" />

    <div
      class="mb-6 rounded-[1rem] border border-zinc-800 bg-zinc-950/90 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
    >
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-sm font-semibold tracking-wide text-white">Tracking Timeline</h3>
        <button
          v-if="dashboardTimelineActiveDay"
          @click="openDayTimelineFromDashboard(dashboardTimelineActiveDay)"
          class="rounded-full border border-zinc-700 bg-zinc-950/90 px-2.5 py-1 text-[10px] font-medium text-zinc-400 transition hover:border-orange-500/40 hover:text-zinc-100"
        >
          Open Map Timeline
        </button>
      </div>
      <div
        v-if="passiveDayTimeline.length === 0"
        class="rounded-[1rem] border border-zinc-800 bg-[#090a0c]/90 px-3 py-4 text-center text-xs text-zinc-500"
      >
        No passive timeline yet.
      </div>
      <div v-else class="space-y-4">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="day in passiveDayTimeline"
            :key="`dash-chip-${day.dayKey}`"
            @click="selectDashboardTimelineDay(day.dayKey)"
            :class="[
              'rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors',
              dashboardTimelineActiveDay?.dayKey === day.dayKey
                ? 'border-orange-500/50 bg-orange-500/10 text-orange-300'
                : 'border-zinc-700 bg-zinc-950/90 text-zinc-400 hover:border-orange-500/40 hover:text-zinc-100'
            ]"
          >
            <span>{{ day.label }}</span>
            <span class="ml-2 font-mono text-[10px]">{{ day.routeCount }} routes</span>
          </button>
        </div>
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div class="rounded-[1rem] border border-zinc-800 bg-[#090a0c]/90 p-4 lg:col-span-4">
            <div class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {{ dashboardTimelineActiveDay?.label || 'Timeline Day' }}
            </div>
            <div class="mt-2 text-sm font-medium text-zinc-100">
              {{ dashboardTimelineActiveDay?.summary || 'No day summary available.' }}
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div class="rounded-lg border border-zinc-800 bg-zinc-950/90 px-2 py-1.5">
                <div class="text-zinc-500">Trips</div>
                <div class="font-semibold text-zinc-100">
                  {{ dashboardTimelineStats.tripCount }}
                </div>
              </div>
              <div class="rounded-lg border border-zinc-800 bg-zinc-950/90 px-2 py-1.5">
                <div class="text-zinc-500">Routes</div>
                <div class="font-semibold text-zinc-100">
                  {{ dashboardTimelineActiveDay?.routeCount || 0 }}
                </div>
              </div>
              <div class="rounded-lg border border-zinc-800 bg-zinc-950/90 px-2 py-1.5">
                <div class="text-zinc-500">Distance</div>
                <div class="font-semibold text-zinc-100">
                  {{ dashboardTimelineStats.displacementLabel }}
                </div>
              </div>
              <div class="rounded-lg border border-zinc-800 bg-zinc-950/90 px-2 py-1.5">
                <div class="text-zinc-500">Duration</div>
                <div class="font-semibold text-zinc-100">
                  {{ dashboardTimelineStats.durationLabel }}
                </div>
              </div>
            </div>
          </div>
          <div class="lg:col-span-8">
            <div
              class="max-h-72 space-y-3 overflow-auto rounded-[1rem] border border-zinc-800 bg-[#090a0c]/90 p-3"
            >
              <div
                v-for="(row, idx) in dashboardTimelineRows"
                :key="`dash-seg-${row.id}`"
                class="relative pl-10"
              >
                <div
                  class="absolute left-4 top-0 h-full w-px bg-zinc-700"
                  :class="idx === dashboardTimelineRows.length - 1 ? 'h-7' : 'h-full'"
                ></div>
                <div
                  class="absolute left-[10px] top-3 h-3 w-3 rounded-full border border-zinc-900 bg-orange-500"
                ></div>
                <div class="rounded-lg border border-zinc-800 bg-zinc-950/90 p-3">
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span
                        class="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300"
                      >
                        {{ row.mode }}
                      </span>
                      <span
                        class="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-500"
                      >
                        Trip {{ row.timelineIndex }}
                      </span>
                    </div>
                    <div class="flex items-center gap-1 font-mono text-[10px] text-zinc-500">
                      <Clock :size="12" /><span>{{ row.rangeLabel }}</span>
                    </div>
                  </div>
                  <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div class="rounded-md border border-zinc-800 bg-[#090a0c]/90 px-2.5 py-2">
                      <div
                        class="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500"
                      >
                        <MapPinned :size="12" /><span>Start</span>
                      </div>
                      <div class="text-xs font-semibold text-zinc-100">
                        {{ row.startPlace }}
                      </div>
                      <div class="mt-0.5 text-[10px] text-zinc-500">{{ row.startStory }}</div>
                    </div>
                    <div class="rounded-md border border-zinc-800 bg-[#090a0c]/90 px-2.5 py-2">
                      <div
                        class="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500"
                      >
                        <MapPinned :size="12" /><span>End</span>
                      </div>
                      <div class="text-xs font-semibold text-zinc-100">{{ row.endPlace }}</div>
                      <div class="mt-0.5 text-[10px] text-zinc-500">{{ row.endStory }}</div>
                    </div>
                  </div>
                  <div class="mt-2 rounded-md border border-zinc-800 bg-[#090a0c]/90 px-2 py-2">
                    <div class="mb-1 flex items-center justify-between">
                      <span
                        class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500"
                      >
                        Route Preview
                      </span>
                      <span class="font-mono text-[10px] text-zinc-500">{{ row.rangeLabel }}</span>
                    </div>
                    <div
                      :ref="(el) => setDashboardTimelineMapRef(el, row.id)"
                      class="h-24 w-full overflow-hidden rounded border border-zinc-800 bg-zinc-950"
                    ></div>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                    <span
                      class="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-zinc-300"
                    >
                      {{ row.routeLabel }}
                    </span>
                    <span
                      class="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-zinc-300"
                    >
                      {{ row.durationLabel }}
                    </span>
                    <span
                      class="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-zinc-300"
                    >
                      {{ row.displacementMeters }}m
                    </span>
                    <span
                      class="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-zinc-300"
                    >
                      {{ row.pointCount }} pts
                    </span>
                  </div>
                </div>
              </div>
              <div
                v-if="dashboardTimelineRows.length === 0"
                class="rounded-lg border border-zinc-800 bg-zinc-950/90 px-3 py-4 text-center text-xs text-zinc-500"
              >
                No trip segments detected for selected day.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </main>
</template>

<script setup>
import { Clock, MapPinned } from 'lucide-vue-next';
import DashboardQueueMapPanel from '../components/queue/DashboardQueueMapPanel.vue';
import { useAdminAppContext } from '../composables/useAdminAppContext';

const app = useAdminAppContext();
const {
  dashboardTimelineActiveDay,
  dashboardTimelineRows,
  dashboardTimelineStats,
  openDayTimelineFromDashboard,
  passiveDayTimeline,
  selectDashboardTimelineDay,
  selectVisitedPlace,
  setDashboardTimelineMapRef,
  setVisitedPlaceMapRef,
  visitedActivePlace,
  visitedPlacesError,
  visitedPlacesLoading,
  visitedTimelineActiveDay,
  visitedTimelineDayKey,
  visitedTimelineDays,
  visitedTimelineRows,
  visitedTimelineSegments,
  visitedTimelineStats,
  visitedTopPlaces
} = app.dashboard;
</script>
