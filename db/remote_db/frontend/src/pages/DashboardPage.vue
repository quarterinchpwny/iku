<template>
  <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold tracking-wide text-slate-800">Visited Places</h3>
          <p class="mt-1 text-xs text-slate-500">
            Real place visits with reverse-geocoded labels from `/api/location/places` and
            `/api/location/timeline`.
          </p>
        </div>
        <div class="grid grid-cols-2 gap-2 text-[11px]">
          <div class="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
            <div class="text-slate-500">Places</div>
            <div class="font-semibold text-slate-800">{{ visitedTopPlaces.length }}</div>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
            <div class="text-slate-500">Timeline</div>
            <div class="font-semibold text-slate-800">{{ visitedTimelineSegments.length }}</div>
          </div>
        </div>
      </div>
      <div
        v-if="visitedPlacesLoading"
        class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500"
      >
        Loading visited places...
      </div>
      <div
        v-else-if="visitedPlacesError"
        class="rounded-xl border border-red-200 bg-red-50 px-3 py-4 text-center text-xs text-red-600"
      >
        {{ visitedPlacesError }}
      </div>
      <div
        v-else-if="visitedTopPlaces.length === 0 && visitedTimelineDays.length === 0"
        class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500"
      >
        No visited-place records yet.
      </div>
      <div v-else class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 xl:col-span-4">
          <div class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Top Places
          </div>
          <div class="space-y-2">
            <div
              v-for="place in visitedTopPlaces"
              :key="`visited-place-${place.id}`"
              class="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate text-sm font-semibold text-slate-800">
                    {{ place.name }}
                  </div>
                  <div class="mt-0.5 truncate font-mono text-[10px] text-slate-500">
                    {{ place.lat.toFixed(5) }}, {{ place.lng.toFixed(5) }}
                  </div>
                </div>
                <div
                  class="rounded-full border border-slate-300 px-2 py-0.5 font-mono text-[10px] text-slate-600"
                >
                  {{ place.visitCount }} visits
                </div>
              </div>
              <div class="mt-2 text-[10px] text-slate-500">
                Last seen {{ new Date(place.lastSeenMs).toLocaleString() }}
              </div>
            </div>
          </div>
        </div>
        <div class="xl:col-span-8">
          <div class="mb-3 flex flex-wrap gap-2">
            <button
              v-for="day in visitedTimelineDays"
              :key="`visited-day-${day.dayKey}`"
              @click="visitedTimelineDayKey = day.dayKey"
              :class="[
                'rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors',
                visitedTimelineActiveDay?.dayKey === day.dayKey
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
              ]"
            >
              <span>{{ day.label }}</span>
              <span class="ml-2 font-mono text-[10px]">
                {{ day.placeCount }} places / {{ day.tripCount }} trips
              </span>
            </button>
          </div>
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-4">
              <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {{ visitedTimelineActiveDay?.label || 'Recent day' }}
              </div>
              <div class="mt-2 text-sm font-medium text-slate-800">
                {{ visitedTimelineActiveDay?.summary || 'No visited-place summary available.' }}
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                  <div class="text-slate-500">Places</div>
                  <div class="font-semibold text-slate-800">
                    {{ visitedTimelineStats.placeCount }}
                  </div>
                </div>
                <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                  <div class="text-slate-500">Trips</div>
                  <div class="font-semibold text-slate-800">
                    {{ visitedTimelineStats.tripCount }}
                  </div>
                </div>
                <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                  <div class="text-slate-500">Distance</div>
                  <div class="font-semibold text-slate-800">
                    {{ visitedTimelineStats.distanceLabel }}
                  </div>
                </div>
                <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                  <div class="text-slate-500">Duration</div>
                  <div class="font-semibold text-slate-800">
                    {{ visitedTimelineStats.durationLabel }}
                  </div>
                </div>
              </div>
            </div>
            <div class="lg:col-span-8">
              <div
                class="max-h-72 space-y-3 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div
                  v-for="row in visitedTimelineRows"
                  :key="row.id"
                  class="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span
                        class="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600"
                      >
                        {{ row.eyebrow }}
                      </span>
                      <span class="text-xs font-semibold text-slate-800">{{ row.title }}</span>
                    </div>
                    <div class="flex items-center gap-1 font-mono text-[10px] text-slate-500">
                      <Clock :size="12" /><span>{{ row.rangeLabel }}</span>
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-1.5 text-[10px]">
                    <span
                      class="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-slate-600"
                    >
                      {{ row.metaLabel }}
                    </span>
                    <span
                      class="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-slate-600"
                    >
                      {{ row.detailLabel }}
                    </span>
                  </div>
                </div>
                <div
                  v-if="visitedTimelineRows.length === 0"
                  class="rounded-lg border border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-500"
                >
                  No visited-place timeline for the selected day.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-sm font-semibold tracking-wide text-slate-800">Tracking Timeline</h3>
        <button
          v-if="dashboardTimelineActiveDay"
          @click="openDayTimelineFromDashboard(dashboardTimelineActiveDay)"
          class="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600"
        >
          Open Map Timeline
        </button>
      </div>
      <div
        v-if="passiveDayTimeline.length === 0"
        class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500"
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
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-300 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
            ]"
          >
            <span>{{ day.label }}</span>
            <span class="ml-2 font-mono text-[10px]">{{ day.routeCount }} routes</span>
          </button>
        </div>
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-4">
            <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {{ dashboardTimelineActiveDay?.label || 'Timeline Day' }}
            </div>
            <div class="mt-2 text-sm font-medium text-slate-800">
              {{ dashboardTimelineActiveDay?.summary || 'No day summary available.' }}
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                <div class="text-slate-500">Trips</div>
                <div class="font-semibold text-slate-800">
                  {{ dashboardTimelineStats.tripCount }}
                </div>
              </div>
              <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                <div class="text-slate-500">Routes</div>
                <div class="font-semibold text-slate-800">
                  {{ dashboardTimelineActiveDay?.routeCount || 0 }}
                </div>
              </div>
              <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                <div class="text-slate-500">Distance</div>
                <div class="font-semibold text-slate-800">
                  {{ dashboardTimelineStats.displacementLabel }}
                </div>
              </div>
              <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                <div class="text-slate-500">Duration</div>
                <div class="font-semibold text-slate-800">
                  {{ dashboardTimelineStats.durationLabel }}
                </div>
              </div>
            </div>
          </div>
          <div class="lg:col-span-8">
            <div
              class="max-h-72 space-y-3 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <div
                v-for="(row, idx) in dashboardTimelineRows"
                :key="`dash-seg-${row.id}`"
                class="relative pl-10"
              >
                <div
                  class="absolute left-4 top-0 h-full w-px bg-gradient-to-b from-emerald-300 via-sky-300 to-amber-300"
                  :class="idx === dashboardTimelineRows.length - 1 ? 'h-7' : 'h-full'"
                ></div>
                <div
                  class="absolute left-[10px] top-3 h-3 w-3 rounded-full border border-white bg-indigo-500 shadow-sm"
                ></div>
                <div class="rounded-lg border border-slate-200 bg-white p-3">
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span
                        class="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600"
                      >
                        {{ row.mode }}
                      </span>
                      <span
                        class="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-500"
                      >
                        Trip {{ row.timelineIndex }}
                      </span>
                    </div>
                    <div class="flex items-center gap-1 font-mono text-[10px] text-slate-500">
                      <Clock :size="12" /><span>{{ row.rangeLabel }}</span>
                    </div>
                  </div>
                  <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div class="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                      <div
                        class="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700"
                      >
                        <MapPinned :size="12" /><span>Start</span>
                      </div>
                      <div class="text-xs font-semibold text-emerald-900">
                        {{ row.startPlace }}
                      </div>
                      <div class="mt-0.5 text-[10px] text-emerald-700">{{ row.startStory }}</div>
                    </div>
                    <div class="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
                      <div
                        class="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700"
                      >
                        <MapPinned :size="12" /><span>End</span>
                      </div>
                      <div class="text-xs font-semibold text-amber-900">{{ row.endPlace }}</div>
                      <div class="mt-0.5 text-[10px] text-amber-700">{{ row.endStory }}</div>
                    </div>
                  </div>
                  <div class="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
                    <div class="mb-1 flex items-center justify-between">
                      <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Route Preview
                      </span>
                      <span class="font-mono text-[10px] text-slate-500">{{ row.rangeLabel }}</span>
                    </div>
                    <div
                      :ref="(el) => setDashboardTimelineMapRef(el, row.id)"
                      class="h-24 w-full overflow-hidden rounded border border-slate-200 bg-white"
                    ></div>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                    <span
                      class="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-slate-600"
                    >
                      {{ row.routeLabel }}
                    </span>
                    <span
                      class="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-slate-600"
                    >
                      {{ row.durationLabel }}
                    </span>
                    <span
                      class="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-slate-600"
                    >
                      {{ row.displacementMeters }}m
                    </span>
                    <span
                      class="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-slate-600"
                    >
                      {{ row.pointCount }} pts
                    </span>
                  </div>
                </div>
              </div>
              <div
                v-if="dashboardTimelineRows.length === 0"
                class="rounded-lg border border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-500"
              >
                No trip segments detected for selected day.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <div class="space-y-6 lg:col-span-4">
        <div class="iku-card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
            <h3 class="flex items-center gap-2 font-semibold text-slate-800">
              <Radio :size="18" class="text-indigo-600" />Active Channels
            </h3>
          </div>
          <div class="divide-y divide-slate-100">
            <div
              v-for="(m, name) in channels"
              :key="name"
              class="flex items-start justify-between p-5 transition-colors hover:bg-slate-50"
            >
              <div>
                <div class="mb-1 flex items-center gap-2">
                  <span class="font-semibold capitalize text-slate-700">{{ name }}</span>
                  <span
                    :class="[
                      'rounded-full px-2.5 py-0.5 text-xs font-medium',
                      name === 'stable'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-blue-100 text-blue-700'
                    ]"
                  >
                    {{ name }}
                  </span>
                </div>
                <div class="flex items-center gap-2 text-sm text-slate-500">
                  <Package :size="14" />v{{ m.version }}
                </div>
                <div class="mt-1 text-xs text-slate-400">
                  Updated {{ new Date(m.updated).toLocaleDateString() }}
                </div>
              </div>
              <a
                :href="`/api/ota/bundle/${m.key}`"
                target="_blank"
                class="rounded-md p-2 text-indigo-600 transition-colors hover:bg-indigo-50"
                title="Download Latest"
              >
                <Download :size="16" />
              </a>
            </div>
            <div
              v-if="Object.keys(channels).length === 0"
              class="p-8 text-center text-sm text-slate-400"
            >
              No active channels found.
            </div>
          </div>
        </div>

        <div class="iku-card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div class="border-b border-slate-200">
            <div class="flex">
              <button
                @click="activeUploadTab = 'ota'"
                :class="[
                  'flex-1 border-b-2 py-4 text-center text-sm font-medium transition-colors',
                  activeUploadTab === 'ota'
                    ? 'border-indigo-600 bg-white text-indigo-600'
                    : 'border-transparent bg-slate-50 text-slate-500 hover:text-slate-700'
                ]"
              >
                Upload OTA
              </button>
              <button
                @click="activeUploadTab = 'apk'"
                :class="[
                  'flex-1 border-b-2 py-4 text-center text-sm font-medium transition-colors',
                  activeUploadTab === 'apk'
                    ? 'border-indigo-600 bg-white text-indigo-600'
                    : 'border-transparent bg-slate-50 text-slate-500 hover:text-slate-700'
                ]"
              >
                Upload APK
              </button>
            </div>
          </div>
          <div class="p-6">
            <form v-if="activeUploadTab === 'ota'" @submit.prevent="handleUpload" class="space-y-5">
              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-700">Target Channel</label>
                <div class="relative">
                  <select
                    v-model="selectedChannel"
                    class="w-full appearance-none rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-3 pr-10 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option v-for="c in channelOptions" :key="c" :value="c">{{ c }}</option>
                  </select>
                  <div
                    class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500"
                  >
                    <MoreVertical :size="16" />
                  </div>
                </div>
              </div>
              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-700">Version</label>
                <input
                  v-model="versionInput"
                  placeholder="e.g. 1.0.3"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-700">Update Package (ZIP)</label>
                <div
                  @dragover.prevent="dragOver = true"
                  @dragleave.prevent="dragOver = false"
                  @drop.prevent="handleDrop($event, 'ota')"
                  :class="[
                    'relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                    dragOver
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                  ]"
                  @click="$refs.fileInput.click()"
                >
                  <input
                    ref="fileInput"
                    type="file"
                    accept=".zip"
                    class="hidden"
                    @change="handleFileSelect($event, 'ota')"
                  />
                  <div class="pointer-events-none flex flex-col items-center gap-2">
                    <div class="rounded-full bg-indigo-100 p-2 text-indigo-600">
                      <component :is="uploadFile ? CheckCircle : CloudUpload" :size="24" />
                    </div>
                    <p class="text-sm font-medium text-slate-600">
                      {{ uploadFile ? uploadFile.name : 'Click to upload or drag ZIP' }}
                    </p>
                    <p v-if="uploadFile" class="text-xs text-slate-400">
                      {{ (uploadFile.size / 1024 / 1024).toFixed(2) }} MB
                    </p>
                  </div>
                </div>
                <button
                  v-if="uploadFile"
                  type="button"
                  @click.stop="clearUpload"
                  class="pl-1 text-xs text-red-500 hover:underline"
                >
                  Remove file
                </button>
              </div>
              <div class="flex gap-3 pt-2">
                <button
                  type="submit"
                  :disabled="uploading"
                  class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <component
                    :is="uploading ? Loader2 : CloudUpload"
                    :size="16"
                    :class="{ 'animate-spin': uploading }"
                  />
                  {{ uploading ? 'Uploading...' : 'Start Upload' }}
                </button>
                <button
                  type="button"
                  @click="clearUpload"
                  class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
            </form>

            <form v-if="activeUploadTab === 'apk'" @submit.prevent="handleApkUpload" class="space-y-5">
              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-700">Version</label>
                <input
                  v-model="apkVersionInput"
                  placeholder="e.g. 1.0.3"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-700">Application Package (APK)</label>
                <div
                  @dragover.prevent="dragOverApk = true"
                  @dragleave.prevent="dragOverApk = false"
                  @drop.prevent="handleDrop($event, 'apk')"
                  :class="[
                    'relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                    dragOverApk
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                  ]"
                  @click="$refs.apkInput.click()"
                >
                  <input
                    ref="apkInput"
                    type="file"
                    accept=".apk"
                    class="hidden"
                    @change="handleFileSelect($event, 'apk')"
                  />
                  <div class="pointer-events-none flex flex-col items-center gap-2">
                    <div class="rounded-full bg-indigo-100 p-2 text-indigo-600">
                      <component :is="apkFile ? CheckCircle : Smartphone" :size="24" />
                    </div>
                    <p class="text-sm font-medium text-slate-600">
                      {{ apkFile ? apkFile.name : 'Click to upload or drag APK' }}
                    </p>
                    <p v-if="apkFile" class="text-xs text-slate-400">
                      {{ (apkFile.size / 1024 / 1024).toFixed(2) }} MB
                    </p>
                  </div>
                </div>
                <button
                  v-if="apkFile"
                  type="button"
                  @click.stop="clearApkUpload"
                  class="pl-1 text-xs text-red-500 hover:underline"
                >
                  Remove file
                </button>
              </div>
              <div class="flex gap-3 pt-2">
                <button
                  type="submit"
                  :disabled="apkUploading"
                  class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <component
                    :is="apkUploading ? Loader2 : CloudUpload"
                    :size="16"
                    :class="{ 'animate-spin': apkUploading }"
                  />
                  {{ apkUploading ? 'Uploading...' : 'Upload APK' }}
                </button>
                <button
                  type="button"
                  @click="clearApkUpload"
                  class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div class="lg:col-span-8">
        <div
          class="iku-card flex h-full min-h-[600px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div
            class="flex flex-col justify-between gap-4 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center"
          >
            <div class="flex space-x-1 self-start rounded-lg bg-slate-100 p-1">
              <button
                @click="activeHistoryTab = 'history'"
                :class="[
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  activeHistoryTab === 'history'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                ]"
              >
                <Clock :size="14" />History
              </button>
              <button
                @click="activeHistoryTab = 'apk'"
                :class="[
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  activeHistoryTab === 'apk'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                ]"
              >
                <Smartphone :size="14" />APK History
              </button>
              <button
                @click="activeHistoryTab = 'bundles'"
                :class="[
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  activeHistoryTab === 'bundles'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                ]"
              >
                <Package :size="14" />Bundles
              </button>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="activeHistoryTab === 'history' && selectedHistory.length > 0"
                @click="handleDeleteSelectedHistory"
                class="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
              >
                <Trash2 :size="14" />Delete Selected ({{ selectedHistory.length }})
              </button>
              <button
                v-if="activeHistoryTab === 'apk' && selectedApks.length > 0"
                @click="handleDeleteSelectedApk"
                class="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
              >
                <Trash2 :size="14" />Delete Selected ({{ selectedApks.length }})
              </button>
              <button
                v-if="activeHistoryTab === 'bundles' && selectedBundles.length > 0"
                @click="handleDeleteSelectedBundles"
                class="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
              >
                <Trash2 :size="14" />Delete Selected ({{ selectedBundles.length }})
              </button>
              <button
                @click="fetchAll"
                class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <RotateCcw :size="14" />Refresh
              </button>
            </div>
          </div>
          <div class="flex-1 overflow-x-auto p-2">
            <table class="w-full border-collapse text-left">
              <thead>
                <tr class="border-b border-slate-200">
                  <template v-if="activeHistoryTab === 'history'">
                    <th class="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        :checked="history.length > 0 && selectedHistory.length === history.length"
                        @change="selectedHistory = $event.target.checked ? history.map((h) => h.id) : []"
                        class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Channel
                    </th>
                    <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Version
                    </th>
                    <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Filename
                    </th>
                    <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Uploaded
                    </th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </template>
                  <template v-if="activeHistoryTab === 'apk'">
                    <th class="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        :checked="apks.length > 0 && selectedApks.length === apks.length"
                        @change="selectedApks = $event.target.checked ? apks.map((h) => h.id) : []"
                        class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Version
                    </th>
                    <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Filename
                    </th>
                    <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Uploaded
                    </th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </template>
                  <template v-if="activeHistoryTab === 'bundles'">
                    <th class="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        :checked="bundles.length > 0 && selectedBundles.length === bundles.length"
                        @change="selectedBundles = $event.target.checked ? bundles.map((b) => b.name) : []"
                        class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Key / Name
                    </th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </template>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <template v-if="activeHistoryTab === 'history'">
                  <tr
                    v-for="h in history"
                    :key="`${h.channel}-${h.version}`"
                    class="group transition-colors hover:bg-slate-50"
                  >
                    <td class="px-4 py-3">
                      <input
                        type="checkbox"
                        v-model="selectedHistory"
                        :value="h.id"
                        class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td class="px-4 py-3 text-sm font-medium capitalize text-slate-700">
                      <span
                        :class="[
                          'rounded-full px-2 py-0.5 text-xs',
                          h.channel === 'stable'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        ]"
                      >
                        {{ h.channel }}
                      </span>
                    </td>
                    <td class="px-4 py-3 font-mono text-sm text-slate-600">{{ h.version }}</td>
                    <td class="max-w-[150px] truncate px-4 py-3 text-sm text-slate-500" :title="h.filename">
                      {{ h.filename }}
                    </td>
                    <td class="px-4 py-3 text-sm text-slate-500">
                      {{ new Date(h.uploaded_at).toLocaleString() }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 text-right">
                      <div class="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                        <button
                          @click="handleRollback(h.channel, h.version)"
                          title="Rollback"
                          class="rounded-md p-2 text-slate-500 transition-colors hover:bg-amber-50 hover:text-amber-600"
                        >
                          <RotateCcw :size="16" />
                        </button>
                        <a
                          :href="`/api/ota/bundle/${h.filename}`"
                          target="_blank"
                          title="Download"
                          class="rounded-md p-2 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <Download :size="16" />
                        </a>
                        <button
                          @click="handleDeleteHistory(h.id, h.channel, h.version, h.filename)"
                          title="Delete"
                          class="rounded-md p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 :size="16" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="history.length === 0">
                    <td colspan="6" class="px-4 py-12 text-center text-slate-400">
                      No OTA history available
                    </td>
                  </tr>
                </template>
                <template v-if="activeHistoryTab === 'apk'">
                  <tr v-for="h in apks" :key="h.id" class="group transition-colors hover:bg-slate-50">
                    <td class="px-4 py-3">
                      <input
                        type="checkbox"
                        v-model="selectedApks"
                        :value="h.id"
                        class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td class="px-4 py-3 font-mono text-sm text-slate-700">{{ h.version }}</td>
                    <td class="max-w-[200px] truncate px-4 py-3 text-sm text-slate-600" :title="h.filename">
                      {{ h.filename }}
                    </td>
                    <td class="px-4 py-3 text-sm text-slate-500">
                      {{ new Date(h.uploaded_at).toLocaleString() }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 text-right">
                      <div class="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                        <a
                          :href="`/api/ota/bundle/${h.filename}`"
                          target="_blank"
                          title="Download"
                          class="rounded-md p-2 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <Download :size="16" />
                        </a>
                        <button
                          @click="handleDeleteApk(h.id, h.filename)"
                          title="Delete"
                          class="rounded-md p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 :size="16" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="apks.length === 0">
                    <td colspan="5" class="px-4 py-12 text-center text-slate-400">No APKs uploaded</td>
                  </tr>
                </template>
                <template v-if="activeHistoryTab === 'bundles'">
                  <tr
                    v-for="b in bundles"
                    :key="b.name"
                    class="group transition-colors hover:bg-slate-50"
                  >
                    <td class="px-4 py-3">
                      <input
                        type="checkbox"
                        v-model="selectedBundles"
                        :value="b.name"
                        class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td class="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700">
                      <Package :size="16" class="text-slate-400" />{{ b.name }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 text-right">
                      <div class="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                        <a
                          :href="`/api/ota/bundle/${b.name}`"
                          target="_blank"
                          title="Download"
                          class="rounded-md p-2 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <Download :size="16" />
                        </a>
                        <button
                          @click="handleDeleteBundle(b.name)"
                          title="Delete"
                          class="rounded-md p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 :size="16" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="bundles.length === 0">
                    <td colspan="3" class="px-4 py-12 text-center text-slate-400">
                      No bundles in storage
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
import {
  CheckCircle,
  Clock,
  CloudUpload,
  Download,
  Loader2,
  MapPinned,
  MoreVertical,
  Package,
  Radio,
  RotateCcw,
  Smartphone,
  Trash2
} from 'lucide-vue-next'
import { useAdminAppContext } from '../composables/useAdminAppContext'

const app = useAdminAppContext()
const {
  activeHistoryTab,
  activeUploadTab,
  apkFile,
  apkUploading,
  apkVersionInput,
  bundles,
  channelOptions,
  channels,
  clearApkUpload,
  clearUpload,
  dashboardTimelineActiveDay,
  dashboardTimelineRows,
  dashboardTimelineStats,
  dragOver,
  dragOverApk,
  fetchAll,
  handleApkUpload,
  handleDeleteApk,
  handleDeleteBundle,
  handleDeleteHistory,
  handleDeleteSelectedApk,
  handleDeleteSelectedBundles,
  handleDeleteSelectedHistory,
  handleDrop,
  handleFileSelect,
  handleRollback,
  handleUpload,
  history,
  openDayTimelineFromDashboard,
  passiveDayTimeline,
  selectDashboardTimelineDay,
  selectedApks,
  selectedBundles,
  selectedChannel,
  selectedHistory,
  setDashboardTimelineMapRef,
  uploadFile,
  uploading,
  versionInput,
  visitedPlacesError,
  visitedPlacesLoading,
  visitedTimelineActiveDay,
  visitedTimelineDayKey,
  visitedTimelineDays,
  visitedTimelineRows,
  visitedTimelineSegments,
  visitedTimelineStats,
  visitedTopPlaces
} = app.dashboard
</script>
