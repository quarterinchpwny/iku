<template>
  <!-- Login View -->
  <div
    v-if="!isAuthenticated"
    class="iku-shell flex min-h-screen items-center justify-center p-6 font-sans text-slate-800"
  >
    <div class="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <div class="mb-6 flex justify-center">
        <div class="rounded-lg bg-indigo-600 p-2">
          <Radio class="text-white" :size="24" />
        </div>
      </div>
      <h1 class="mb-2 text-center text-xl font-bold text-slate-900">Admin Login</h1>
      <p class="mb-6 text-center text-sm text-slate-500">Sign in to manage OTA updates</p>

      <form @submit.prevent="handleLogin" class="space-y-5">
        <div>
          <label for="username" class="mb-1 block text-sm font-medium text-slate-700"
            >Username</label
          >
          <input
            v-model="username"
            id="username"
            type="text"
            required
            class="block w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          />
        </div>
        <div>
          <label for="password" class="mb-1 block text-sm font-medium text-slate-700"
            >Password</label
          >
          <input
            v-model="password"
            id="password"
            type="password"
            required
            class="block w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          />
        </div>
        <div>
          <button
            :disabled="loggingIn"
            class="flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ loggingIn ? 'Signing in...' : 'Sign In' }}
          </button>
        </div>
        <div v-if="loginError" class="flex items-start gap-2 rounded-md bg-red-50 p-3">
          <AlertCircle class="mt-0.5 text-red-600" :size="16" />
          <p class="text-sm text-red-600">{{ loginError }}</p>
        </div>
      </form>
    </div>
  </div>

  <!-- Main Dashboard View -->
  <div v-else class="iku-shell iku-grid-bg min-h-screen pb-12 font-sans text-slate-800">
    <!-- Header -->
    <header class="iku-header sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-3">
          <div class="rounded-lg bg-indigo-600 p-2">
            <Radio class="text-white" :size="20" />
          </div>
          <div>
            <h1 class="text-lg font-bold leading-none tracking-tight text-slate-900">
              OTA Manager
            </h1>
            <p class="text-xs text-slate-500">System Dashboard</p>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <button
              @click="goToPage('dashboard')"
              :class="[
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                currentPage === 'dashboard'
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              ]"
            >
              Dashboard
            </button>
            <button
              @click="goToPage('map')"
              :class="[
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                currentPage === 'map'
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              ]"
            >
              Map
            </button>
            <button
              @click="goToPage('logs')"
              :class="[
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                currentPage === 'logs'
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              ]"
            >
              Logs
            </button>
          </div>
          <div class="mr-2 hidden flex-col items-end md:flex">
            <span class="text-sm font-medium text-slate-900">Admin User</span>
          </div>
          <button
            @click="handleLogout"
            class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <LogOut :size="14" />
            Logout
          </button>
        </div>
      </div>
    </header>

    <main v-if="currentPage === 'dashboard'" class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
                        <Clock :size="12" />
                        <span>{{ row.rangeLabel }}</span>
                      </div>
                    </div>
                    <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div class="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                        <div
                          class="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700"
                        >
                          <MapPinned :size="12" />
                          <span>Start</span>
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
                          <MapPinned :size="12" />
                          <span>End</span>
                        </div>
                        <div class="text-xs font-semibold text-amber-900">{{ row.endPlace }}</div>
                        <div class="mt-0.5 text-[10px] text-amber-700">{{ row.endStory }}</div>
                      </div>
                    </div>
                    <div class="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
                      <div class="mb-1 flex items-center justify-between">
                        <span
                          class="text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                          >Route Preview</span
                        >
                        <span class="font-mono text-[10px] text-slate-500">{{
                          row.rangeLabel
                        }}</span>
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
        <!-- LEFT COLUMN -->
        <div class="space-y-6 lg:col-span-4">
          <!-- Active Channels Widget -->
          <div
            class="iku-card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div
              class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4"
            >
              <h3 class="flex items-center gap-2 font-semibold text-slate-800">
                <Radio :size="18" class="text-indigo-600" />
                Active Channels
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
                    <Package :size="14" />
                    v{{ m.version }}
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

          <!-- Upload Section -->
          <div
            class="iku-card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
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
              <!-- OTA Upload Form -->
              <form
                v-if="activeUploadTab === 'ota'"
                @submit.prevent="handleUpload"
                class="space-y-5"
              >
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
                    placeholder="e.g. 1.0.3 or 1700000000"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div class="space-y-2">
                  <label class="block text-sm font-medium text-slate-700"
                    >Update Package (ZIP)</label
                  >
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

              <!-- APK Upload Form -->
              <form
                v-if="activeUploadTab === 'apk'"
                @submit.prevent="handleApkUpload"
                class="space-y-5"
              >
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-slate-700">Version</label>
                  <input
                    v-model="apkVersionInput"
                    placeholder="e.g. 1.0.3"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div class="space-y-2">
                  <label class="block text-sm font-medium text-slate-700"
                    >Application Package (APK)</label
                  >
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

        <!-- RIGHT COLUMN -->
        <div class="lg:col-span-8">
          <div
            class="iku-card flex h-full min-h-[600px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <!-- Tab Header -->
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
                  <Clock :size="14" />
                  History
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
                  <Smartphone :size="14" />
                  APK History
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
                  <Package :size="14" />
                  Bundles
                </button>
              </div>
              <div class="flex items-center gap-2">
                <button
                  v-if="activeHistoryTab === 'history' && selectedHistory.length > 0"
                  @click="handleDeleteSelectedHistory"
                  class="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                >
                  <Trash2 :size="14" />
                  Delete Selected ({{ selectedHistory.length }})
                </button>
                <button
                  v-if="activeHistoryTab === 'apk' && selectedApks.length > 0"
                  @click="handleDeleteSelectedApk"
                  class="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                >
                  <Trash2 :size="14" />
                  Delete Selected ({{ selectedApks.length }})
                </button>
                <button
                  v-if="activeHistoryTab === 'bundles' && selectedBundles.length > 0"
                  @click="handleDeleteSelectedBundles"
                  class="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                >
                  <Trash2 :size="14" />
                  Delete Selected ({{ selectedBundles.length }})
                </button>
                <button
                  @click="fetchAll"
                  class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <RotateCcw :size="14" />
                  Refresh
                </button>
              </div>
            </div>

            <!-- Content Area -->
            <div class="flex-1 overflow-x-auto p-2">
              <table class="w-full border-collapse text-left">
                <thead>
                  <tr class="border-b border-slate-200">
                    <template v-if="activeHistoryTab === 'history'">
                      <th class="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          :checked="history.length > 0 && selectedHistory.length === history.length"
                          @change="
                            selectedHistory = $event.target.checked ? history.map((h) => h.id) : []
                          "
                          class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th
                        class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Channel
                      </th>
                      <th
                        class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Version
                      </th>
                      <th
                        class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Filename
                      </th>
                      <th
                        class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Uploaded
                      </th>
                      <th
                        class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Actions
                      </th>
                    </template>
                    <template v-if="activeHistoryTab === 'apk'">
                      <th class="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          :checked="apks.length > 0 && selectedApks.length === apks.length"
                          @change="
                            selectedApks = $event.target.checked ? apks.map((h) => h.id) : []
                          "
                          class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th
                        class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Version
                      </th>
                      <th
                        class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Filename
                      </th>
                      <th
                        class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Uploaded
                      </th>
                      <th
                        class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Actions
                      </th>
                    </template>
                    <template v-if="activeHistoryTab === 'bundles'">
                      <th class="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          :checked="bundles.length > 0 && selectedBundles.length === bundles.length"
                          @change="
                            selectedBundles = $event.target.checked
                              ? bundles.map((b) => b.name)
                              : []
                          "
                          class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th
                        class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Key / Name
                      </th>
                      <th
                        class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Actions
                      </th>
                    </template>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <!-- OTA HISTORY ROWS -->
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
                          >{{ h.channel }}</span
                        >
                      </td>
                      <td class="px-4 py-3 font-mono text-sm text-slate-600">{{ h.version }}</td>
                      <td
                        class="max-w-[150px] truncate px-4 py-3 text-sm text-slate-500"
                        :title="h.filename"
                      >
                        {{ h.filename }}
                      </td>
                      <td class="px-4 py-3 text-sm text-slate-500">
                        {{ new Date(h.uploaded_at).toLocaleString() }}
                      </td>
                      <td class="whitespace-nowrap px-4 py-3 text-right">
                        <div
                          class="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100"
                        >
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

                  <!-- APK HISTORY ROWS -->
                  <template v-if="activeHistoryTab === 'apk'">
                    <tr
                      v-for="h in apks"
                      :key="h.id"
                      class="group transition-colors hover:bg-slate-50"
                    >
                      <td class="px-4 py-3">
                        <input
                          type="checkbox"
                          v-model="selectedApks"
                          :value="h.id"
                          class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td class="px-4 py-3 font-mono text-sm text-slate-700">{{ h.version }}</td>
                      <td
                        class="max-w-[200px] truncate px-4 py-3 text-sm text-slate-600"
                        :title="h.filename"
                      >
                        {{ h.filename }}
                      </td>
                      <td class="px-4 py-3 text-sm text-slate-500">
                        {{ new Date(h.uploaded_at).toLocaleString() }}
                      </td>
                      <td class="whitespace-nowrap px-4 py-3 text-right">
                        <div
                          class="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100"
                        >
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
                      <td colspan="5" class="px-4 py-12 text-center text-slate-400">
                        No APKs uploaded
                      </td>
                    </tr>
                  </template>

                  <!-- BUNDLES ROWS -->
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
                      <td
                        class="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700"
                      >
                        <Package :size="16" class="text-slate-400" />
                        {{ b.name }}
                      </td>
                      <td class="whitespace-nowrap px-4 py-3 text-right">
                        <div
                          class="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100"
                        >
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

    <main v-if="currentPage === 'map'" class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="iku-card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div
          class="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <h3 class="flex items-center gap-2 font-semibold text-slate-800">
            <MapPinned :size="18" class="text-indigo-600" />
            Ops Map
          </h3>
          <div class="flex flex-wrap items-center gap-2">
            <div
              class="hidden rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-600 md:block"
            >
              Last Sync:
              <span class="ml-1 font-mono text-slate-800">
                {{
                  lastSyncedPoint
                    ? new Date(Number(lastSyncedPoint.timestamp)).toLocaleString()
                    : 'No sync yet'
                }}
              </span>
            </div>
            <button
              @click="showLiveDevices = !showLiveDevices"
              class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50"
            >
              {{ showLiveDevices ? 'Hide Devices' : 'Show Devices' }}
            </button>
            <button
              @click="showPassiveDots = !showPassiveDots"
              class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50"
            >
              {{ showPassiveDots ? 'Hide Passive' : 'Show Passive' }}
            </button>
            <button
              @click="selectedRouteId = null"
              class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50"
            >
              Clear Route
            </button>
            <button
              @click="fitMapToData"
              class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50"
            >
              Fit View
            </button>
            <button
              @click="refreshTrackingNow"
              class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 p-4 lg:grid-cols-12">
          <div class="lg:col-span-8">
            <div class="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div class="text-[10px] uppercase tracking-wider text-slate-500">Routes</div>
                <div class="text-sm font-semibold text-slate-800">{{ routeSummaries.length }}</div>
              </div>
              <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div class="text-[10px] uppercase tracking-wider text-slate-500">Points</div>
                <div class="text-sm font-semibold text-slate-800">{{ trackingPoints.length }}</div>
              </div>
              <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div class="text-[10px] uppercase tracking-wider text-slate-500">Passive</div>
                <div class="text-sm font-semibold text-slate-800">
                  {{ passiveLocations.length }}
                </div>
              </div>
              <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div class="text-[10px] uppercase tracking-wider text-slate-500">
                  Selected Route
                </div>
                <div class="text-sm font-semibold text-slate-800">
                  {{ selectedRouteId ? `#${selectedRouteId}` : 'All' }}
                </div>
              </div>
              <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div class="text-[10px] uppercase tracking-wider text-slate-500">Devices</div>
                <div class="text-sm font-semibold text-slate-800">{{ liveDevices.length }}</div>
              </div>
              <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div class="text-[10px] uppercase tracking-wider text-slate-500">Active Routes</div>
                <div class="text-sm font-semibold text-slate-800">{{ activeRouteCount }}</div>
              </div>
              <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div class="text-[10px] uppercase tracking-wider text-slate-500">
                  Passive Routes
                </div>
                <div class="text-sm font-semibold text-slate-800">{{ passiveRouteCount }}</div>
              </div>
            </div>
            <div
              ref="mapContainer"
              class="h-[55vh] min-h-[380px] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
            />
            <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Last Sync Location:</span>
              <span class="font-mono text-slate-700">
                {{ latestLocationLabel }}
              </span>
              <span class="rounded bg-slate-100 px-2 py-0.5 text-[10px]">
                Refresh {{ mapAutoRefreshEnabled ? `ON (${mapAutoRefreshMs / 1000}s)` : 'OFF' }}
              </span>
            </div>
          </div>

          <div class="space-y-3 lg:col-span-4">
            <div class="rounded-lg border border-slate-200 p-3">
              <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Live Devices
              </div>
              <div class="mb-2 flex items-center gap-2">
                <select
                  v-model.number="liveWindowMinutes"
                  class="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
                >
                  <option :value="60">1h window</option>
                  <option :value="180">3h window</option>
                  <option :value="360">6h window</option>
                  <option :value="720">12h window</option>
                  <option :value="1440">24h window</option>
                </select>
                <button
                  @click="refreshTrackingNow"
                  class="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>
              <div class="max-h-48 overflow-auto rounded-lg border border-slate-200">
                <button
                  v-for="d in liveDevices"
                  :key="d.deviceId"
                  @click="focusDevice(d.deviceId)"
                  :class="[
                    'flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-xs transition-colors last:border-b-0',
                    selectedDeviceId === d.deviceId
                      ? 'bg-orange-50 text-orange-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  ]"
                >
                  <span class="min-w-0">
                    <span class="block truncate font-mono">{{ d.deviceLabel }}</span>
                    <span class="block truncate text-[10px] text-slate-500">
                      {{ Number(d.lat).toFixed(5) }}, {{ Number(d.lng).toFixed(5) }}
                    </span>
                  </span>
                  <span class="text-[10px]" :class="d.freshnessClass">{{ d.ageLabel }}</span>
                </button>
                <div
                  v-if="liveDevices.length === 0"
                  class="px-3 py-4 text-center text-xs text-slate-500"
                >
                  No live devices in selected window.
                </div>
              </div>
            </div>

            <div class="rounded-lg border border-slate-200 p-3">
              <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Live Polling
              </div>
              <div class="flex items-center gap-2">
                <button
                  @click="mapAutoRefreshEnabled = !mapAutoRefreshEnabled"
                  :class="[
                    'rounded-md border px-3 py-1.5 text-xs transition-colors',
                    mapAutoRefreshEnabled
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-slate-300 bg-white text-slate-600'
                  ]"
                >
                  {{ mapAutoRefreshEnabled ? 'Auto ON' : 'Auto OFF' }}
                </button>
                <select
                  v-model.number="mapAutoRefreshMs"
                  class="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
                >
                  <option :value="10000">10s</option>
                  <option :value="15000">15s</option>
                  <option :value="30000">30s</option>
                  <option :value="60000">60s</option>
                </select>
              </div>
            </div>

            <div class="rounded-lg border border-slate-200 p-3">
              <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Stay Insight
              </div>
              <div v-if="currentStaySummary" class="text-xs text-slate-700">
                Stayed at
                <span class="font-mono">
                  {{ Number(currentStaySummary.lat).toFixed(5) }},
                  {{ Number(currentStaySummary.lng).toFixed(5) }}
                </span>
                for
                <span class="font-semibold">{{ currentStaySummary.durationLabel }}</span>
                <span class="block text-[10px] text-slate-500">
                  {{ currentStaySummary.startedAtLabel }} - {{ currentStaySummary.endedAtLabel }}
                </span>
              </div>
              <div v-else class="text-xs text-slate-500">No long stay session yet.</div>
            </div>

            <div class="rounded-lg border border-slate-200 p-3">
              <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Day Timeline
              </div>
              <div class="max-h-48 overflow-auto rounded-lg border border-slate-200">
                <button
                  v-for="day in passiveDayTimeline"
                  :key="day.dayKey"
                  @click="openDayTimelineMap(day)"
                  class="w-full border-b border-slate-100 px-3 py-2 text-left text-xs transition-colors last:border-b-0 hover:bg-indigo-50/40"
                >
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-slate-800">{{ day.label }}</span>
                    <span class="font-mono text-[10px] text-slate-500"
                      >{{ day.routeCount }} routes</span
                    >
                  </div>
                  <div class="mt-1 text-[10px] text-slate-500">{{ day.summary }}</div>
                </button>
                <div
                  v-if="passiveDayTimeline.length === 0"
                  class="px-3 py-4 text-center text-xs text-slate-500"
                >
                  No passive day timeline yet.
                </div>
              </div>
            </div>

            <div class="rounded-lg border border-slate-200 p-3">
              <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Routes
              </div>
              <div class="mb-2 flex items-center gap-2">
                <select
                  v-model="routeFilter"
                  class="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
                >
                  <option value="ALL">All</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PASSIVE">Passive</option>
                </select>
              </div>
              <div class="max-h-[50vh] overflow-auto rounded-lg border border-slate-200">
                <button
                  v-for="route in filteredRouteSummaries"
                  :key="route.id"
                  @click="selectedRouteId = route.id"
                  :class="[
                    'flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-xs transition-colors last:border-b-0',
                    selectedRouteId === route.id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  ]"
                >
                  <span class="min-w-0">
                    <span class="block truncate font-medium">Route #{{ route.id }}</span>
                    <span class="block truncate font-mono text-[10px] text-slate-500">
                      {{ formatRouteWindowLabel(route) }}
                    </span>
                    <span
                      :class="
                        route.classification === 'ACTIVE' ? 'text-emerald-600' : 'text-sky-600'
                      "
                      class="block truncate font-mono text-[10px]"
                    >
                      {{ route.classification }}
                    </span>
                    <span class="block truncate text-[10px] text-slate-500">
                      {{ route.story || 'No route story' }}
                    </span>
                    <span class="block truncate font-mono text-[10px] text-slate-500">
                      status {{ route.routeStatus || '-' }} · dist
                      {{ Math.round(route.routeDistanceMeters || 0) }}m
                    </span>
                    <span
                      v-if="route.passiveSummary"
                      class="block truncate font-mono text-[10px] text-slate-500"
                    >
                      trig {{ route.passiveSummary.trigger || '-' }} · acc
                      {{ Math.round(route.passiveSummary.acc || 0) }}m · vel
                      {{ Math.round(route.passiveSummary.vel || 0) }}
                    </span>
                  </span>
                  <span class="text-right">
                    <span class="block font-mono text-[10px]">{{ route.pointCount }} pts</span>
                    <span class="block font-mono text-[10px] text-slate-500"
                      >{{ route.routePointCountServer || 0 }} srv</span
                    >
                    <span class="block font-mono text-[10px] text-slate-500">{{
                      route.durationLabel || '-'
                    }}</span>
                  </span>
                </button>
                <div
                  v-if="filteredRouteSummaries.length === 0"
                  class="px-3 py-4 text-center text-xs text-slate-500"
                >
                  No routes available
                </div>
              </div>
            </div>

            <div class="rounded-lg border border-slate-200 p-3">
              <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Activity Event Log
              </div>
              <div class="max-h-48 overflow-auto rounded-lg border border-slate-200">
                <div
                  v-for="evt in trackingEvents"
                  :key="evt.id"
                  class="border-b border-slate-100 px-3 py-2 text-xs last:border-b-0"
                >
                  <div class="flex items-center justify-between">
                    <span
                      :class="evt.source === 'ACTIVE' ? 'text-emerald-700' : 'text-sky-700'"
                      class="font-mono"
                    >
                      {{ evt.event_type }}
                    </span>
                    <span class="text-[10px] text-slate-500">{{ fmtEventTs(evt.timestamp) }}</span>
                  </div>
                  <div class="mt-1 font-mono text-[10px] text-slate-600">
                    route #{{ evt.route_id || '-' }} ·
                    {{ evt.account_key || evt.device_id || 'unknown' }}
                  </div>
                  <div
                    v-if="parseEventPayloadSummary(evt.payload)"
                    class="mt-1 font-mono text-[10px] text-slate-500"
                  >
                    {{ parseEventPayloadSummary(evt.payload) }}
                  </div>
                </div>
                <div
                  v-if="trackingEvents.length === 0"
                  class="px-3 py-4 text-center text-xs text-slate-500"
                >
                  No tracking events yet.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <LogsPage
      v-if="currentPage === 'logs'"
      :logs="backendApiLogs"
      :source-filter="apiLogsSourceFilter"
      :method-filter="apiLogsMethodFilter"
      :status-filter="apiLogsStatusFilter"
      :path-filter="apiLogsPathFilter"
      @update:source-filter="apiLogsSourceFilter = $event"
      @update:method-filter="apiLogsMethodFilter = $event"
      @update:status-filter="apiLogsStatusFilter = $event"
      @update:path-filter="apiLogsPathFilter = $event"
      @apply="fetchApiAccessLogs"
    />

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
              <div
                class="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500"
              >
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
                <span
                  class="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-slate-700"
                >
                  {{ seg.pointCount }} pts
                </span>
                <span
                  class="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-slate-700"
                >
                  {{ seg.durationLabel }}
                </span>
                <span
                  class="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-slate-700"
                >
                  {{ seg.displacementMeters }}m disp
                </span>
              </div>
              <div class="relative pl-4">
                <div class="absolute bottom-2 left-[6px] top-2 w-px bg-slate-300"></div>
                <div class="relative mb-2 rounded-md border border-emerald-200 bg-emerald-50 p-2">
                  <span
                    class="absolute -left-[14px] top-3 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500"
                  ></span>
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
                  <span
                    class="absolute -left-[14px] top-3 h-2.5 w-2.5 rounded-full border border-white bg-amber-500"
                  ></span>
                  <div class="text-xs font-semibold text-amber-900">{{ seg.endStory }}</div>
                  <div class="mt-1 text-[10px] text-amber-700">{{ seg.endTime }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <Transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="transform opacity-0 translate-y-2"
      enter-to-class="transform opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="transform opacity-100 translate-y-0"
      leave-to-class="transform opacity-0 translate-y-2"
    >
      <div
        v-if="message"
        :class="`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3 shadow-lg ${message.type === 'error' ? 'bg-red-600 text-white' : message.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'}`"
      >
        <component :is="message.type === 'error' ? AlertCircle : CheckCircle" :size="20" />
        <span class="text-sm font-medium">{{ message.text }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import LogsPage from './pages/LogsPage.vue';
import {
  Radio,
  LogOut,
  Package,
  Download,
  MoreVertical,
  CloudUpload,
  CheckCircle,
  Smartphone,
  Clock,
  RotateCcw,
  Trash2,
  AlertCircle,
  Loader2,
  MapPinned
} from 'lucide-vue-next';

// --- State ---

// UI State
const activeUploadTab = ref('ota'); // 'ota' | 'apk'
const activeHistoryTab = ref('history'); // 'history' | 'apk' | 'bundles'
const dragOver = ref(false);
const dragOverApk = ref(false);
const router = useRouter();
const route = useRoute();
const currentPage = computed(() =>
  route.path.startsWith('/map') ? 'map' : route.path.startsWith('/logs') ? 'logs' : 'dashboard'
);

// Auth state
const isAuthenticated = ref(false);
const authToken = ref(localStorage.getItem('authToken') || null);
const username = ref('');
const password = ref('');
const loggingIn = ref(false);
const loginError = ref('');

// Data state
const bundles = ref([]);
const channels = reactive({});
const history = ref([]);
const apks = ref([]);
const loading = ref(false);
const uploading = ref(false);
const apkUploading = ref(false);
const selectedChannel = ref('stable');
const versionInput = ref('');
const apkVersionInput = ref('');
const uploadFile = ref(null);
const apkFile = ref(null);
const message = ref(null);
const mapContainer = ref(null);
const showPassiveDots = ref(true);
const showLiveDevices = ref(true);
const routeFilter = ref('ALL');
const selectedRouteId = ref(null);
const selectedDeviceId = ref(null);
const trackingRoutes = ref([]);
const trackingPoints = ref([]);
const passiveLocations = ref([]);
const liveDevices = ref([]);
const trackingEvents = ref([]);
const backendApiLogs = ref([]);
const apiLogsSourceFilter = ref('ALL');
const apiLogsMethodFilter = ref('');
const apiLogsStatusFilter = ref('');
const apiLogsPathFilter = ref('');
const apiCallLogs = ref([]);
const liveWindowMinutes = ref(360);
const mapAutoRefreshEnabled = ref(true);
const mapAutoRefreshMs = ref(15000);

let mapLib = null;
let mapInstance = null;
let mapMarker = null;
let mapRouteLine = null;
let mapPassiveLayer = null;
let mapLiveLayer = null;
let mapStartMarker = null;
let mapEndMarker = null;
let mapRefreshTimer = null;
const dayTimelineMapOpen = ref(false);
const dayTimelineMapLabel = ref('');
const dayTimelineMapMeta = ref('');
const selectedDaySegments = ref([]);
const daySegmentMapRefs = ref(new Map());
const daySegmentMiniMaps = ref(new Map());
const dashboardTimelineMapRefs = ref(new Map());
const dashboardTimelineMiniMaps = ref(new Map());
const dashboardTimelineDayKey = ref('');

// Selections
const selectedHistory = ref([]);
const selectedApks = ref([]);
const selectedBundles = ref([]);

watch(activeHistoryTab, () => {
  selectedHistory.value = [];
  selectedApks.value = [];
  selectedBundles.value = [];
});

function normalizeLogUrl(url) {
  const raw = String(url || '');
  if (!raw) return '/';
  try {
    const parsed = new URL(raw, window.location.origin);
    return `${parsed.pathname}${parsed.search || ''}`;
  } catch (_err) {
    return raw;
  }
}

function pushApiLog(entry) {
  apiCallLogs.value = [entry, ...apiCallLogs.value].slice(0, 150);
}

function clearApiCallLogs() {
  apiCallLogs.value = [];
}

function formatApiLogTime(ts) {
  return new Date(Number(ts || 0)).toLocaleTimeString();
}

function apiLogClass(status) {
  if (!Number.isFinite(Number(status))) return 'text-slate-500';
  if (Number(status) >= 500) return 'text-rose-600';
  if (Number(status) >= 400) return 'text-amber-600';
  return 'text-emerald-600';
}

function goToPage(page) {
  const path = page === 'map' ? '/map' : page === 'logs' ? '/logs' : '/';
  if (route.path !== path) {
    router.push(path);
  }
}

const channelOptions = computed(() => {
  const keys = Object.keys(channels);
  return keys.length ? keys : ['stable', 'beta', 'dev'];
});

function geoDistanceMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(Number(b.lat) - Number(a.lat));
  const dLng = toRad(Number(b.lng) - Number(a.lng));
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(Number(a.lat))) *
      Math.cos(toRad(Number(b.lat))) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function prettyTime(ts) {
  return new Date(Number(ts || 0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRouteWindowLabel(route) {
  const start = Number(route?.startTimestamp || route?.timestamp || 0);
  const end = Number(route?.endTimestamp || start);
  if (!start) return '-';
  if (!end || end <= start) return new Date(start).toLocaleString();
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (startDate.toDateString() === endDate.toDateString()) {
    return `${startDate.toLocaleDateString()} ${prettyTime(start)} -> ${prettyTime(end)}`;
  }
  return `${startDate.toLocaleString()} -> ${endDate.toLocaleString()}`;
}

function formatDurationLabel(ms) {
  const safe = Math.max(0, Number(ms || 0));
  const mins = Math.floor(safe / 60_000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function bearingDegrees(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const y = Math.sin(toRad(Number(b.lng) - Number(a.lng))) * Math.cos(toRad(Number(b.lat)));
  const x =
    Math.cos(toRad(Number(a.lat))) * Math.sin(toRad(Number(b.lat))) -
    Math.sin(toRad(Number(a.lat))) *
      Math.cos(toRad(Number(b.lat))) *
      Math.cos(toRad(Number(b.lng) - Number(a.lng)));
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

function toCompass(deg) {
  if (!Number.isFinite(deg)) return 'N/A';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[idx];
}

function labelFromCenter(center, homeCenter, officeCenter, fallbackIndex) {
  if (homeCenter && geoDistanceMeters(center, homeCenter) <= 220) return 'Home';
  if (officeCenter && geoDistanceMeters(center, officeCenter) <= 220) return 'Office';
  return `Place ${fallbackIndex}`;
}

const TIMELINE_CHUNK_MAX_GAP_MS = 15 * 60 * 1000;
const TIMELINE_CHUNK_MAX_JUMP_M = 800;
const TIMELINE_CHUNK_MAX_DURATION_MS = 90 * 60 * 1000;

function summarizeTimelineSegment(segmentPoints) {
  const points = Array.isArray(segmentPoints) ? segmentPoints : [];
  if (!points.length) {
    return {
      routeIds: [],
      routeLabel: '-',
      pointCount: 0,
      durationMs: 0,
      durationLabel: formatDurationLabel(0),
      displacementMeters: 0,
      hasRoute14: false
    };
  }

  const routeIds = [
    ...new Set(points.map((p) => Number(p?.routeId)).filter((id) => Number.isFinite(id)))
  ].sort((a, b) => a - b);
  const start = points[0];
  const end = points[points.length - 1];
  const durationMs = Math.max(0, Number(end?.timestamp || 0) - Number(start?.timestamp || 0));
  let displacementMeters = 0;
  for (let i = 1; i < points.length; i++) {
    displacementMeters += geoDistanceMeters(points[i - 1], points[i]);
  }
  displacementMeters = Math.round(displacementMeters);

  return {
    routeIds,
    routeLabel: routeIds.length ? routeIds.map((id) => `#${id}`).join(', ') : '-',
    pointCount: points.length,
    durationMs,
    durationLabel: formatDurationLabel(durationMs),
    displacementMeters,
    hasRoute14: routeIds.includes(14)
  };
}

function buildTimeDistanceChunks(points) {
  const sorted = [...points]
    .map((p) => ({
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      timestamp: Number(p?.timestamp || 0),
      routeId: Number(p?.routeId)
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (sorted.length < 2) return [];

  const chunks = [];
  let chunkStart = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const gapMs = Math.max(0, cur.timestamp - prev.timestamp);
    const jumpM = geoDistanceMeters(prev, cur);
    const durationMs = Math.max(0, cur.timestamp - sorted[chunkStart].timestamp);

    if (
      gapMs > TIMELINE_CHUNK_MAX_GAP_MS ||
      jumpM > TIMELINE_CHUNK_MAX_JUMP_M ||
      durationMs > TIMELINE_CHUNK_MAX_DURATION_MS
    ) {
      chunks.push(sorted.slice(chunkStart, i));
      chunkStart = i;
    }
  }
  chunks.push(sorted.slice(chunkStart));

  return chunks
    .filter((chunk) => chunk.length >= 2)
    .map((chunk, idx) => {
      const start = chunk[0];
      const end = chunk[chunk.length - 1];
      const durationMs = Math.max(0, end.timestamp - start.timestamp);
      return {
        id: `${start.timestamp}-${end.timestamp}-fallback-${idx}`,
        startStory: 'Started moving',
        endStory: `Stopped after ${formatDurationLabel(durationMs)}`,
        startTime: prettyTime(start.timestamp),
        endTime: prettyTime(end.timestamp),
        points: chunk,
        ...summarizeTimelineSegment(chunk)
      };
    });
}

function buildDayTripSegments(points) {
  const sorted = [...points]
    .map((p) => ({
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      timestamp: Number(p?.timestamp || 0),
      routeId: Number(p?.routeId)
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length < 2) return [];

  const STOP_RADIUS_M = 130;
  const STOP_MIN_DURATION_MS = 20 * 60 * 1000;
  const stays = [];
  let groupStart = 0;
  let sumLat = sorted[0].lat;
  let sumLng = sorted[0].lng;
  let groupCount = 1;

  for (let i = 1; i < sorted.length; i++) {
    const center = { lat: sumLat / groupCount, lng: sumLng / groupCount };
    const far = geoDistanceMeters(center, sorted[i]) > STOP_RADIUS_M;
    if (!far) {
      sumLat += sorted[i].lat;
      sumLng += sorted[i].lng;
      groupCount += 1;
      continue;
    }
    const startTs = sorted[groupStart].timestamp;
    const endTs = sorted[i - 1].timestamp;
    const durationMs = endTs - startTs;
    if (durationMs >= STOP_MIN_DURATION_MS) {
      stays.push({
        startIdx: groupStart,
        endIdx: i - 1,
        start: startTs,
        end: endTs,
        center,
        durationMs
      });
    }
    groupStart = i;
    sumLat = sorted[i].lat;
    sumLng = sorted[i].lng;
    groupCount = 1;
  }

  const finalStart = sorted[groupStart].timestamp;
  const finalEnd = sorted[sorted.length - 1].timestamp;
  const finalDuration = finalEnd - finalStart;
  if (finalDuration >= STOP_MIN_DURATION_MS) {
    stays.push({
      startIdx: groupStart,
      endIdx: sorted.length - 1,
      start: finalStart,
      end: finalEnd,
      center: { lat: sumLat / groupCount, lng: sumLng / groupCount },
      durationMs: finalDuration
    });
  }
  if (stays.length < 2) return buildTimeDistanceChunks(sorted);

  const homeCenter = stays[0]?.center || null;
  const officeCenter =
    [...stays]
      .filter((s) => homeCenter && geoDistanceMeters(s.center, homeCenter) > 220)
      .sort((a, b) => b.durationMs - a.durationMs)[0]?.center || null;

  const segments = [];
  let idx = 1;
  for (let i = 0; i < stays.length - 1; i++) {
    const from = stays[i];
    const to = stays[i + 1];
    const fromLabel = labelFromCenter(from.center, homeCenter, officeCenter, idx++);
    const toLabel = labelFromCenter(to.center, homeCenter, officeCenter, idx++);
    const travelMs = Math.max(0, to.start - from.end);
    const tripPoints = sorted.slice(from.endIdx, to.startIdx + 1);
    if (tripPoints.length < 2) continue;
    segments.push({
      id: `${from.start}-${to.end}-${i}`,
      startStory: `At ${fromLabel} for ${formatDurationLabel(from.durationMs)}`,
      endStory: `Went to ${toLabel} in ${formatDurationLabel(travelMs)} • stayed ${formatDurationLabel(to.durationMs)}`,
      startTime: prettyTime(from.start),
      endTime: prettyTime(to.end),
      points: tripPoints,
      ...summarizeTimelineSegment(tripPoints)
    });
  }
  return segments.length ? segments : buildTimeDistanceChunks(sorted);
}

function buildPassiveStory(points) {
  const sorted = [...points]
    .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng), timestamp: Number(p.timestamp || 0) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length < 2)
    return { story: `Passive route with ${sorted.length} point`, durationMs: 0 };
  const totalMs = Math.max(0, sorted[sorted.length - 1].timestamp - sorted[0].timestamp);
  const dist = geoDistanceMeters(sorted[0], sorted[sorted.length - 1]);
  if (dist < 200) {
    return { story: `Stayed nearby for ${formatDurationLabel(totalMs)}`, durationMs: totalMs };
  }
  return {
    story: `Moved for ${formatDurationLabel(totalMs)} (${Math.round(dist)}m displacement)`,
    durationMs: totalMs
  };
}

function buildActiveStory(points) {
  const sorted = [...points]
    .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng), timestamp: Number(p.timestamp || 0) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length < 2)
    return { story: `Active route with ${sorted.length} point`, durationMs: 0 };
  const totalMs = Math.max(0, sorted[sorted.length - 1].timestamp - sorted[0].timestamp);
  const speeds = [];
  const bearings = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const dt = Math.max(1, (cur.timestamp - prev.timestamp) / 1000);
    const d = geoDistanceMeters(prev, cur);
    if (d < 2) continue;
    speeds.push((d / dt) * 3.6);
    bearings.push(bearingDegrees(prev, cur));
  }
  if (!speeds.length)
    return {
      story: `Active low movement for ${formatDurationLabel(totalMs)}`,
      durationMs: totalMs
    };
  const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const max = Math.max(...speeds);
  const startAvg =
    speeds.slice(0, Math.max(1, Math.floor(speeds.length / 3))).reduce((a, b) => a + b, 0) /
    Math.max(1, Math.floor(speeds.length / 3));
  const endSlice = speeds.slice(
    Math.max(0, speeds.length - Math.max(1, Math.floor(speeds.length / 3)))
  );
  const endAvg = endSlice.reduce((a, b) => a + b, 0) / Math.max(1, endSlice.length);
  const trend =
    endAvg > startAvg + 1 ? 'sped up' : endAvg < startAvg - 1 ? 'slowed down' : 'steady';
  const overall = toCompass(bearingDegrees(sorted[0], sorted[sorted.length - 1]));
  return {
    story: `Speed ${trend}: ${startAvg.toFixed(1)}→${endAvg.toFixed(1)} km/h • dir ${overall}`,
    durationMs: totalMs,
    activeMetrics: {
      avgSpeedKmh: avg.toFixed(1),
      maxSpeedKmh: max.toFixed(1),
      direction: overall,
      speedTrend: trend
    }
  };
}

const lastSyncedPoint = computed(() => {
  const latestPoint = [...trackingPoints.value].sort(
    (a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)
  )[0];
  return latestPoint || null;
});

const latestLocation = computed(() => {
  const latestPoint = lastSyncedPoint.value;
  if (latestPoint) {
    return {
      lat: Number(latestPoint.lat),
      lng: Number(latestPoint.lng),
      timestamp: latestPoint.timestamp
    };
  }
  const latestPassive = [...passiveLocations.value].sort((a, b) => b.timestamp - a.timestamp)[0];
  if (latestPassive) {
    return {
      lat: Number(latestPassive.lat),
      lng: Number(latestPassive.lng),
      timestamp: latestPassive.timestamp
    };
  }
  return null;
});

const routeSummaries = computed(() => {
  const passiveRouteIds = new Set(
    passiveLocations.value.map((pl) => Number(pl.route_id)).filter((id) => Number.isFinite(id))
  );
  const passiveByRoute = new Map();
  for (const pl of passiveLocations.value) {
    const routeKey = Number(pl?.route_id);
    if (!Number.isFinite(routeKey)) continue;
    if (!passiveByRoute.has(routeKey)) passiveByRoute.set(routeKey, []);
    passiveByRoute.get(routeKey).push(pl);
  }
  const counts = new Map();
  const pointsByRoute = new Map();
  for (const p of trackingPoints.value) {
    const key = Number(p.routeId);
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!pointsByRoute.has(key)) pointsByRoute.set(key, []);
    pointsByRoute.get(key).push(p);
  }
  return [...trackingRoutes.value]
    .map((r) => {
      const id = Number(r.id);
      const source = String(r.source || '').toUpperCase();
      const classification =
        source === 'ACTIVE'
          ? 'ACTIVE'
          : source === 'PASSIVE'
            ? 'PASSIVE'
            : passiveRouteIds.has(id)
              ? 'PASSIVE'
              : 'ACTIVE';
      const routePoints = (pointsByRoute.get(id) || []).sort(
        (a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0)
      );
      const firstPointTimestamp = Number(routePoints[0]?.timestamp || 0);
      const lastPointTimestamp = Number(routePoints[routePoints.length - 1]?.timestamp || 0);
      const startTimestamp = firstPointTimestamp || Number(r?.timestamp || 0);
      const endTimestamp = lastPointTimestamp || startTimestamp;
      const narrative =
        classification === 'ACTIVE'
          ? buildActiveStory(routePoints)
          : buildPassiveStory(routePoints);
      const passiveRows = (passiveByRoute.get(id) || []).sort(
        (a, b) => Number(a?.timestamp || 0) - Number(b?.timestamp || 0)
      );
      const latestPassive = passiveRows.length ? passiveRows[passiveRows.length - 1] : null;
      const avgAcc = passiveRows.length
        ? passiveRows.reduce((acc, row) => acc + Number(row?.acc || 0), 0) / passiveRows.length
        : null;
      return {
        ...r,
        id,
        startTimestamp,
        endTimestamp,
        pointCount: counts.get(id) || 0,
        classification,
        story: narrative.story,
        durationLabel: formatDurationLabel(narrative.durationMs || 0),
        activeMetrics: narrative.activeMetrics,
        routeStatus: String(r?.status || '').toUpperCase() || '-',
        routeDistanceMeters: Number(r?.distance_meters || 0),
        routePointCountServer: Number(r?.point_count || 0),
        passiveSampleCount: passiveRows.length,
        passiveSummary: latestPassive
          ? {
              trigger: String(latestPassive?.trigger || ''),
              provider: String(latestPassive?.provider || ''),
              acc: Number(latestPassive?.acc || 0),
              vel: Number(latestPassive?.vel || 0),
              cog: Number(latestPassive?.cog || 0),
              alt: Number(latestPassive?.alt || 0),
              avgAcc: avgAcc == null || Number.isNaN(avgAcc) ? null : Number(avgAcc)
            }
          : null
      };
    })
    .filter((r) => r.pointCount > 0)
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
});

const filteredRouteSummaries = computed(() => {
  if (routeFilter.value === 'ALL') return routeSummaries.value;
  return routeSummaries.value.filter((r) => r.classification === routeFilter.value);
});

const activeRouteCount = computed(
  () => routeSummaries.value.filter((r) => r.classification === 'ACTIVE').length
);
const passiveRouteCount = computed(
  () => routeSummaries.value.filter((r) => r.classification === 'PASSIVE').length
);

const selectedRoutePoints = computed(() => {
  if (!selectedRouteId.value) return [];
  return trackingPoints.value
    .filter((p) => Number(p.routeId) === Number(selectedRouteId.value))
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
});

const latestLocationLabel = computed(() => {
  if (!latestLocation.value) return 'No synced point yet';
  return `${Number(latestLocation.value.lat).toFixed(6)}, ${Number(latestLocation.value.lng).toFixed(6)}`;
});

const passiveStayGroups = computed(() => {
  if (!Array.isArray(passiveLocations.value) || passiveLocations.value.length === 0) {
    return [];
  }
  const sorted = [...passiveLocations.value]
    .map((p) => ({
      lat: Number(p.lat),
      lng: Number(p.lng),
      timestamp: Number(p.timestamp || 0)
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!sorted.length) return [];
  const DIST_THRESHOLD_M = 40;
  const MAX_GAP_MS = 15 * 60 * 1000;
  const groups = [];
  let current = {
    start: sorted[0].timestamp,
    end: sorted[0].timestamp,
    lat: sorted[0].lat,
    lng: sorted[0].lng,
    count: 1
  };

  const distanceMeters = (a, b) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371e3;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const aa =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  };

  for (let i = 1; i < sorted.length; i++) {
    const point = sorted[i];
    const prevPoint = sorted[i - 1];
    const gap = point.timestamp - prevPoint.timestamp;
    const dist = distanceMeters(current, point);
    if (gap <= MAX_GAP_MS && dist <= DIST_THRESHOLD_M) {
      current.end = point.timestamp;
      current.count += 1;
      current.lat = (current.lat * (current.count - 1) + point.lat) / current.count;
      current.lng = (current.lng * (current.count - 1) + point.lng) / current.count;
      continue;
    }
    groups.push(current);
    current = {
      start: point.timestamp,
      end: point.timestamp,
      lat: point.lat,
      lng: point.lng,
      count: 1
    };
  }
  groups.push(current);
  return groups;
});

const passiveDayTimeline = computed(() => {
  const buckets = new Map();
  const passiveRoutes = routeSummaries.value
    .filter((r) => r.classification === 'PASSIVE')
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  for (const route of passiveRoutes) {
    const ts = Number(route.timestamp || 0);
    if (!Number.isFinite(ts) || ts <= 0) continue;
    const d = new Date(ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(route);
  }
  return [...buckets.entries()]
    .map(([dayKey, routes]) => {
      const routeIds = routes.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
      const totalPoints = routes.reduce((acc, r) => acc + Number(r.pointCount || 0), 0);
      const date = new Date(`${dayKey}T00:00:00`);
      const narrative = routes
        .slice(0, 3)
        .map((r) => String(r.story || `Route #${r.id}`))
        .join(' • ');
      return {
        dayKey,
        label: date.toLocaleDateString(),
        routeCount: routes.length,
        routeIds,
        totalPoints,
        summary: narrative || `${routes.length} routes • ${totalPoints} points`,
        events: narrative
          ? narrative
              .split(' • ')
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 4)
          : [`${routes.length} routes visited`, `${totalPoints} points logged`]
      };
    })
    .sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))
    .slice(0, 7);
});

const dashboardTimelineActiveDay = computed(() => {
  const days = passiveDayTimeline.value;
  if (!days.length) return null;
  return days.find((day) => day.dayKey === dashboardTimelineDayKey.value) || days[0];
});

const dashboardTimelineActiveSegments = computed(() => {
  const day = dashboardTimelineActiveDay.value;
  if (!day) return [];
  const ids = Array.isArray(day.routeIds) ? day.routeIds : [];
  if (!ids.length) return [];
  const routePoints = ids
    .flatMap((rid) => trackingPoints.value.filter((p) => Number(p.routeId) === Number(rid)))
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  return buildDayTripSegments(routePoints);
});

function segmentStartPlace(story) {
  const raw = String(story || '');
  const match = raw.match(/^At\s+(.+?)\s+for\s+/i);
  return match?.[1] || 'Origin';
}

function segmentEndPlace(story) {
  const raw = String(story || '');
  const match = raw.match(/^Went to\s+(.+?)\s+in\s+/i);
  return match?.[1] || 'Destination';
}

function segmentTravelMode(segment) {
  const durationHours = Math.max(0.01, Number(segment?.durationMs || 0) / 3_600_000);
  const distanceKm = Math.max(0, Number(segment?.displacementMeters || 0) / 1000);
  const speedKmh = distanceKm / durationHours;
  if (speedKmh < 8) return 'Walk';
  if (speedKmh < 22) return 'Bike';
  return 'Drive';
}

const dashboardTimelineRows = computed(() => {
  return dashboardTimelineActiveSegments.value.map((segment, index) => ({
    ...segment,
    timelineIndex: index + 1,
    startPlace: segmentStartPlace(segment.startStory),
    endPlace: segmentEndPlace(segment.endStory),
    mode: segmentTravelMode(segment),
    rangeLabel: `${segment.startTime} - ${segment.endTime}`
  }));
});

const dashboardTimelineStats = computed(() => {
  const segments = dashboardTimelineActiveSegments.value;
  const displacementMeters = segments.reduce(
    (acc, seg) => acc + Number(seg.displacementMeters || 0),
    0
  );
  const durationMs = segments.reduce((acc, seg) => acc + Number(seg.durationMs || 0), 0);
  return {
    tripCount: segments.length,
    displacementLabel: `${Math.round(displacementMeters)}m`,
    durationLabel: formatDurationLabel(durationMs)
  };
});

const currentStaySummary = computed(() => {
  if (!passiveStayGroups.value.length) return null;
  const last = passiveStayGroups.value[passiveStayGroups.value.length - 1];
  const durationMs = Math.max(0, Number(last.end) - Number(last.start));
  const hours = Math.floor(durationMs / (60 * 60 * 1000));
  const minutes = Math.floor((durationMs % (60 * 60 * 1000)) / (60 * 1000));
  return {
    ...last,
    durationMs,
    durationLabel: `${hours}h ${minutes}m`,
    startedAtLabel: new Date(Number(last.start)).toLocaleString(),
    endedAtLabel: new Date(Number(last.end)).toLocaleString()
  };
});

function formatAgeLabel(timestamp) {
  const ageMs = Math.max(0, Date.now() - Number(timestamp || 0));
  if (ageMs < 60_000) return `${Math.floor(ageMs / 1000)}s`;
  if (ageMs < 3_600_000) return `${Math.floor(ageMs / 60_000)}m`;
  return `${Math.floor(ageMs / 3_600_000)}h`;
}

function freshnessClassForTs(timestamp) {
  const ageMs = Math.max(0, Date.now() - Number(timestamp || 0));
  if (ageMs < 5 * 60_000) return 'text-emerald-600';
  if (ageMs < 30 * 60_000) return 'text-amber-600';
  return 'text-rose-600';
}

watch([latestLocation, selectedRouteId], () => {
  renderMap();
});

watch(currentPage, async (page) => {
  if (page === 'map') {
    await fetchTrackingSnapshot();
    await nextTick();
    await renderMap();
    restartMapAutoRefresh();
    clearDashboardTimelineMiniMaps();
    if (mapInstance) {
      setTimeout(() => mapInstance.invalidateSize(), 80);
    }
    return;
  }

  stopMapAutoRefresh();
  if (page === 'dashboard') {
    await fetchTrackingSnapshot();
    await renderDashboardTimelineMiniMaps();
    return;
  }

  closeDayTimelineMap();
  clearDashboardTimelineMiniMaps();
  await fetchApiAccessLogs();
});

watch([mapAutoRefreshEnabled, mapAutoRefreshMs], () => {
  if (currentPage.value !== 'map') return;
  restartMapAutoRefresh();
});

watch(showPassiveDots, () => {
  renderMap();
});

watch(showLiveDevices, () => {
  renderMap();
});

watch(
  passiveDayTimeline,
  (days) => {
    if (!days.length) {
      dashboardTimelineDayKey.value = '';
      return;
    }
    if (!days.some((day) => day.dayKey === dashboardTimelineDayKey.value)) {
      dashboardTimelineDayKey.value = days[0].dayKey;
    }
  },
  { immediate: true }
);

watch(
  dashboardTimelineRows,
  async () => {
    if (currentPage.value !== 'dashboard') return;
    await renderDashboardTimelineMiniMaps();
  },
  { flush: 'post' }
);

watch(liveWindowMinutes, () => {
  if (currentPage.value !== 'map') return;
  fetchTrackingSnapshot();
});

watch(selectedDeviceId, () => {
  focusSelectedDevice();
  renderMap();
});

// --- Auth Functions ---

async function handleLogin() {
  loggingIn.value = true;
  loginError.value = '';
  try {
    const res = await loggedFetch(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.value, password: password.value })
      },
      false
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    authToken.value = data.token;
    localStorage.setItem('authToken', data.token);
    isAuthenticated.value = true;
    fetchAll();
  } catch (err) {
    loginError.value = err.message;
  } finally {
    loggingIn.value = false;
  }
}

async function handleLogout() {
  clearClientSession();
}

function clearClientSession() {
  stopMapAutoRefresh();
  const prevToken = authToken.value;
  if (prevToken) {
    loggedFetch(
      '/api/auth/logout',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${prevToken}` }
      },
      false
    ).catch(() => {});
  }
  localStorage.removeItem('authToken');
  authToken.value = null;
  isAuthenticated.value = false;
  // Clear all data
  bundles.value = [];
  Object.keys(channels).forEach((key) => delete channels[key]);
  history.value = [];
  apks.value = [];
  trackingRoutes.value = [];
  trackingPoints.value = [];
  passiveLocations.value = [];
  selectedRouteId.value = null;
  selectedDeviceId.value = null;
}

async function verifyToken() {
  if (!authToken.value) {
    isAuthenticated.value = false;
    return;
  }
  try {
    const res = await authenticatedFetch('/api/auth/me');
    if (!res.ok) throw new Error('Invalid session');
    isAuthenticated.value = true;
    fetchAll();
  } catch (err) {
    localStorage.removeItem('authToken');
    authToken.value = null;
    isAuthenticated.value = false;
  }
}

// --- API Helper ---

async function authenticatedFetch(url, options = {}) {
  return loggedFetch(url, options, true);
}

async function loggedFetch(url, options = {}, requireAuth = false) {
  const method = String(options?.method || 'GET').toUpperCase();
  const path = normalizeLogUrl(url);
  const startedAt = Date.now();
  const headers = requireAuth
    ? {
        ...options.headers,
        Authorization: `Bearer ${authToken.value}`
      }
    : { ...options.headers };

  try {
    const res = await fetch(url, { ...options, headers });
    const durationMs = Date.now() - startedAt;
    pushApiLog({
      id: `${startedAt}-${Math.random().toString(36).slice(2, 7)}`,
      at: startedAt,
      method,
      path,
      status: Number(res.status || 0),
      ok: !!res.ok,
      durationMs
    });

    if (requireAuth && res.status === 401) {
      clearClientSession();
      throw new Error('Session expired. Please log in again.');
    }
    return res;
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    pushApiLog({
      id: `${startedAt}-${Math.random().toString(36).slice(2, 7)}`,
      at: startedAt,
      method,
      path,
      status: 0,
      ok: false,
      durationMs,
      error: err?.message || 'network_error'
    });
    throw err;
  }
}

async function loadLeaflet() {
  if (mapLib) return mapLib;
  if (window.L) {
    mapLib = window.L;
    return mapLib;
  }

  if (!document.getElementById('leaflet-css')) {
    const css = document.createElement('link');
    css.id = 'leaflet-css';
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
  }

  if (!document.getElementById('leaflet-js')) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load map library'));
      document.body.appendChild(script);
    });
  }

  mapLib = window.L;
  return mapLib;
}

async function ensureMap() {
  if (!mapContainer.value) return null;
  const L = await loadLeaflet();
  if (mapInstance) return mapInstance;

  mapInstance = L.map(mapContainer.value, { zoomControl: false, attributionControl: false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(mapInstance);
  const initial = await getInitialLatLng();
  mapInstance.setView([initial.lat, initial.lng], 17);
  return mapInstance;
}

async function getInitialLatLng() {
  try {
    const pos = await new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('geolocation_unavailable'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });
    return {
      lat: Number(pos.coords.latitude),
      lng: Number(pos.coords.longitude)
    };
  } catch (_err) {
    return { lat: 14.5995, lng: 120.9842 };
  }
}

async function renderMap() {
  if (!isAuthenticated.value) return;
  const map = await ensureMap();
  if (!map) return;
  const L = mapLib;

  if (mapMarker) {
    map.removeLayer(mapMarker);
    mapMarker = null;
  }
  if (mapRouteLine) {
    map.removeLayer(mapRouteLine);
    mapRouteLine = null;
  }
  if (mapPassiveLayer) {
    map.removeLayer(mapPassiveLayer);
    mapPassiveLayer = null;
  }
  if (mapLiveLayer) {
    map.removeLayer(mapLiveLayer);
    mapLiveLayer = null;
  }
  if (mapStartMarker) {
    map.removeLayer(mapStartMarker);
    mapStartMarker = null;
  }
  if (mapEndMarker) {
    map.removeLayer(mapEndMarker);
    mapEndMarker = null;
  }

  if (latestLocation.value) {
    mapMarker = L.circleMarker([latestLocation.value.lat, latestLocation.value.lng], {
      radius: 7,
      color: '#fb923c',
      fillColor: '#fdba74',
      fillOpacity: 0.95,
      weight: 2
    }).addTo(map);
    const syncTime = lastSyncedPoint.value
      ? new Date(Number(lastSyncedPoint.value.timestamp)).toLocaleString()
      : latestLocation.value.timestamp
        ? new Date(Number(latestLocation.value.timestamp)).toLocaleString()
        : 'Unknown';
    mapMarker.bindPopup(
      `<div style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;">
        <div style="font-weight: 700; margin-bottom: 4px;">Last Sync Location</div>
        <div>${Number(latestLocation.value.lat).toFixed(6)}, ${Number(latestLocation.value.lng).toFixed(6)}</div>
        <div style="opacity: 0.75; margin-top: 4px;">${syncTime}</div>
      </div>`
    );
  }

  if (selectedRoutePoints.value.length > 1) {
    const coords = selectedRoutePoints.value.map((p) => [Number(p.lat), Number(p.lng)]);
    const selectedRoute = routeSummaries.value.find(
      (r) => Number(r.id) === Number(selectedRouteId.value)
    );
    const routeColor = selectedRoute?.classification === 'ACTIVE' ? '#10b981' : '#f97316';
    mapRouteLine = L.polyline(coords, {
      color: routeColor,
      weight: 4,
      opacity: 0.85
    }).addTo(map);
    mapStartMarker = L.circleMarker(coords[0], {
      radius: 5,
      color: '#0f766e',
      fillColor: '#14b8a6',
      fillOpacity: 0.9,
      weight: 2
    }).addTo(map);
    mapEndMarker = L.circleMarker(coords[coords.length - 1], {
      radius: 6,
      color: '#92400e',
      fillColor: '#fb923c',
      fillOpacity: 1,
      weight: 2
    }).addTo(map);
    map.fitBounds(mapRouteLine.getBounds(), { padding: [20, 20] });
    return;
  }

  if (showPassiveDots.value && passiveLocations.value.length > 0) {
    const dots = [...passiveLocations.value]
      .slice(-300)
      .map((p) => {
        const lat = Number(p.lat);
        const lng = Number(p.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return L.circleMarker([lat, lng], {
          radius: 2,
          color: '#0369a1',
          fillColor: '#38bdf8',
          fillOpacity: 0.45,
          weight: 1
        });
      })
      .filter(Boolean);
    if (dots.length) {
      mapPassiveLayer = L.layerGroup(dots).addTo(map);
    }
  }

  if (showLiveDevices.value && liveDevices.value.length > 0) {
    const markers = liveDevices.value
      .map((d) => {
        const lat = Number(d.lat);
        const lng = Number(d.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const selected = selectedDeviceId.value && selectedDeviceId.value === d.deviceId;
        const marker = L.circleMarker([lat, lng], {
          radius: selected ? 8 : 6,
          color: selected ? '#9a3412' : '#334155',
          fillColor:
            d.freshnessClass === 'text-emerald-600'
              ? '#10b981'
              : d.freshnessClass === 'text-amber-600'
                ? '#f59e0b'
                : '#f43f5e',
          fillOpacity: selected ? 0.95 : 0.8,
          weight: 2
        });
        const ts = Number(d.timestamp || 0);
        marker.bindPopup(
          `<div style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;">
            <div style="font-weight: 700; margin-bottom: 4px;">${d.deviceLabel}</div>
            <div>${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
            <div style="opacity: 0.75; margin-top: 4px;">${ts ? new Date(ts).toLocaleString() : 'Unknown'}</div>
          </div>`
        );
        marker.on('click', () => {
          selectedDeviceId.value = d.deviceId;
        });
        return marker;
      })
      .filter(Boolean);
    if (markers.length) {
      mapLiveLayer = L.layerGroup(markers).addTo(map);
    }
  }

  if (latestLocation.value) {
    map.setView([latestLocation.value.lat, latestLocation.value.lng], 15);
  }
}

function fitMapToData() {
  if (!mapInstance || !mapLib) return;
  const L = mapLib;

  if (selectedRoutePoints.value.length > 1) {
    const coords = selectedRoutePoints.value.map((p) => L.latLng(Number(p.lat), Number(p.lng)));
    mapInstance.fitBounds(L.latLngBounds(coords), { padding: [24, 24] });
    return;
  }

  const points = [...trackingPoints.value].slice(-400);
  if (!points.length) {
    if (latestLocation.value) {
      mapInstance.setView([latestLocation.value.lat, latestLocation.value.lng], 15);
    }
    return;
  }
  const bounds = L.latLngBounds(points.map((p) => L.latLng(Number(p.lat), Number(p.lng))));
  mapInstance.fitBounds(bounds, { padding: [24, 24] });
}

async function refreshTrackingNow() {
  await fetchTrackingSnapshot();
  fitMapToData();
}

function focusSelectedDevice() {
  if (!mapInstance || !selectedDeviceId.value) return;
  const selected = liveDevices.value.find((d) => d.deviceId === selectedDeviceId.value);
  if (!selected) return;
  mapInstance.setView([Number(selected.lat), Number(selected.lng)], 15, { animate: true });
}

function focusDevice(deviceId) {
  selectedDeviceId.value = deviceId;
}

function selectDashboardTimelineDay(dayKey) {
  dashboardTimelineDayKey.value = String(dayKey || '');
}

function stopMapAutoRefresh() {
  if (mapRefreshTimer) {
    clearInterval(mapRefreshTimer);
    mapRefreshTimer = null;
  }
}

async function openDayTimelineMap(day) {
  const ids = Array.isArray(day?.routeIds) ? day.routeIds : [];
  if (!ids.length) return;
  await loadLeaflet();
  dayTimelineMapOpen.value = true;
  dayTimelineMapLabel.value = `Timeline ${day.label}`;
  dayTimelineMapMeta.value = `${ids.length} routes • ${Number(day.totalPoints || 0)} points`;
  selectedDaySegments.value = [];
  await nextTick();

  const routePoints = ids
    .flatMap((rid) => trackingPoints.value.filter((p) => Number(p.routeId) === Number(rid)))
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  selectedDaySegments.value = buildDayTripSegments(routePoints);
  await renderSelectedDaySegmentMaps();
}

function closeDayTimelineMap() {
  dayTimelineMapOpen.value = false;
  dayTimelineMapLabel.value = '';
  dayTimelineMapMeta.value = '';
  selectedDaySegments.value = [];
  for (const map of daySegmentMiniMaps.value.values()) {
    map.remove();
  }
  daySegmentMiniMaps.value.clear();
  daySegmentMapRefs.value.clear();
}

function setDaySegmentMapRef(el, id) {
  if (el) {
    daySegmentMapRefs.value.set(id, el);
  }
}

function setDashboardTimelineMapRef(el, id) {
  if (el) {
    dashboardTimelineMapRefs.value.set(id, el);
    return;
  }
  dashboardTimelineMapRefs.value.delete(id);
}

function clearDashboardTimelineMiniMaps() {
  for (const map of dashboardTimelineMiniMaps.value.values()) {
    map.remove();
  }
  dashboardTimelineMiniMaps.value.clear();
  dashboardTimelineMapRefs.value.clear();
}

async function renderDashboardTimelineMiniMaps() {
  if (currentPage.value !== 'dashboard') return;
  await loadLeaflet();
  await nextTick();
  if (!mapLib) return;
  const L = mapLib;
  const ids = new Set(dashboardTimelineRows.value.map((row) => row.id));
  for (const [id, mini] of dashboardTimelineMiniMaps.value.entries()) {
    if (!ids.has(id)) {
      mini.remove();
      dashboardTimelineMiniMaps.value.delete(id);
    }
  }

  for (let i = 0; i < dashboardTimelineRows.value.length; i++) {
    const row = dashboardTimelineRows.value[i];
    const container = dashboardTimelineMapRefs.value.get(row.id);
    if (!container) continue;
    if (dashboardTimelineMiniMaps.value.has(row.id)) {
      dashboardTimelineMiniMaps.value.get(row.id).remove();
      dashboardTimelineMiniMaps.value.delete(row.id);
    }
    const mini = L.map(container, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(mini);
    const coords = (Array.isArray(row.points) ? row.points : [])
      .map((p) => [Number(p.lat), Number(p.lng)])
      .filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]));
    if (coords.length >= 2) {
      L.polyline(coords, { color: '#38bdf8', weight: 4, opacity: 0.9 }).addTo(mini);
      L.circleMarker(coords[0], {
        radius: 4,
        color: '#ffffff',
        fillColor: '#10b981',
        fillOpacity: 1,
        weight: 1.5
      }).addTo(mini);
      L.circleMarker(coords[coords.length - 1], {
        radius: 4,
        color: '#ffffff',
        fillColor: '#f59e0b',
        fillOpacity: 1,
        weight: 1.5
      }).addTo(mini);
      mini.fitBounds(L.latLngBounds(coords), { padding: [12, 12] });
    } else {
      mini.setView([14.5995, 120.9842], 12);
    }
    dashboardTimelineMiniMaps.value.set(row.id, mini);
  }
}

async function renderSelectedDaySegmentMaps() {
  await nextTick();
  if (!mapLib) return;
  const L = mapLib;
  const palette = ['#f59e0b', '#38bdf8', '#22c55e', '#f472b6', '#a78bfa', '#fb7185', '#14b8a6'];
  for (let i = 0; i < selectedDaySegments.value.length; i++) {
    const seg = selectedDaySegments.value[i];
    const container = daySegmentMapRefs.value.get(seg.id);
    if (!container) continue;
    if (daySegmentMiniMaps.value.has(seg.id)) {
      daySegmentMiniMaps.value.get(seg.id).remove();
      daySegmentMiniMaps.value.delete(seg.id);
    }
    const mini = L.map(container, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(mini);
    const coords = seg.points.map((p) => [Number(p.lat), Number(p.lng)]);
    const color = palette[i % palette.length];
    L.polyline(coords, { color, weight: 4, opacity: 0.9 }).addTo(mini);
    L.circleMarker(coords[0], {
      radius: 4,
      color: '#ffffff',
      fillColor: '#10b981',
      fillOpacity: 1,
      weight: 1.5
    }).addTo(mini);
    L.circleMarker(coords[coords.length - 1], {
      radius: 4,
      color: '#ffffff',
      fillColor: '#f97316',
      fillOpacity: 1,
      weight: 1.5
    }).addTo(mini);
    mini.fitBounds(L.latLngBounds(coords), { padding: [14, 14] });
    daySegmentMiniMaps.value.set(seg.id, mini);
  }
}

async function openDayTimelineFromDashboard(day) {
  goToPage('map');
  await nextTick();
  await openDayTimelineMap(day);
}

function restartMapAutoRefresh() {
  stopMapAutoRefresh();
  if (!mapAutoRefreshEnabled.value) return;
  mapRefreshTimer = setInterval(
    () => {
      fetchTrackingSnapshot();
    },
    Number(mapAutoRefreshMs.value || 15000)
  );
}

async function fetchLiveDevices() {
  const res = await authenticatedFetch(
    `/api/location/live?windowMinutes=${Number(liveWindowMinutes.value || 360)}`
  );
  if (!res.ok) throw new Error('Failed to load live devices');
  const data = await res.json();
  const now = Date.now();
  const devices = Array.isArray(data?.devices) ? data.devices : [];
  liveDevices.value = devices
    .map((d) => ({
      ...d,
      deviceLabel: String(d.accountKey || d.deviceId || 'unknown-device').slice(0, 16),
      ageMs: Math.max(0, now - Number(d.timestamp || 0)),
      ageLabel: formatAgeLabel(Number(d.timestamp || 0)),
      freshnessClass: freshnessClassForTs(Number(d.timestamp || 0))
    }))
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));

  if (
    selectedDeviceId.value &&
    !liveDevices.value.some((d) => d.deviceId === selectedDeviceId.value)
  ) {
    selectedDeviceId.value = null;
  }
}

async function fetchTrackingEvents() {
  const res = await authenticatedFetch('/api/location/events?limit=120');
  if (!res.ok) throw new Error('Failed to load tracking events');
  const data = await res.json();
  trackingEvents.value = Array.isArray(data?.events) ? data.events : [];
}

async function fetchApiAccessLogs() {
  const params = new URLSearchParams();
  params.set('limit', '180');
  if (apiLogsSourceFilter.value && apiLogsSourceFilter.value !== 'ALL') {
    params.set('source', apiLogsSourceFilter.value);
  }
  if (apiLogsMethodFilter.value) {
    params.set('method', apiLogsMethodFilter.value);
  }
  const statusVal = Number(apiLogsStatusFilter.value);
  if (Number.isFinite(statusVal) && statusVal >= 100 && statusVal <= 599) {
    params.set('status', String(Math.floor(statusVal)));
  }
  if (apiLogsPathFilter.value.trim()) {
    params.set('pathContains', apiLogsPathFilter.value.trim());
  }

  const res = await authenticatedFetch(`/api/location/api-logs?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load API access logs');
  const data = await res.json();
  backendApiLogs.value = Array.isArray(data?.logs) ? data.logs : [];
}

async function fetchTrackingSnapshot() {
  try {
    const [snapshotRes] = await Promise.all([
      authenticatedFetch('/api/location/fetchAll'),
      fetchLiveDevices().catch((err) => {
        console.error('Failed to load live devices:', err);
      }),
      fetchTrackingEvents().catch((err) => {
        console.error('Failed to load tracking events:', err);
      }),
      fetchApiAccessLogs().catch((err) => {
        console.error('Failed to load API access logs:', err);
      })
    ]);
    if (!snapshotRes.ok) throw new Error('Failed to load tracking snapshot');
    const data = await snapshotRes.json();

    trackingRoutes.value = Array.isArray(data?.routes) ? data.routes : [];
    trackingPoints.value = Array.isArray(data?.points) ? data.points : [];
    passiveLocations.value = Array.isArray(data?.passive_locations) ? data.passive_locations : [];

    if (
      selectedRouteId.value &&
      !trackingRoutes.value.some((r) => Number(r.id) === Number(selectedRouteId.value))
    ) {
      selectedRouteId.value = null;
    }

    await nextTick();
    await renderMap();
    focusSelectedDevice();
  } catch (err) {
    console.error(err);
  }
}

function fmtEventTs(ts) {
  const n = Number(ts || 0);
  if (!n) return '-';
  return new Date(n).toLocaleString();
}

function parseEventPayloadSummary(payload) {
  if (!payload) return '';
  try {
    const obj = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!obj || typeof obj !== 'object') return '';
    const reason = obj.reason ? `reason:${String(obj.reason)}` : '';
    const error = obj.error ? `error:${String(obj.error).slice(0, 80)}` : '';
    const parts = [reason, error].filter(Boolean);
    return parts.join(' · ');
  } catch (_err) {
    return '';
  }
}

// --- Dashboard Functions ---

function toast(text, type = 'info') {
  message.value = { text, type };
  setTimeout(() => (message.value = null), 4000);
}

async function fetchAll() {
  loading.value = true;
  try {
    const [bundlesRes, channelsRes, historyRes, apksRes] = await Promise.all([
      authenticatedFetch('/api/ota/admin/bundles')
        .then((r) => r.json())
        .catch(() => ({ bundles: [] })),
      authenticatedFetch('/api/ota/admin/channels')
        .then((r) => r.json())
        .catch(() => ({ channels: {} })),
      authenticatedFetch('/api/ota/admin/history')
        .then((r) => r.json())
        .catch(() => ({ history: [] })),
      authenticatedFetch('/api/ota/admin/apks')
        .then((r) => r.json())
        .catch(() => ({ apks: [] }))
    ]);

    bundles.value = bundlesRes.bundles || bundlesRes.objects || [];
    Object.assign(channels, channelsRes.channels || {});
    history.value = historyRes.history || [];
    apks.value = apksRes.apks || [];
    await fetchTrackingSnapshot();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Failed to load data', 'error');
  } finally {
    loading.value = false;
  }
}

// --- File Handling Functions ---

function handleFileSelect(event, type) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (type === 'ota') uploadFile.value = file;
  if (type === 'apk') apkFile.value = file;
}

function handleDrop(event, type) {
  dragOver.value = false;
  dragOverApk.value = false;
  const file = event.dataTransfer.files?.[0];
  if (!file) return;

  if (type === 'ota') {
    if (!file.name.endsWith('.zip')) {
      toast('Please upload a ZIP file', 'error');
      return;
    }
    uploadFile.value = file;
  } else if (type === 'apk') {
    if (!file.name.endsWith('.apk')) {
      toast('Please upload an APK file', 'error');
      return;
    }
    apkFile.value = file;
  }
}

function clearUpload() {
  versionInput.value = '';
  uploadFile.value = null;
}

function clearApkUpload() {
  apkVersionInput.value = '';
  apkFile.value = null;
}

async function handleUpload() {
  if (!uploadFile.value) return toast('Please select a file', 'error');
  if (!versionInput.value) return toast('Please enter a version', 'error');

  const fd = new FormData();
  fd.append('file', uploadFile.value);
  fd.append('version', versionInput.value);
  fd.append('channel', selectedChannel.value);

  uploading.value = true;
  try {
    const res = await authenticatedFetch('/api/ota/admin/ota/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Upload failed');
    toast(`Uploaded ${data.manifest.version}`, 'success');
    clearUpload();
    await fetchAll();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Upload error', 'error');
  } finally {
    uploading.value = false;
  }
}

async function handleApkUpload() {
  if (!apkFile.value) return toast('Please select an APK file', 'error');
  if (!apkVersionInput.value) return toast('Please enter a version', 'error');

  const fd = new FormData();
  fd.append('file', apkFile.value);
  fd.append('version', apkVersionInput.value);

  apkUploading.value = true;
  try {
    const res = await authenticatedFetch('/api/ota/admin/apk/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Upload failed');
    toast(`Uploaded APK ${data.uploaded.version}`, 'success');
    clearApkUpload();
    await fetchAll();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Upload error', 'error');
  } finally {
    apkUploading.value = false;
  }
}

async function handleDeleteBundle(key) {
  if (!confirm(`Delete bundle ${key}? This will remove the ZIP from storage.`)) return;
  try {
    const res = await authenticatedFetch('/api/ota/admin/bundle', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Delete failed');
    toast('Bundle deleted', 'success');
    await fetchAll();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Delete error', 'error');
  }
}

async function handleRollback(channel, version) {
  if (!confirm(`Set channel '${channel}' active version to '${version}'?`)) return;
  try {
    const entry = history.value.find((h) => h.channel === channel && h.version === version);
    if (!entry) throw new Error('History entry not found');
    const manifest = {
      version: entry.version,
      key: entry.filename,
      url: `${location.origin}/api/ota/bundle/${entry.filename}`,
      updated: entry.uploaded_at
    };
    const res = await authenticatedFetch(`/api/ota/admin/manifest/${channel}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(manifest)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Rollback failed');
    toast('Rollback applied', 'success');
    await fetchAll();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Rollback error', 'error');
  }
}

async function handleDeleteHistory(id, channel, version, filename) {
  if (
    !confirm(`Delete history ${channel}:${version}? This will also delete the bundle ${filename}.`)
  )
    return;
  try {
    const res = await authenticatedFetch(`/api/ota/admin/ota/updates/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Delete history failed');
    toast('History and bundle deleted', 'success');
    await fetchAll();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Delete history error', 'error');
  }
}

async function handleDeleteApk(id, filename) {
  if (!confirm(`Delete APK ${filename}? This will remove the APK from storage.`)) return;
  try {
    const res = await authenticatedFetch(`/api/ota/admin/apk/apks/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Delete failed');
    toast('APK deleted', 'success');
    await fetchAll();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Delete error', 'error');
  }
}

async function handleDeleteSelectedHistory() {
  if (!selectedHistory.value.length) return;
  if (!confirm(`Delete ${selectedHistory.value.length} selected history entries?`)) return;
  try {
    const res = await authenticatedFetch('/api/ota/admin/ota/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedHistory.value })
    });
    if (!res.ok) throw new Error('Bulk delete failed');
    toast(`Deleted ${selectedHistory.value.length} entries`, 'success');
    selectedHistory.value = [];
    await fetchAll();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function handleDeleteSelectedApk() {
  if (!selectedApks.value.length) return;
  if (!confirm(`Delete ${selectedApks.value.length} selected APKs?`)) return;
  try {
    const res = await authenticatedFetch('/api/ota/admin/apk/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedApks.value })
    });
    if (!res.ok) throw new Error('Bulk delete failed');
    toast(`Deleted ${selectedApks.value.length} APKs`, 'success');
    selectedApks.value = [];
    await fetchAll();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function handleDeleteSelectedBundles() {
  if (!selectedBundles.value.length) return;
  if (!confirm(`Delete ${selectedBundles.value.length} selected bundles?`)) return;
  try {
    const res = await authenticatedFetch('/api/ota/admin/bundles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: selectedBundles.value })
    });
    if (!res.ok) throw new Error('Bulk delete failed');
    toast(`Deleted ${selectedBundles.value.length} bundles`, 'success');
    selectedBundles.value = [];
    await fetchAll();
  } catch (err) {
    toast(err.message, 'error');
  }
}

onMounted(async () => {
  await verifyToken();
  await nextTick();
  if (currentPage.value === 'map') {
    await renderMap();
  }
});

onUnmounted(() => {
  closeDayTimelineMap();
  clearDashboardTimelineMiniMaps();
  stopMapAutoRefresh();
});
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Space+Grotesk:wght@400;500;700&display=swap');

:root {
  --iku-bg: #090a0c;
  --iku-panel: #111418;
  --iku-panel-soft: #161a20;
  --iku-border: #2a2f37;
  --iku-accent: #f97316;
}

.iku-shell {
  font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
  background:
    radial-gradient(900px 300px at 12% 0%, rgba(249, 115, 22, 0.18), transparent 55%),
    radial-gradient(700px 320px at 88% 0%, rgba(14, 165, 233, 0.12), transparent 60%), var(--iku-bg);
  color: #e6eaf0;
}

.iku-grid-bg {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 24px 24px;
}

.iku-header {
  background: rgba(17, 20, 24, 0.85) !important;
  backdrop-filter: blur(12px);
  border-color: var(--iku-border) !important;
}

.iku-card {
  background: linear-gradient(180deg, rgba(22, 26, 32, 0.92), rgba(17, 20, 24, 0.96)) !important;
  border-color: var(--iku-border) !important;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
}

.iku-shell .font-mono {
  font-family: 'JetBrains Mono', monospace !important;
}

.iku-shell .bg-white,
.iku-shell .bg-slate-50,
.iku-shell .bg-slate-100 {
  background-color: transparent !important;
}

.iku-shell .text-slate-900,
.iku-shell .text-slate-800,
.iku-shell .text-slate-700 {
  color: #e6eaf0 !important;
}

.iku-shell .text-slate-600,
.iku-shell .text-slate-500,
.iku-shell .text-slate-400 {
  color: #9da7b5 !important;
}

.iku-shell .border-slate-300,
.iku-shell .border-slate-200,
.iku-shell .border-slate-100 {
  border-color: var(--iku-border) !important;
}

.iku-shell .bg-indigo-600,
.iku-shell .hover\:bg-indigo-700:hover {
  background-color: var(--iku-accent) !important;
}

.iku-shell .text-indigo-600,
.iku-shell .hover\:text-indigo-600:hover {
  color: var(--iku-accent) !important;
}

.iku-shell .focus\:ring-indigo-500:focus {
  --tw-ring-color: rgba(249, 115, 22, 0.55) !important;
}

.iku-shell a:hover,
.iku-shell button:hover {
  filter: brightness(1.08);
}
</style>
