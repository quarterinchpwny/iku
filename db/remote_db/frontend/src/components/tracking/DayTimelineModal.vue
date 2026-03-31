<template>
  <div
    v-if="dayTimelineMapOpen"
    class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/75 p-4"
    @click="closeDayTimelineMap"
  >
    <div
      class="w-full max-w-5xl overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl"
      @click.stop
    >
      <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <div class="text-sm font-semibold text-slate-800">{{ dayTimelineMapLabel }}</div>
          <div class="text-xs text-slate-500">{{ dayTimelineMapMeta }}</div>
        </div>
        <button
          @click="closeDayTimelineMap"
          class="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          Close
        </button>
      </div>
      <div class="max-h-[70vh] overflow-y-auto p-4">
        <div
          v-if="selectedDaySegments.length === 0"
          class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500"
        >
          No trip segments detected for this day.
        </div>
        <div v-else class="space-y-4">
          <div
            v-for="(seg, idx) in selectedDaySegments"
            :key="seg.id"
            class="rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <div class="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500">
              <span>Trip {{ idx + 1 }}</span>
              <span>{{ seg.startTime }} -> {{ seg.endTime }}</span>
            </div>
            <div class="mb-2 flex flex-wrap items-center gap-2 text-[10px]">
              <span
                class="rounded border px-2 py-0.5 font-mono"
                :class="
                  seg.hasRoute14
                    ? 'border-amber-300 bg-amber-100 text-amber-900'
                    : 'border-slate-300 bg-white text-slate-700'
                "
              >
                routes {{ seg.routeLabel }}
              </span>
              <span
                v-if="seg.hasRoute14"
                class="rounded border border-amber-300 bg-amber-100 px-2 py-0.5 font-mono text-amber-900"
              >
                includes #14
              </span>
              <span class="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-slate-700">
                {{ seg.pointCount }} pts
              </span>
              <span class="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-slate-700">
                {{ seg.durationLabel }}
              </span>
              <span class="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-slate-700">
                {{ seg.displacementMeters }}m disp
              </span>
            </div>
            <div class="relative pl-4">
              <div class="absolute bottom-2 left-[6px] top-2 w-px bg-slate-300"></div>
              <div class="relative mb-2 rounded-md border border-emerald-200 bg-emerald-50 p-2">
                <span class="absolute -left-[14px] top-3 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500"></span>
                <div class="text-xs font-semibold text-emerald-900">{{ seg.startStory }}</div>
                <div class="mt-1 text-[10px] text-emerald-700">{{ seg.startTime }}</div>
              </div>
              <div class="mb-2 rounded-md border border-sky-200 bg-sky-50 p-2">
                <div
                  :ref="(el) => setDaySegmentMapRef(el, seg.id)"
                  class="h-36 w-full rounded border border-slate-200 bg-white"
                ></div>
              </div>
              <div class="relative rounded-md border border-amber-200 bg-amber-50 p-2">
                <span class="absolute -left-[14px] top-3 h-2.5 w-2.5 rounded-full border border-white bg-amber-500"></span>
                <div class="text-xs font-semibold text-amber-900">{{ seg.endStory }}</div>
                <div class="mt-1 text-[10px] text-amber-700">{{ seg.endTime }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAdminAppContext } from '../../composables/useAdminAppContext'

const { closeDayTimelineMap, dayTimelineMapLabel, dayTimelineMapMeta, dayTimelineMapOpen, selectedDaySegments, setDaySegmentMapRef } =
  useAdminAppContext().timeline
</script>
