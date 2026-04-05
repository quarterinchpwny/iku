<template>
  <main class="min-h-screen bg-[#090a0c] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
    <div class="mx-auto flex max-w-7xl flex-col gap-6">
      <section class="grid grid-cols-12 gap-6">
        <QueuePresetPanel
          class="col-span-12"
          :presets="presets"
          :routes="routes"
          :selected-preset-id="selectedPresetId"
          :selected-route-key="selectedRouteKey"
          @delete-preset="deletePreset"
          @save-preset="saveCurrentPreset($event.label, $event.is_default)"
          @select-preset="selectPreset"
        />
        <QueueRoutePanel
          class="col-span-12"
          :create-mode="editorMode === 'create'"
          :create-template="createTemplate"
          :loading-route="loading.route"
          :loading-routes="loading.routes"
          :route-detail="routeDetail"
          :route-error="errors.route"
          :routes="routes"
          :routes-error="errors.routes"
          :save-error="errors.save"
          :save-message="messages.save"
          :selected-route-key="selectedRouteKey"
          :saving-route="loading.save"
          @cancel-create="cancelCreateRoute"
          @create-route="createRoute"
          @refresh-routes="loadRoutes"
          @save-route="saveRoute"
          @select-route="selectRoute"
          @start-create="startCreateRoute"
        />
      </section>
      <QueueEstimatePanel
        class="col-span-12"
        :error="errors.estimate"
        :estimate="estimate"
        :loading="loading.estimate"
        @refresh="refreshPredictions"
      />
      <QueueEstimateMapPanel
        class="col-span-12"
        :error="errors.estimate"
        :estimate="estimate"
        :loading="loading.estimate"
        :route="routeDetail"
        @refresh="refreshPredictions"
      />
      <QueueContextPanel
        class="col-span-12"
        :context-error="errors.context"
        :context-message="messages.context"
        :estimate="estimate"
        :holiday-error="errors.holidays"
        :holiday-year="holidayYear"
        :incidents="incidents"
        :loading-context="loading.context"
        :loading-holidays="loading.holidays"
        :loading-venues="loading.venues"
        :observations="observations"
        :route-detail="routeDetail"
        :venue-candidates="venueCandidates"
        :venue-error="errors.venues"
        @create-incident="createIncident"
        @create-observation="createObservation"
        @delete-incident="deleteIncident"
        @delete-observation="deleteObservation"
        @discover-venues="(radiusMeters) => discoverVenues(selectedRouteKey, radiusMeters)"
        @sync-holidays="syncHolidayCalendar"
      />
      <section class="grid grid-cols-12 gap-6">
        <QueueHeatmapPanel
          class="col-span-12"
          :error="errors.heatmap"
          :heatmap="heatmap"
          :loading="loading.heatmap"
          @refresh="refreshPredictions"
        />
      </section>
    </div>
  </main>
</template>

<script setup>
import QueueEstimateMapPanel from './QueueEstimateMapPanel.vue';
import QueueEstimatePanel from './QueueEstimatePanel.vue';
import QueueHeatmapPanel from './QueueHeatmapPanel.vue';
import QueueContextPanel from './QueueContextPanel.vue';
import QueuePresetPanel from './QueuePresetPanel.vue';
import QueueRoutePanel from './QueueRoutePanel.vue';
import { useQueuePredictionTester } from '@/composables/useQueuePredictionTester';

const {
  cancelCreateRoute,
  createIncident,
  createObservation,
  createRoute,
  createTemplate,
  deletePreset,
  deleteIncident,
  deleteObservation,
  discoverVenues,
  editorMode,
  errors,
  estimate,
  heatmap,
  holidayYear,
  incidents,
  loading,
  observations,
  loadRoutes,
  messages,
  presets,
  refreshPredictions,
  saveCurrentPreset,
  routeDetail,
  routes,
  saveRoute,
  selectedPresetId,
  selectPreset,
  selectRoute,
  selectedRouteKey,
  startCreateRoute,
  syncHolidayCalendar,
  venueCandidates
} = useQueuePredictionTester();
</script>
