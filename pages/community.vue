<template>
  <div
    ref="pageRoot"
    class="relative flex flex-col overflow-hidden pb-16 font-['Instrument_Sans',system-ui,sans-serif] text-white"
    style="height: calc(100dvh - env(safe-area-inset-top))"
  >
    <!-- ══ MAP SECTION ══════════════════════════════════════ -->
    <div
      class="relative z-0 flex-shrink-0 overflow-hidden"
      :style="{
        height: mapHeight + 'px',
        transition: isDragging ? 'none' : 'height 240ms ease'
      }"
    >
      <div
        ref="heroMapContainer"
        class="absolute inset-0 z-0 [&_.leaflet-container]:!bg-[#0f1113] [&_.leaflet-control-zoom_a]:rounded-[0.9rem] [&_.leaflet-control-zoom_a]:border [&_.leaflet-control-zoom_a]:border-white/10 [&_.leaflet-control-zoom_a]:bg-[#141414] [&_.leaflet-control-zoom_a]:text-zinc-100"
      ></div>

      <!-- gradient scrim -->
      <div
        class="pointer-events-none absolute inset-0 z-10"
        style="
          background: linear-gradient(
            to top,
            rgba(10, 10, 10, 0.97) 0%,
            rgba(10, 10, 10, 0.3) 40%,
            rgba(10, 10, 10, 0.15) 100%
          );
        "
      ></div>

      <!-- top bar -->
      <div class="absolute left-0 right-0 top-0 z-20 flex items-start justify-between px-4 pt-4">
        <div class="flex flex-col">
          <span class="text-sm text-zinc-300">Tracking</span>
          <span class="text-3xl font-semibold leading-none">Routes</span>
          <span class="mt-1 text-xs text-zinc-400">{{ headerStatusLabel }}</span>
        </div>
        <div class="mt-1 flex gap-2">
          <div :class="innerSurfaceClass" class="flex min-w-[56px] flex-col items-center px-3 py-2">
            <span class="text-base font-bold leading-none text-white">{{ history.length }}</span>
            <span class="mt-1 text-[10px] text-zinc-500">All</span>
          </div>
          <div
            class="flex min-w-[56px] flex-col items-center rounded-[0.9rem] border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-orange-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <span class="text-base font-bold leading-none">{{ activeCount }}</span>
            <span class="mt-1 text-[10px] text-orange-200/70">Active</span>
          </div>
          <div :class="innerSurfaceClass" class="flex min-w-[56px] flex-col items-center px-3 py-2">
            <span class="text-base font-bold leading-none text-white">{{ passiveCount }}</span>
            <span class="mt-1 text-[10px] text-zinc-500">Passive</span>
          </div>
        </div>
      </div>

      <div
        v-if="mapOverlayState"
        class="pointer-events-none absolute inset-x-4 top-1/2 z-20 -translate-y-1/2"
      >
        <div :class="pageSurfaceClass" class="mx-auto max-w-[22rem] px-4 py-4 text-center">
          <p class="text-sm font-semibold text-white">{{ mapOverlayState.title }}</p>
          <p class="mt-1 text-xs leading-5 text-zinc-400">{{ mapOverlayState.detail }}</p>
        </div>
      </div>

      <!-- selected route info — bottom of map (only in split mode) -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-1.5 opacity-0"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="translate-y-1.5 opacity-0"
      >
        <div
          v-if="selectedRoute && panelSnap !== 'map'"
          class="absolute bottom-0 left-0 right-0 z-20 px-4 pb-3"
        >
          <div :class="pageSurfaceClass" class="px-4 py-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-bold text-white">#{{ selectedRoute.id }}</span>
              <span
                class="rounded-[0.85rem] border px-2 py-0.5 text-[10px] font-semibold"
                :class="
                  selectedRoute.classification === 'ACTIVE'
                    ? 'border-orange-500/30 bg-orange-500/10 text-orange-300'
                    : 'border-white/10 bg-[#141414] text-zinc-300'
                "
                >{{ selectedRoute.classification }}</span
              >
              <span class="text-xs text-zinc-400">{{
                new Date(selectedRoute.timestamp).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              }}</span>
              <span
                v-if="routePointsLoading"
                class="flex items-center gap-1 text-[10px] text-zinc-400"
              >
                <span
                  class="h-2.5 w-2.5 animate-spin rounded-full border-2 border-orange-400/70 border-t-transparent"
                ></span>
                Loading points
              </span>
            </div>
            <p class="mt-2 truncate text-xs text-zinc-400">{{ selectedRoute.story }}</p>
          </div>
        </div>
      </Transition>

      <!-- FULL MAP MODE: mini route SVG strip -->
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="translate-y-3 opacity-0"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="translate-y-3 opacity-0"
      >
        <div
          v-if="panelSnap === 'map' && displayedHistory.length"
          class="absolute bottom-0 left-0 right-0 z-20 px-3 pb-3"
        >
          <div
            class="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <button
              v-for="route in displayedHistory.slice(0, 25)"
              :key="`mini-${route.id}`"
              class="group relative flex-shrink-0 overflow-hidden rounded-[0.9rem] border bg-[#141414] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors"
              :class="
                Number(selectedRouteId) === Number(route.id)
                  ? 'border-orange-500/40 bg-black/40'
                  : 'border-white/10 hover:border-white/20'
              "
              style="width: 72px; height: 80px"
              @click="focusRoute(route.id)"
            >
              <!-- SVG polyline of the route -->
              <svg
                viewBox="0 0 100 100"
                class="absolute inset-0 w-full"
                style="height: 60px"
                preserveAspectRatio="xMidYMid meet"
              >
                <polyline
                  v-if="routeSvgPaths.get(Number(route.id))"
                  :points="routeSvgPaths.get(Number(route.id))"
                  :stroke="route.classification === 'ACTIVE' ? '#f97316' : '#60a5fa'"
                  stroke-width="2.5"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  opacity="0.9"
                />
                <text v-else x="50" y="50" text-anchor="middle" fill="#52525b" font-size="10">
                  no pts
                </text>
              </svg>

              <!-- label -->
              <div class="absolute bottom-0 left-0 right-0 px-1 pb-1 text-center">
                <span class="font-mono text-[9px] font-bold text-zinc-400">{{
                  routeDisplayLabel(route)
                }}</span>
              </div>
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- ══ DRAG HANDLE ══════════════════════════════════════ -->
    <div
      class="relative z-30 flex flex-shrink-0 cursor-row-resize select-none flex-col items-center justify-center rounded-[1rem]"
      style="height: 28px; touch-action: none"
      @mousedown="startDrag"
      @touchstart.prevent="startDrag"
    >
      <!-- snap indicator dots -->
      <div class="flex items-center gap-2">
        <div
          class="h-1 rounded-full transition-all duration-200"
          :class="panelSnap === 'map' ? 'w-6 bg-orange-400' : 'w-2 bg-zinc-700'"
        ></div>
        <div
          class="h-1 rounded-full transition-all duration-200"
          :class="panelSnap === 'split' ? 'w-6 bg-orange-400' : 'w-2 bg-zinc-700'"
        ></div>
        <div
          class="h-1 rounded-full transition-all duration-200"
          :class="panelSnap === 'list' ? 'w-6 bg-orange-400' : 'w-2 bg-zinc-700'"
        ></div>
      </div>
    </div>

    <!-- ══ PANEL SECTION ════════════════════════════════════ -->
    <div class="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
      <!-- day timeline chips -->
      <div
        v-if="dayTimeline.length && panelSnap !== 'map'"
        class="flex flex-shrink-0 gap-2 overflow-x-auto px-3 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div class="mr-1 flex flex-shrink-0 gap-2">
          <button
            class="rounded-[0.9rem] border px-3 py-2 text-[11px] font-semibold transition-colors"
            :class="
              listMode === 'days'
                ? 'border-orange-500/40 bg-orange-500/10 text-white'
                : 'border-white/10 bg-[#141414] text-zinc-300'
            "
            @click="listMode = 'days'"
          >
            Days
          </button>
          <button
            class="rounded-[0.9rem] border px-3 py-2 text-[11px] font-semibold transition-colors"
            :class="
              listMode === 'routes'
                ? 'border-orange-500/40 bg-orange-500/10 text-white'
                : 'border-white/10 bg-[#141414] text-zinc-300'
            "
            @click="listMode = 'routes'"
          >
            Routes
          </button>
        </div>
        <button
          v-for="day in dayTimeline"
          :key="day.dayKey"
          :class="innerSurfaceClass"
          class="flex flex-shrink-0 flex-col items-start px-3 py-2 transition-colors active:border-orange-500/40 active:bg-orange-500/10"
          @click="focusFirstRouteForDay(day.dayKey)"
        >
          <span class="text-[11px] font-semibold text-zinc-200">{{ day.label }}</span>
          <span class="mt-0.5 text-[10px] text-zinc-500"
            >{{ day.routeCount }} · {{ day.totalDurationLabel }}</span
          >
        </button>
      </div>

      <!-- search bar -->
      <!-- <div v-if="panelSnap !== 'map'" class="flex-shrink-0 px-3 pb-2">
        <div class="relative">
          <svg
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            viewBox="0 0 20 20"
            fill="none"
          >
            <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.5" />
            <path
              d="M13 13l3.5 3.5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
          <input
            v-model="search"
            type="text"
            placeholder="Search routes…"
            class="w-full rounded-[1rem] border border-zinc-800 bg-zinc-900 py-2.5 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-500 transition focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>
      </div> -->

      <!-- routes list -->
      <div
        class="flex-1 space-y-2 overflow-y-auto px-3 pb-2"
        :class="panelSnap === 'map' ? 'pointer-events-none opacity-0' : 'opacity-100'"
        style="transition: opacity 200ms"
      >
        <template v-if="isInitialHistoryLoading && !history.length">
          <div
            v-for="index in 4"
            :key="`route-skeleton-${index}`"
            :class="pageSurfaceClass"
            class="overflow-hidden"
          >
            <div class="flex">
              <div class="w-24 flex-shrink-0 border-r border-white/10 bg-[#141414] px-3 py-4">
                <div class="min-h-[120px] animate-pulse rounded-[0.9rem] bg-white/10"></div>
              </div>
              <div class="flex min-w-0 flex-1 flex-col gap-3 px-3 py-3">
                <div class="flex items-center justify-between gap-2">
                  <div class="h-3 w-28 animate-pulse rounded bg-white/10"></div>
                  <div class="h-6 w-14 animate-pulse rounded-[0.9rem] bg-white/10"></div>
                </div>
                <div class="space-y-2">
                  <div class="h-3 animate-pulse rounded bg-white/10"></div>
                  <div class="h-3 w-4/5 animate-pulse rounded bg-white/10"></div>
                </div>
                <div class="flex gap-2">
                  <div class="h-5 w-20 animate-pulse rounded-[0.85rem] bg-white/10"></div>
                  <div class="h-5 w-16 animate-pulse rounded-[0.85rem] bg-white/10"></div>
                  <div class="h-5 w-14 animate-pulse rounded-[0.85rem] bg-white/10"></div>
                </div>
              </div>
            </div>
            <div class="border-t border-white/10 px-[14px] py-[7px]">
              <div class="h-3 w-40 animate-pulse rounded bg-white/10"></div>
            </div>
          </div>
        </template>
        <template v-else-if="displayedHistory.length > 0">
          <div
            v-for="route in displayedHistory"
            :key="route.id"
            :class="[
              pageSurfaceClass,
              'cursor-pointer overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/20 active:scale-[0.99]',
              Number(selectedRouteId) === Number(route.id) ? 'border-orange-500/40' : ''
            ]"
            @click="focusRoute(route.id)"
          >
            <!-- top: mini map + info side by side -->
            <div class="flex">
              <!-- mini map -->
              <div
                class="flex w-24 flex-shrink-0 items-center justify-center border-r border-white/10 bg-[#141414]"
              >
                <svg
                  viewBox="0 0 100 100"
                  width="96"
                  height="120"
                  preserveAspectRatio="xMidYMid meet"
                  class="block"
                >
                  <template v-if="routeSvgPaths.get(Number(route.id))">
                    <!-- glow layer -->
                    <polyline
                      :points="routeSvgPaths.get(Number(route.id))"
                      :stroke="
                        route.classification === 'ACTIVE'
                          ? 'rgba(255,78,32,0.18)'
                          : 'rgba(96,165,250,0.18)'
                      "
                      stroke-width="7"
                      fill="none"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <!-- main line -->
                    <polyline
                      :points="routeSvgPaths.get(Number(route.id))"
                      :stroke="route.classification === 'ACTIVE' ? '#FF4E20' : '#60a5fa'"
                      stroke-width="2.5"
                      fill="none"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </template>
                  <template v-else>
                    <!-- stayed nearby: concentric rings -->
                    <circle
                      cx="50"
                      cy="50"
                      r="22"
                      fill="none"
                      :stroke="
                        route.classification === 'ACTIVE'
                          ? 'rgba(255,78,32,0.1)'
                          : 'rgba(96,165,250,0.1)'
                      "
                      stroke-width="1.5"
                      stroke-dasharray="6 5"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="11"
                      fill="none"
                      :stroke="
                        route.classification === 'ACTIVE'
                          ? 'rgba(255,78,32,0.2)'
                          : 'rgba(96,165,250,0.2)'
                      "
                      stroke-width="1.2"
                      stroke-dasharray="4 3"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="3"
                      :fill="route.classification === 'ACTIVE' ? '#FF4E20' : '#60a5fa'"
                    />
                  </template>
                </svg>
              </div>

              <!-- info -->
              <div class="flex min-w-0 flex-1 flex-col gap-2 px-3 py-3">
                <!-- row 1: id + badge + actions -->
                <div class="flex items-center justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-2">
                    <span
                      class="font-['IBM_Plex_Mono','Courier_New',monospace] text-xs font-medium uppercase tracking-[0.1em] text-zinc-400"
                      >{{ routeDisplayLabel(route) }}</span
                    >
                    <span
                      class="inline-flex items-center gap-1 rounded-[0.85rem] border px-2 py-0.5 font-['IBM_Plex_Mono','Courier_New',monospace] text-[9px] font-bold uppercase tracking-[0.1em]"
                      :class="
                        route.classification === 'ACTIVE'
                          ? 'border-orange-500/30 bg-orange-500/10 text-orange-300'
                          : 'border-white/10 bg-[#141414] text-zinc-300'
                      "
                    >
                      <span
                        class="h-1 w-1 rounded-full bg-current"
                        :class="route.classification === 'ACTIVE' ? 'animate-pulse' : ''"
                      ></span>
                      {{ route.classification }}
                    </span>
                    <span
                      v-if="routePointsLoading && Number(selectedRouteId) === Number(route.id)"
                      class="h-2.5 w-2.5 animate-spin rounded-full border-2 border-orange-400/70 border-t-transparent"
                    ></span>
                  </div>
                  <div class="flex flex-shrink-0 gap-1.5">
                    <button
                      v-if="!route.localOnly && !route.mergedDay"
                      :class="innerSurfaceClass"
                      class="flex items-center gap-1 rounded-[0.85rem] px-2 py-1 font-['IBM_Plex_Mono','Courier_New',monospace] text-[11px] text-zinc-400 transition-[background-color,border-color,color] duration-150 hover:border-white/20 hover:bg-white/5 hover:text-white"
                      @click.stop="viewRoute(route.id)"
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.4"
                      >
                        <circle cx="8" cy="8" r="3" />
                        <path d="M2 8s2-5 6-5 6 5 6 5-2 5-6 5-6-5-6-5z" />
                      </svg>
                      Map
                    </button>
                    <button
                      v-if="!route.mergedDay"
                      :class="innerSurfaceClass"
                      class="flex items-center gap-1 rounded-[0.85rem] px-2 py-1 font-['IBM_Plex_Mono','Courier_New',monospace] text-[11px] text-zinc-400 transition-[background-color,border-color,color] duration-150 hover:border-orange-500/30 hover:bg-orange-500/10 hover:text-orange-300"
                      @click.stop="deleteRoute(route.id)"
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.4"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5L11 4" />
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- row 2: story -->
                <p
                  class="overflow-hidden text-xs leading-6 text-zinc-400 [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]"
                >
                  {{ route.story || `${route.pointCount || 0} points recorded` }}
                </p>

                <!-- row 3: tags -->
                <div class="flex flex-wrap gap-1.5">
                  <span
                    :class="innerSurfaceClass"
                    class="inline-flex items-center gap-[3px] rounded-[0.85rem] px-[9px] py-[3px] text-[10px] text-zinc-400"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                    </svg>
                    route {{ Math.round(route.routeDistanceMeters || 0) }}m
                  </span>
                  <span
                    class="inline-flex items-center gap-[3px] rounded-[0.85rem] border px-[9px] py-[3px] text-[10px]"
                    :class="
                      route.classification === 'ACTIVE'
                        ? 'border-orange-500/30 bg-orange-500/10 text-orange-300'
                        : 'border-white/10 bg-[#141414] text-zinc-300'
                    "
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {{ route.durationLabel || 'Logged' }}
                  </span>
                  <span
                    class="inline-flex items-center gap-[3px] rounded-[0.85rem] border px-[9px] py-[3px] text-[10px]"
                    :class="
                      route.routeStatus === 'OPEN'
                        ? 'border-emerald-900 bg-emerald-950/60 text-emerald-200'
                        : 'border-orange-500/30 bg-orange-500/10 text-orange-300'
                    "
                  >
                    {{ route.routeStatus || '—' }}
                  </span>
                  <span
                    v-if="route.passiveMeta"
                    class="inline-flex items-center gap-[3px] rounded-[0.85rem] border px-[9px] py-[3px] text-[10px]"
                    :class="
                      route.passiveMeta.uploadedAt
                        ? 'border-emerald-900 bg-emerald-950/60 text-emerald-200'
                        : 'border-amber-900 bg-amber-950/50 text-amber-200'
                    "
                  >
                    {{ route.passiveMeta.uploadedAt ? 'uploaded' : 'pending' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- bottom strip: time window -->
            <div
              class="flex items-center justify-between border-t border-white/10 px-[14px] py-[7px] text-[11px] text-zinc-500"
            >
              <span>{{ formatRouteTimeWindow(route) }}</span>
              <span v-if="route.pointCount">{{ route.pointCount }} pts</span>
            </div>
          </div>
        </template>
        <div v-else class="flex flex-col items-center justify-center py-16 text-center">
          <div
            :class="innerSurfaceClass"
            class="mb-3 flex h-14 w-14 items-center justify-center rounded-[0.9rem]"
          >
            <svg class="h-7 w-7 text-zinc-700" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <p class="text-sm font-medium text-zinc-400">{{ emptyState.title }}</p>
          <p class="mt-1 text-xs text-zinc-500">{{ emptyState.detail }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import L from 'leaflet';
import { addLeafletBaseLayer, isOfflineClient } from '@/composables/maps/leafletBaseLayer';
import { Capacitor } from '@capacitor/core';
import { ActivityRecognition } from '@/src/plugins/activityRecognition';
import {
  buildLocalRoutesFromPlugin,
  utcDayKeyFromTimestamp
} from '@/composables/community/localPassiveRoutes';
import { usePlaceDataSource } from '~/composables/home/usePlaceDataSource';
import { useWaitForAuth } from '~/composables/useWaitForAuth';
import { db } from '@/db/index.js';
import { syncDownFromCloudflare } from '~/db';
import { syncPassiveFromPluginToDexie } from '~/composables/passive/syncPluginPassiveToDexie';
import { enrichRoutesWithPlaceLabels } from '~/lib/communityRouteLabels';
import type { TimelineSegment } from '~/lib/places';

const router = useRouter();
const waitForAuth = useWaitForAuth();
const placeDataSource = usePlaceDataSource();
const pageSurfaceClass =
  'rounded-[1rem] border border-white/10 bg-black/60 shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(255,255,255,0.05)] backdrop-blur-xl';
const innerSurfaceClass =
  'rounded-[0.9rem] border border-white/10 bg-[#141414] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

// ── State ──────────────────────────────────────────────────
const history = ref<any[]>([]);
const mergedDayHistory = ref<any[]>([]);
const search = ref('');
const lastSync = ref('--:--');
const selectedRouteId = ref<number | null>(null);
const routePointsById = ref<Map<number, any[]>>(new Map());
const passivePointsByRouteId = ref<Map<number, any[]>>(new Map());
const localTimelineSegments = ref<TimelineSegment[]>([]);
const remoteTimelineSegments = ref<TimelineSegment[]>([]);
const passivePointsLoaded = ref(false);
const routePointsLoading = ref(false);
const isInitialHistoryLoading = ref(true);
const isRefreshingHistory = ref(false);
const isBackgroundSyncing = ref(false);
const isPlaceLabelRefreshActive = ref(false);
const historyLoadError = ref('');
const selectedRoutePreviewState = ref<'idle' | 'loading' | 'ready' | 'empty'>('idle');
const heroMapContainer = ref<HTMLElement | null>(null);
const heroMap = ref<any>(null);
const heroLayerGroup = ref<any>(null);
const pageRoot = ref<HTMLElement | null>(null);
let leafletCssLoaded = false;
let historyLoadVersion = 0;
let heroRenderVersion = 0;
let heroMapResizeObserver: ResizeObserver | null = null;
let heroMapLastLatLngs: Array<[number, number]> = [];

// SVG paths for mini route cards
const routeSvgPaths = reactive(new Map<number, string>());
const listMode = ref<'days' | 'routes'>('days');

// ── Drag / Snap Panel ──────────────────────────────────────

type Snap = 'map' | 'split' | 'list';
const panelSnap = ref<Snap>('split');
const mapHeight = ref(0);
const totalHeight = ref(0);
const HANDLE_H = 28;
const NAV_H = 64;
const DRAG_ACTIVATION_PX = 14;
const SNAPS: Record<Snap, number> = { map: 0.88, split: 0.52, list: 0.12 };

function usableH() {
  return (pageRoot.value?.clientHeight ?? window.innerHeight) - NAV_H - HANDLE_H;
}
function snapToMapHeight(snap: Snap) {
  return Math.round(usableH() * SNAPS[snap]);
}
async function syncHeroMapViewport() {
  if (!heroMap.value) return;
  await nextTick();
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
  heroMap.value.invalidateSize();
  if (heroMapLastLatLngs.length > 1) {
    heroMap.value.fitBounds(L.latLngBounds(heroMapLastLatLngs), { padding: [44, 44] });
    return;
  }
  if (heroMapLastLatLngs.length === 1) {
    heroMap.value.setView(heroMapLastLatLngs[0], 14);
  }
}
function invalidateMapSoon() {
  nextTick(() => {
    void syncHeroMapViewport();
  });
}
function applySnap(snap: Snap, animate = true) {
  panelSnap.value = snap;
  mapHeight.value = snapToMapHeight(snap);
  if (animate) {
    window.setTimeout(() => invalidateMapSoon(), 260);
    return;
  }
  invalidateMapSoon();
}

// Drag logic
let dragStartY = 0;
let dragStartH = 0;
const isDragging = ref(false);
let dragMoved = false;

function startDrag(e: MouseEvent | TouchEvent) {
  isDragging.value = true;
  dragMoved = false;
  dragStartY = 'touches' in e ? e.touches[0].clientY : e.clientY;
  dragStartH = mapHeight.value;

  const onMove = (ev: MouseEvent | TouchEvent) => {
    if (!isDragging.value) return;
    const y = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;
    const delta = y - dragStartY;
    const absDelta = Math.abs(delta);
    if (!dragMoved && absDelta < DRAG_ACTIVATION_PX) return;
    dragMoved = true;
    if ('touches' in ev && ev.cancelable) ev.preventDefault();
    const dragDelta = delta > 0 ? delta - DRAG_ACTIVATION_PX : delta + DRAG_ACTIVATION_PX;
    const newH = Math.max(
      snapToMapHeight('list') - 20,
      Math.min(snapToMapHeight('map') + 20, dragStartH + dragDelta)
    );
    mapHeight.value = newH;
    const frac = newH / usableH();
    if (frac > (SNAPS.map + SNAPS.split) / 2) panelSnap.value = 'map';
    else if (frac > (SNAPS.split + SNAPS.list) / 2) panelSnap.value = 'split';
    else panelSnap.value = 'list';
  };

  const onEnd = () => {
    isDragging.value = false;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onEnd);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onEnd);
    if (!dragMoved) return;
    const frac = mapHeight.value / usableH();
    const closest = (Object.keys(SNAPS) as Snap[]).reduce((a, b) =>
      Math.abs(SNAPS[a] - frac) < Math.abs(SNAPS[b] - frac) ? a : b
    );
    applySnap(closest, true);
    if (closest === 'map') buildAllSvgPaths();
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
}

function handleResize() {
  applySnap(panelSnap.value, false);
}

// ── SVG mini path builder ──────────────────────────────────
function buildSvgPath(points: any[], W = 100, H = 100): string | null {
  const pts = points
    .map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (pts.length < 2) return null;
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats),
    maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs),
    maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;
  const pad = 10;
  return pts
    .map((p) => {
      const x = pad + ((p.lng - minLng) / lngRange) * (W - pad * 2);
      const y = pad + ((maxLat - p.lat) / latRange) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

async function buildAllSvgPaths() {
  await Promise.all(
    displayedHistory.value.slice(0, 25).map(async (route) => {
      const id = Number(route.id);
      if (routeSvgPaths.has(id)) return;
      const pts = await getRoutePoints(id);
      const path = buildSvgPath(pts);
      if (path) routeSvgPaths.set(id, path);
    })
  );
}

// ── Computed ───────────────────────────────────────────────
const passiveCount = computed(
  () => history.value.filter((r) => r.classification === 'PASSIVE').length
);
const activeCount = computed(
  () => history.value.filter((r) => r.classification === 'ACTIVE').length
);

const filteredRouteHistory = computed(() => {
  if (!search.value) return history.value;
  const s = search.value.toLowerCase();
  return history.value.filter(
    (r) =>
      new Date(r.timestamp).toLocaleString().toLowerCase().includes(s) ||
      String(r.id).includes(s) ||
      String(r.classification || '')
        .toLowerCase()
        .includes(s) ||
      String(r.story || '')
        .toLowerCase()
        .includes(s)
  );
});

const displayedHistory = computed(() =>
  listMode.value === 'days' ? mergedDayHistory.value : filteredRouteHistory.value
);

const selectedRoute = computed(
  () =>
    displayedHistory.value.find((route) => Number(route.id) === Number(selectedRouteId.value)) ||
    null
);

const dayTimeline = computed(() => {
  const byDay = new Map<string, any[]>();
  for (const route of history.value) {
    if (String(route?.classification || '') !== 'PASSIVE') continue;
    const ts = Number(route?.timestamp || 0);
    if (!Number.isFinite(ts) || ts <= 0) continue;
    const date = new Date(ts);
    const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (!byDay.has(dayKey)) byDay.set(dayKey, []);
    byDay.get(dayKey)!.push(route);
  }
  return [...byDay.entries()]
    .map(([dayKey, routes]) => {
      const sorted = [...routes].sort(
        (a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0)
      );
      const totalDurationMs = sorted.reduce((sum, row) => sum + Number(row.durationMs || 0), 0);
      const dayLabel = new Date(`${dayKey}T00:00:00`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });
      return {
        dayKey,
        label: dayLabel,
        routeCount: sorted.length,
        totalDurationLabel: formatDuration(totalDurationMs)
      };
    })
    .sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))
    .slice(0, 6);
});
const headerStatusLabel = computed(() => {
  if (isInitialHistoryLoading.value && !history.value.length) return 'Loading route history';
  if (historyLoadError.value && !history.value.length) return 'Could not load route history';
  if (isRefreshingHistory.value) return `${history.value.length} tracked · refreshing`;
  if (isBackgroundSyncing.value) return `${history.value.length} tracked · syncing`;
  if (isPlaceLabelRefreshActive.value) return `${history.value.length} tracked · updating labels`;
  return `${history.value.length} tracked · ${lastSync.value}`;
});
const emptyState = computed(() => {
  if (historyLoadError.value) {
    return {
      title: 'Could not load routes',
      detail: historyLoadError.value
    };
  }
  if (search.value) {
    return {
      title: 'No routes match that search',
      detail: 'Try a broader route, day, or story match.'
    };
  }
  if (listMode.value === 'days') {
    return {
      title: 'No day groups yet',
      detail: 'Passive route history will show up here after route points are available.'
    };
  }
  return {
    title: 'No routes found',
    detail: 'Route history will appear here after local or synced trips are loaded.'
  };
});
const mapOverlayState = computed(() => {
  if (isInitialHistoryLoading.value && !history.value.length) {
    return {
      title: 'Loading route history',
      detail: 'Reading saved routes and passive points from this device.'
    };
  }
  if (historyLoadError.value && !displayedHistory.value.length) {
    return {
      title: 'Could not load route preview',
      detail: historyLoadError.value
    };
  }
  if (!displayedHistory.value.length) {
    return {
      title: 'No route preview yet',
      detail:
        listMode.value === 'days'
          ? 'Pick a day after passive routes are loaded.'
          : 'Select a route once trip history is available.'
    };
  }
  if (selectedRoutePreviewState.value === 'empty' && selectedRoute.value) {
    return {
      title: 'No preview for this route',
      detail: 'This route does not have enough usable coordinates to draw on the map yet.'
    };
  }
  return null;
});

// ── Helpers ────────────────────────────────────────────────
function toRad(v: number) {
  return (v * Math.PI) / 180;
}
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000,
    dLat = toRad(b.lat - a.lat),
    dLng = toRad(b.lng - a.lng);
  const ha =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(ha), Math.sqrt(1 - ha));
}
function pathDistanceMeters(points: any[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distanceMeters(points[i - 1], points[i]);
  }
  return Math.round(total);
}
function formatDuration(ms: number): string {
  const m = Math.floor(Math.max(0, Number(ms || 0)) / 60_000);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60),
    rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}
function formatRouteTimeWindow(route: any): string {
  const start = Number(route?.startTimestamp || route?.timestamp || 0);
  const end = Number(route?.endTimestamp || start);
  if (!start) return '-';
  const startDate = new Date(start);
  const startLabel = `${startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (!end || end <= start) return startLabel;
  const endDate = new Date(end);
  const endLabel = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (startDate.toDateString() === endDate.toDateString()) return `${startLabel} -> ${endLabel}`;
  return `${startLabel} -> ${endDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${endLabel}`;
}
function routeDisplayLabel(route: any): string {
  if (route?.mergedDayKey) {
    return new Date(`${route.mergedDayKey}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  }
  return `#${route.id}`;
}
function labelPlace(
  c: { lat: number; lng: number },
  home: { lat: number; lng: number } | null,
  office: { lat: number; lng: number } | null,
  i: number
): string {
  if (home && distanceMeters(c, home) <= 220) return 'Home';
  if (office && distanceMeters(c, office) <= 220) return 'Office';
  return `Place ${i}`;
}
function buildPassiveStory(rawPoints: any[]) {
  const pts = [...rawPoints]
    .map((p: any) => ({
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      timestamp: Number(p?.timestamp || 0)
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (pts.length < 2)
    return {
      story: pts.length ? 'Single check-in' : 'No points',
      durationLabel: 'Logged',
      durationMs: 0
    };
  const totalMs = pts[pts.length - 1].timestamp - pts[0].timestamp;
  const stops: any[] = [];
  const R = 120,
    minMs = 20 * 60 * 1000;
  let gs = 0,
    sLat = pts[0].lat,
    sLng = pts[0].lng,
    gc = 1;
  for (let i = 1; i < pts.length; i++) {
    if (distanceMeters({ lat: sLat / gc, lng: sLng / gc }, pts[i]) <= R) {
      sLat += pts[i].lat;
      sLng += pts[i].lng;
      gc++;
      continue;
    }
    const dMs = pts[i - 1].timestamp - pts[gs].timestamp;
    if (dMs >= minMs)
      stops.push({
        center: { lat: sLat / gc, lng: sLng / gc },
        start: pts[gs].timestamp,
        end: pts[i - 1].timestamp,
        durationMs: dMs
      });
    gs = i;
    sLat = pts[i].lat;
    sLng = pts[i].lng;
    gc = 1;
  }
  const lastDMs = pts[pts.length - 1].timestamp - pts[gs].timestamp;
  if (lastDMs >= minMs)
    stops.push({
      center: { lat: sLat / gc, lng: sLng / gc },
      start: pts[gs].timestamp,
      end: pts[pts.length - 1].timestamp,
      durationMs: lastDMs
    });
  const home = stops[0]?.center || pts[0];
  const office =
    [...stops]
      .filter((s) => distanceMeters(s.center, home) > 220)
      .sort((a, b) => b.durationMs - a.durationMs)[0]?.center || null;
  const frags: string[] = [];
  let idx = 1;
  if (stops.length)
    frags.push(
      `At ${labelPlace(stops[0].center, home, office, idx++)} ${formatDuration(stops[0].durationMs)}`
    );
  for (let i = 0; i < stops.length - 1; i++) {
    const tMs = Math.max(0, stops[i + 1].start - stops[i].end);
    if (tMs > 0)
      frags.push(
        `→ ${labelPlace(stops[i + 1].center, home, office, idx++)} in ${formatDuration(tMs)}`
      );
  }
  if (!frags.length)
    frags.push(
      distanceMeters(pts[0], pts[pts.length - 1]) < 200
        ? `Stayed nearby ${formatDuration(totalMs)}`
        : `Route length logged across ${formatDuration(totalMs)}`
    );
  return {
    story: frags.slice(0, 3).join(' · '),
    durationLabel: formatDuration(totalMs),
    durationMs: totalMs
  };
}
function buildActiveStory(pts: any[]) {
  const norm = [...pts]
    .map((p: any) => ({
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      timestamp: Number(p?.timestamp || 0)
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (norm.length < 2) return { story: 'Active route', durationLabel: 'Logged', durationMs: 0 };
  const totalMs = Math.max(0, norm[norm.length - 1].timestamp - norm[0].timestamp);
  return {
    story: `Active route logged for ${formatDuration(totalMs)}`,
    durationLabel: formatDuration(totalMs),
    durationMs: totalMs
  };
}
function buildRouteStory(cls: string, pts: any[]) {
  if (!Array.isArray(pts) || !pts.length)
    return { story: 'No points', durationLabel: 'Logged', durationMs: 0 };
  if (cls === 'PASSIVE') return buildPassiveStory(pts);
  if (cls === 'ACTIVE') return buildActiveStory(pts);
  return { story: `${pts.length} pts`, durationLabel: 'Logged', durationMs: 0 };
}
function buildMergedDayRoutes(routes: any[]) {
  const byDay = new Map<string, any[]>();
  for (const route of routes) {
    if (String(route?.classification || '') !== 'PASSIVE') continue;
    if (route?.mergedDay) continue;
    const ts = Number(route?.startTimestamp || route?.timestamp || 0);
    if (!Number.isFinite(ts) || ts <= 0) continue;
    const dayKey = utcDayKeyFromTimestamp(ts);
    if (!byDay.has(dayKey)) byDay.set(dayKey, []);
    byDay.get(dayKey)!.push(route);
  }
  return [...byDay.entries()]
    .map(([dayKey, routesForDay]) => {
      const sortedRoutes = [...routesForDay].sort(
        (a, b) =>
          Number(a.startTimestamp || a.timestamp || 0) -
          Number(b.startTimestamp || b.timestamp || 0)
      );
      const mergedPoints = sortedRoutes
        .flatMap((route) => routePointsById.value.get(Number(route.id)) || [])
        .sort((a: any, b: any) => Number(a.timestamp || 0) - Number(b.timestamp || 0))
        .filter((point: any, index: number, list: any[]) => {
          if (index === 0) return true;
          const prev = list[index - 1];
          return !(
            Number(prev?.timestamp || 0) === Number(point?.timestamp || 0) &&
            Number(prev?.lat || 0) === Number(point?.lat || 0) &&
            Number(prev?.lng || 0) === Number(point?.lng || 0)
          );
        });
      const routeId = -Number(dayKey.replace(/-/g, ''));
      routePointsById.value.set(routeId, mergedPoints);
      const narrative = buildRouteStory('PASSIVE', mergedPoints);
      const latestPassive =
        sortedRoutes
          .map((route) => route.passiveMeta)
          .filter(Boolean)
          .sort((a: any, b: any) => Number(b.uploadedAt || 0) - Number(a.uploadedAt || 0))[0] ||
        null;
      return {
        id: routeId,
        mergedDay: true,
        localOnly: true,
        mergedDayKey: dayKey,
        classification: 'PASSIVE',
        pointCount: mergedPoints.length,
        timestamp: Number(sortedRoutes[sortedRoutes.length - 1]?.timestamp || 0),
        startTimestamp: Number(mergedPoints[0]?.timestamp || sortedRoutes[0]?.startTimestamp || 0),
        endTimestamp: Number(
          mergedPoints[mergedPoints.length - 1]?.timestamp ||
            sortedRoutes[sortedRoutes.length - 1]?.endTimestamp ||
            0
        ),
        routeDistanceMeters: pathDistanceMeters(mergedPoints),
        routeStatus: 'DAY',
        durationLabel: narrative.durationLabel,
        durationMs: narrative.durationMs,
        story: `${sortedRoutes.length} routes merged · ${narrative.story}`,
        passiveMeta: latestPassive
      };
    })
    .sort((a, b) => Number(b.startTimestamp || 0) - Number(a.startTimestamp || 0));
}

async function getRoutePoints(routeId: number, withLoading = false): Promise<any[]> {
  if (routePointsById.value.has(routeId)) return routePointsById.value.get(routeId) || [];
  if (withLoading) routePointsLoading.value = true;
  try {
    await loadPassivePointsCache();
    const fallback = passivePointsByRouteId.value.get(Number(routeId)) || [];
    if (fallback.length) {
      routePointsById.value.set(routeId, fallback);
      return fallback;
    }
    const pts = await db.points.where('routeId').equals(Number(routeId)).sortBy('timestamp');
    routePointsById.value.set(routeId, pts);
    return pts;
  } finally {
    if (withLoading) routePointsLoading.value = false;
  }
}
async function loadPassivePointsCache(force = false) {
  if (passivePointsLoaded.value && !force) return;
  const rows = await db.passive_locations.toArray();
  const grouped = new Map<number, any[]>();
  for (const row of rows) {
    const routeId = Number(row?.route_id ?? row?.routeId);
    const lat = Number(row?.lat),
      lng = Number(row?.lng),
      timestamp = Number(row?.timestamp || 0);
    if (!Number.isFinite(routeId) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!Number.isFinite(timestamp) || timestamp <= 0) continue;
    if (!grouped.has(routeId)) grouped.set(routeId, []);
    grouped.get(routeId)!.push({ lat, lng, timestamp, routeId, source: 'PASSIVE' });
  }
  for (const list of grouped.values())
    list.sort((a: any, b: any) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  passivePointsByRouteId.value = grouped;
  passivePointsLoaded.value = true;
}
async function loadPassiveRowsForRoutes(routes: any[]): Promise<any[]> {
  const routeTimestamps = routes
    .map((route: any) => Number(route?.timestamp || 0))
    .filter((ts: number) => Number.isFinite(ts) && ts > 0);
  if (!routeTimestamps.length) return [];
  if (!Capacitor.isPluginAvailable('qipz-activity')) return [];
  const fromTs = Math.max(0, Math.min(...routeTimestamps) - 12 * 60 * 60 * 1000);
  const toTs = Math.max(...routeTimestamps) + 12 * 60 * 60 * 1000;
  try {
    const merged: any[] = [];
    let cursor: number | undefined;
    for (let i = 0; i < 25; i++) {
      const response = await ActivityRecognition.getPassiveEvents({
        fromTs,
        toTs,
        cursor,
        limit: 400
      });
      const events = Array.isArray(response?.events) ? response.events : [];
      if (!events.length) break;
      merged.push(...events);
      if (!response?.hasMore || !response?.nextCursor) break;
      cursor = Number(response.nextCursor);
      if (!Number.isFinite(cursor) || cursor <= 0) break;
    }
    return merged
      .map((row: any) => ({
        timestamp: Number(row?.timestamp || 0),
        trigger: String(row?.trigger || ''),
        provider: String(row?.provider || ''),
        acc: Number(row?.acc || 0),
        source: String(row?.source || ''),
        uploadedAt: Number(row?.uploadedAt || 0)
      }))
      .filter((row: any) => Number.isFinite(row.timestamp) && row.timestamp > 0)
      .sort((a: any, b: any) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  } catch (err) {
    console.warn('Plugin passive history read failed:', err);
    return [];
  }
}
function latestPassiveForRoute(routePoints: any[], passiveRows: any[]): any | null {
  if (!routePoints.length || !passiveRows.length) return null;
  const firstTs = Number(routePoints[0]?.timestamp || 0);
  const lastTs = Number(routePoints[routePoints.length - 1]?.timestamp || 0);
  if (!Number.isFinite(firstTs) || !Number.isFinite(lastTs) || firstTs <= 0 || lastTs <= 0)
    return null;
  const windowStart = Math.max(0, firstTs - 2 * 60 * 1000);
  const windowEnd = lastTs + 2 * 60 * 1000;
  for (let i = passiveRows.length - 1; i >= 0; i--) {
    const ts = Number(passiveRows[i]?.timestamp || 0);
    if (ts > windowEnd) continue;
    if (ts < windowStart) break;
    return passiveRows[i];
  }
  return null;
}

async function loadPlaceTimeline(routes: any[]) {
  const timestamps = routes
    .flatMap((route: any) => [
      Number(route?.startTimestamp || route?.timestamp || 0),
      Number(route?.endTimestamp || 0)
    ])
    .filter((timestamp: number) => Number.isFinite(timestamp) && timestamp > 0);
  if (!timestamps.length) {
    localTimelineSegments.value = [];
    remoteTimelineSegments.value = [];
    return;
  }
  const fromMs = Math.max(0, Math.min(...timestamps) - 12 * 60 * 60 * 1000);
  const toMs = Math.max(...timestamps) + 12 * 60 * 60 * 1000;
  const [localSnapshot, remoteSnapshot] = await Promise.allSettled([
    placeDataSource.loadLocalSnapshot(fromMs, toMs, 800),
    placeDataSource.loadRemoteSnapshot(fromMs, toMs, 800)
  ]);
  localTimelineSegments.value =
    localSnapshot.status === 'fulfilled' ? localSnapshot.value.segments : [];
  remoteTimelineSegments.value =
    remoteSnapshot.status === 'fulfilled' ? remoteSnapshot.value.segments : [];
}

async function refreshPlaceLabels(routes: any[], version: number) {
  isPlaceLabelRefreshActive.value = true;
  try {
    await loadPlaceTimeline(routes);
    if (version !== historyLoadVersion) return;
    history.value = enrichRoutesWithPlaceLabels(
      routes,
      localTimelineSegments.value,
      remoteTimelineSegments.value
    );
    mergedDayHistory.value = enrichRoutesWithPlaceLabels(
      buildMergedDayRoutes(history.value),
      localTimelineSegments.value,
      remoteTimelineSegments.value
    );
    ensureSelectedRoute();
    await renderSelectedRouteOnHeroMap();
    void buildAllSvgPaths();
  } catch (err) {
    console.warn('Community place label refresh failed:', err);
  } finally {
    if (version === historyLoadVersion) {
      isPlaceLabelRefreshActive.value = false;
    }
  }
}

async function loadHistory() {
  const version = ++historyLoadVersion;
  historyLoadError.value = '';
  if (!history.value.length) {
    isInitialHistoryLoading.value = true;
  } else {
    isRefreshingHistory.value = true;
  }
  try {
    await loadPassivePointsCache(true);
    const [routes, activePoints] = await Promise.all([
      db.routes.orderBy('timestamp').reverse().toArray(),
      db.points.toArray()
    ]);
    const nextRoutePointsById = new Map<number, any[]>();
    const activePointsByRoute = new Map<number, any[]>();
    for (const row of activePoints) {
      const routeId = Number(row?.routeId);
      const lat = Number(row?.lat);
      const lng = Number(row?.lng);
      const timestamp = Number(row?.timestamp || 0);
      if (!Number.isFinite(routeId) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (!Number.isFinite(timestamp) || timestamp <= 0) continue;
      if (!activePointsByRoute.has(routeId)) activePointsByRoute.set(routeId, []);
      activePointsByRoute.get(routeId)!.push({
        ...row,
        lat,
        lng,
        timestamp,
        routeId
      });
    }
    for (const points of activePointsByRoute.values()) {
      points.sort((a: any, b: any) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
    }
    const passiveRows = await loadPassiveRowsForRoutes(routes);
    const enriched: any[] = [];
    const passiveDayKeys = new Set<string>();
    for (const route of routes) {
      const routeId = Number(route?.id);
      if (!Number.isFinite(routeId)) continue;
      const activeRoutePoints = activePointsByRoute.get(routeId) || [];
      const passiveRoutePoints = passivePointsByRouteId.value.get(routeId) || [];
      const routePoints = activeRoutePoints.length ? activeRoutePoints : passiveRoutePoints;
      nextRoutePointsById.set(routeId, routePoints);
      const src = String(route?.source || '').toUpperCase();
      const hasPassive = routePoints.some(
        (p: any) => String(p?.source || '').toUpperCase() === 'PASSIVE'
      );
      const classification = src === 'PASSIVE' || hasPassive ? 'PASSIVE' : 'ACTIVE';
      const narrative = buildRouteStory(classification, routePoints);
      const firstPointTimestamp = Number(routePoints[0]?.timestamp || 0);
      const lastPointTimestamp = Number(routePoints[routePoints.length - 1]?.timestamp || 0);
      const startTimestamp = firstPointTimestamp || Number(route?.timestamp || 0);
      const endTimestamp = lastPointTimestamp || startTimestamp;
      if (classification === 'PASSIVE' && startTimestamp > 0)
        passiveDayKeys.add(utcDayKeyFromTimestamp(startTimestamp));
      const latestPassive = latestPassiveForRoute(routePoints, passiveRows);
      enriched.push({
        ...route,
        startTimestamp,
        endTimestamp,
        pointCount: routePoints.length,
        classification,
        story: narrative.story,
        durationLabel: narrative.durationLabel,
        durationMs: narrative.durationMs,
        routeStatus: String(route?.status || '').toUpperCase() || '—',
        routeDistanceMeters: Number(route?.distance_meters || 0),
        passiveMeta: latestPassive
          ? {
              trigger: String(latestPassive?.trigger || ''),
              provider: String(latestPassive?.provider || ''),
              acc: Number(latestPassive?.acc || 0),
              uploadedAt: Number(latestPassive?.uploadedAt || 0)
            }
          : null
      });
    }
    const localResult = await buildLocalRoutesFromPlugin(
      passiveDayKeys,
      buildRouteStory,
      distanceMeters
    );
    for (const [routeId, points] of localResult.pointsById.entries()) {
      nextRoutePointsById.set(routeId, points);
    }
    const combinedRoutes = [...enriched, ...localResult.routes].sort(
      (a, b) =>
        Number(b.startTimestamp || b.timestamp || 0) - Number(a.startTimestamp || a.timestamp || 0)
    );
    routePointsById.value = nextRoutePointsById;
    history.value = combinedRoutes;
    mergedDayHistory.value = buildMergedDayRoutes(combinedRoutes);
    lastSync.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    ensureSelectedRoute();
    await renderSelectedRouteOnHeroMap();
    void buildAllSvgPaths();
    void refreshPlaceLabels(combinedRoutes, version);
  } catch (err) {
    historyLoadError.value =
      err instanceof Error ? err.message : 'The route history could not be loaded.';
    console.error('Failed to load routes:', err);
  } finally {
    if (version === historyLoadVersion) {
      isInitialHistoryLoading.value = false;
      isRefreshingHistory.value = false;
    }
  }
}

function ensureSelectedRoute() {
  if (!displayedHistory.value.length) {
    selectedRouteId.value = null;
    if (heroLayerGroup.value) heroLayerGroup.value.clearLayers();
    return;
  }
  const current = Number(selectedRouteId.value);
  const hasCurrent = displayedHistory.value.some((route) => Number(route.id) === current);
  if (!current || !hasCurrent) selectedRouteId.value = Number(displayedHistory.value[0].id);
}

async function initHeroMap() {
  if (!heroMapContainer.value || heroMap.value) return;
  if (!leafletCssLoaded) {
    await import('leaflet/dist/leaflet.css');
    leafletCssLoaded = true;
  }
  heroMap.value = L.map(heroMapContainer.value, { zoomControl: false, attributionControl: false });
  addLeafletBaseLayer(
    L,
    heroMap.value,
    'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png',
    {
      offline: isOfflineClient(),
      onReady: () => {
        void syncHeroMapViewport();
      },
      onError: () => {
        void syncHeroMapViewport();
      }
    }
  );
  heroLayerGroup.value = L.layerGroup().addTo(heroMap.value);
  L.control.zoom({ position: 'bottomright' }).addTo(heroMap.value);
  heroMap.value.setView([14.5764, 121.0851], 12);
  if (heroMapContainer.value && typeof ResizeObserver !== 'undefined') {
    heroMapResizeObserver = new ResizeObserver(() => {
      void syncHeroMapViewport();
    });
    heroMapResizeObserver.observe(heroMapContainer.value);
  }
}
async function renderSelectedRouteOnHeroMap() {
  if (!heroMap.value || !heroLayerGroup.value) return;
  heroLayerGroup.value.clearLayers();
  if (!selectedRouteId.value) {
    heroMapLastLatLngs = [];
    selectedRoutePreviewState.value = 'idle';
    return;
  }
  const renderVersion = ++heroRenderVersion;
  selectedRoutePreviewState.value = 'loading';
  const pts = await getRoutePoints(Number(selectedRouteId.value), true);
  if (renderVersion !== heroRenderVersion) return;
  const latlngs = pts
    .map((p: any) => [Number(p?.lat), Number(p?.lng)])
    .filter((pair: any[]) => Number.isFinite(pair[0]) && Number.isFinite(pair[1]));
  if (!latlngs.length) {
    heroMapLastLatLngs = [];
    selectedRoutePreviewState.value = 'empty';
    return;
  }
  heroMapLastLatLngs = latlngs as Array<[number, number]>;
  L.polyline(latlngs, { color: '#f97316', weight: 4, opacity: 0.9 }).addTo(heroLayerGroup.value);
  L.circleMarker(latlngs[0], {
    radius: 7,
    fillColor: '#22c55e',
    color: '#fff',
    weight: 2,
    fillOpacity: 1
  }).addTo(heroLayerGroup.value);
  L.circleMarker(latlngs[latlngs.length - 1], {
    radius: 7,
    fillColor: '#ef4444',
    color: '#fff',
    weight: 2,
    fillOpacity: 1
  }).addTo(heroLayerGroup.value);
  await syncHeroMapViewport();
  selectedRoutePreviewState.value = 'ready';
}
async function focusRoute(routeId: number) {
  selectedRouteId.value = Number(routeId);
  await renderSelectedRouteOnHeroMap();
  // Pre-build SVG path for this route
  const id = Number(routeId);
  if (!routeSvgPaths.has(id)) {
    const pts = await getRoutePoints(id);
    const path = buildSvgPath(pts);
    if (path) routeSvgPaths.set(id, path);
  }
}
function focusFirstRouteForDay(dayKey: string) {
  const merged = mergedDayHistory.value.find((route) => route.mergedDayKey === dayKey);
  if (listMode.value === 'days' && merged) {
    void focusRoute(Number(merged.id));
    return;
  }
  const first = history.value
    .filter((r: any) => {
      if (String(r?.classification || '') !== 'PASSIVE') return false;
      const ts = Number(r?.timestamp || 0);
      if (!Number.isFinite(ts) || ts <= 0) return false;
      const d = new Date(ts);
      return (
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` ===
        dayKey
      );
    })
    .sort((a: any, b: any) => Number(b.timestamp || 0) - Number(a.timestamp || 0))[0];
  if (first) void focusRoute(Number(first.id));
}
function viewRoute(id: number) {
  router.push(`/map?routeId=${id}`);
}
async function deleteRoute(id: number) {
  if (!confirm('Delete this route?')) return;
  try {
    const target = history.value.find((route) => Number(route.id) === Number(id));
    if (target?.localOnly) {
      history.value = history.value.filter((route) => Number(route.id) !== Number(id));
      routePointsById.value.delete(Number(id));
      routeSvgPaths.delete(Number(id));
      if (Number(selectedRouteId.value) === Number(id)) {
        const fallback = history.value[0];
        selectedRouteId.value = fallback ? Number(fallback.id) : null;
        await renderSelectedRouteOnHeroMap();
      }
      return;
    }
    await db.routes.delete(Number(id));
    await db.points.where('routeId').equals(Number(id)).delete();
    routePointsById.value.delete(Number(id));
    routeSvgPaths.delete(Number(id));
    await loadHistory();
    if (Number(selectedRouteId.value) === Number(id)) {
      const fallback = history.value[0];
      selectedRouteId.value = fallback ? Number(fallback.id) : null;
      await renderSelectedRouteOnHeroMap();
    }
  } catch (err) {
    console.error('Delete failed:', err);
  }
}

watch(
  () => displayedHistory.value.map((r) => Number(r.id)),
  async (ids) => {
    if (!ids.length) {
      selectedRouteId.value = null;
      selectedRoutePreviewState.value = 'idle';
      if (heroLayerGroup.value) heroLayerGroup.value.clearLayers();
      return;
    }
    if (!selectedRouteId.value || !ids.includes(Number(selectedRouteId.value)))
      selectedRouteId.value = Number(ids[0]);
    await renderSelectedRouteOnHeroMap();
    void buildAllSvgPaths();
  }
);

onMounted(async () => {
  await waitForAuth();
  applySnap('split', false);
  window.addEventListener('resize', handleResize);
  await nextTick();
  await initHeroMap();
  await loadHistory();
  isBackgroundSyncing.value = true;
  try {
    await syncPassiveFromPluginToDexie();
    await loadHistory();
  } catch (err) {
    console.warn('Community passive sync failed:', err);
  }
  try {
    await syncDownFromCloudflare({ includeGeofences: false, scope: 'account' });
    await loadHistory();
  } catch (err) {
    console.warn('Community cloud sync failed:', err);
  } finally {
    isBackgroundSyncing.value = false;
  }
});

onBeforeUnmount(() => {
  heroMapResizeObserver?.disconnect();
  window.removeEventListener('resize', handleResize);
  if (heroMap.value) {
    heroMap.value.remove();
    heroMap.value = null;
  }
  heroLayerGroup.value = null;
});
</script>
