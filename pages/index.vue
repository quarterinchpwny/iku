<template>
  <div class="home-shell min-h-screen px-4 py-5 sm:px-6">
    <div class="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-5xl flex-col gap-4">
      <div
        v-if="otaStore.updateAvailable"
        class="overflow-hidden rounded-3xl border border-cyan-400/15 bg-slate-950 p-4 text-white shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
      >
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
              OTA Ready
            </div>
            <div class="mt-2 text-lg font-semibold">
              Version {{ otaStore.latestVersion?.version }} is available.
            </div>
          </div>
          <button
            :disabled="otaStore.isUpdating"
            class="hover:bg-cyan-400/14 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/35 active:scale-95 disabled:opacity-50"
            @click="otaStore.performUpdate()"
          >
            {{ otaStore.isUpdating ? 'Updating...' : 'Update Now' }}
          </button>
        </div>
      </div>

      <WeatherPanel />

      <HomeStatusStrip :items="statusItems" />

      <HomeOverviewPanel
        :heading="overviewHeading"
        :summary="overviewSummary"
        :stats="overviewStats"
      />

      <div class="flex-1 overflow-auto pb-10">
        <div
          v-if="pageError"
          class="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-200"
        >
          {{ pageError }}
        </div>

        <div v-else-if="isHydrating && passiveDayTimeline.length === 0" class="grid gap-4">
          <div class="h-32 animate-pulse rounded-3xl border border-slate-800 bg-slate-950"></div>
          <div class="h-52 animate-pulse rounded-3xl border border-slate-800 bg-slate-950"></div>
          <div class="h-52 animate-pulse rounded-3xl border border-slate-800 bg-slate-950"></div>
        </div>

        <div
          v-else-if="passiveDayTimeline.length === 0"
          class="rounded-3xl border border-slate-800 bg-slate-950 p-8 text-center"
        >
          <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Shield Timeline
          </div>
          <div class="mt-4 text-2xl font-semibold text-white">No telemetry data recorded yet</div>
          <div class="mt-2 text-sm text-slate-400">
            Plugin data loads first, then cloud data is merged when available.
          </div>
        </div>

        <div v-else class="space-y-4">
          <HomeTimelineHeader
            :day-label="dashboardTimelineActiveDay?.label || 'Timeline'"
            :summary="dashboardTimelineActiveDay?.summary || 'No summary available yet.'"
            :trip-count="dashboardTimelineStats.tripCount"
            :distance-label="dashboardTimelineStats.displacementLabel"
            :duration-label="dashboardTimelineStats.durationLabel"
            :sync-label="syncLabel"
            :days="passiveDayTimeline"
            :active-day-key="dashboardTimelineDayKey"
            @select="selectDashboardTimelineDay"
          />

          <div class="grid gap-4">
            <HomeTripCard
              v-for="(row, index) in dashboardTimelineRows"
              :key="row.id"
              :row="row"
              :featured="index === 0"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import WeatherPanel from '~/components/widgets/WeatherPanel.vue';
import HomeOverviewPanel from '~/components/home/HomeOverviewPanel.vue';
import HomeStatusStrip from '~/components/home/HomeStatusStrip.vue';
import HomeTimelineHeader from '~/components/home/HomeTimelineHeader.vue';
import HomeTripCard from '~/components/home/HomeTripCard.vue';
import { useOTAStore } from '~/stores/ota';
import { useHomeDashboard } from '~/composables/home/useHomeDashboard';

const otaStore = useOTAStore();
const {
  dashboardTimelineDayKey,
  isHydrating,
  pageError,
  passiveDayTimeline,
  dashboardTimelineActiveDay,
  dashboardTimelineRows,
  dashboardTimelineStats,
  syncLabel,
  overviewHeading,
  overviewSummary,
  overviewStats,
  statusItems,
  selectDashboardTimelineDay
} = useHomeDashboard();
</script>

<style scoped>
.home-shell {
  background: linear-gradient(180deg, rgba(11, 16, 23, 0.98), rgba(8, 12, 18, 1));
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
