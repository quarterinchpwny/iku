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
          <div class="flex items-center gap-1 rounded-lg border border-slate-300 bg-white p-1">
            <button
              @click="goToPage('dashboard')"
              :class="[
                'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                currentPage === 'dashboard'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              ]"
            >
              Dashboard
            </button>
            <button
              @click="goToPage('map')"
              :class="[
                'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                currentPage === 'map'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              ]"
            >
              Map
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

    <main v-else class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="iku-card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div
          class="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <h3 class="flex items-center gap-2 font-semibold text-slate-800">
            <MapPinned :size="18" class="text-indigo-600" />
            Ops Map
          </h3>
          <div class="flex items-center gap-2">
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
              @click="showRouteList = !showRouteList"
              class="inline-flex shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Route :size="14" />
              {{ showRouteList ? 'Hide Routes' : 'Show Routes' }}
            </button>
            <button
              @click="fetchTrackingSnapshot"
              class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 p-4 lg:grid-cols-12">
          <div class="lg:col-span-8">
            <div
              ref="mapContainer"
              class="h-[55vh] min-h-[380px] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
            />
            <div class="mt-3 text-xs text-slate-500">
              Last Sync Location:
              <span class="font-mono text-slate-700">
                {{
                  lastSyncedPoint
                    ? `${Number(lastSyncedPoint.lat).toFixed(6)}, ${Number(lastSyncedPoint.lng).toFixed(6)}`
                    : 'No synced point yet'
                }}
              </span>
            </div>
          </div>

          <div class="lg:col-span-4">
            <div class="rounded-lg border border-slate-200 p-3">
              <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Routes
              </div>
              <div
                v-if="showRouteList"
                class="max-h-[50vh] overflow-auto rounded-lg border border-slate-200"
              >
                <button
                  v-for="route in routeSummaries"
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
                      {{ new Date(route.timestamp).toLocaleString() }}
                    </span>
                  </span>
                  <span class="font-mono text-[10px]">{{ route.pointCount }} pts</span>
                </button>
                <div
                  v-if="routeSummaries.length === 0"
                  class="px-3 py-4 text-center text-xs text-slate-500"
                >
                  No routes available
                </div>
              </div>
              <div v-else class="text-xs text-slate-500">Toggle route list to browse traces.</div>
            </div>
          </div>
        </div>
      </div>
    </main>

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
  MapPinned,
  Route
} from 'lucide-vue-next';

// --- State ---

// UI State
const activeUploadTab = ref('ota'); // 'ota' | 'apk'
const activeHistoryTab = ref('history'); // 'history' | 'apk' | 'bundles'
const dragOver = ref(false);
const dragOverApk = ref(false);
const currentPage = ref(window.location.pathname === '/map' ? 'map' : 'dashboard');

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
const showRouteList = ref(false);
const selectedRouteId = ref(null);
const trackingRoutes = ref([]);
const trackingPoints = ref([]);
const passiveLocations = ref([]);

let mapLib = null;
let mapInstance = null;
let mapMarker = null;
let mapRouteLine = null;

// Selections
const selectedHistory = ref([]);
const selectedApks = ref([]);
const selectedBundles = ref([]);

watch(activeHistoryTab, () => {
  selectedHistory.value = [];
  selectedApks.value = [];
  selectedBundles.value = [];
});

function handlePopState() {
  currentPage.value = window.location.pathname === '/map' ? 'map' : 'dashboard';
}

function goToPage(page) {
  const path = page === 'map' ? '/map' : '/';
  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
  }
  currentPage.value = page;
}

const channelOptions = computed(() => {
  const keys = Object.keys(channels);
  return keys.length ? keys : ['stable', 'beta', 'dev'];
});

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
  const counts = new Map();
  for (const p of trackingPoints.value) {
    const key = Number(p.routeId);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...trackingRoutes.value]
    .map((r) => ({ ...r, id: Number(r.id), pointCount: counts.get(Number(r.id)) || 0 }))
    .filter((r) => r.pointCount > 0)
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
});

const selectedRoutePoints = computed(() => {
  if (!selectedRouteId.value) return [];
  return trackingPoints.value
    .filter((p) => Number(p.routeId) === Number(selectedRouteId.value))
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
});

watch([latestLocation, selectedRouteId], () => {
  renderMap();
});

watch(currentPage, async (page) => {
  if (page === 'map') {
    await fetchTrackingSnapshot();
    await nextTick();
    await renderMap();
    if (mapInstance) {
      setTimeout(() => mapInstance.invalidateSize(), 80);
    }
  }
});

// --- Auth Functions ---

async function handleLogin() {
  loggingIn.value = true;
  loginError.value = '';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value })
    });
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
  if (authToken.value) {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken.value}` }
    });
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
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${authToken.value}`
  };
  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    handleLogout();
    throw new Error('Session expired. Please log in again.');
  }
  return res;
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
    mapRouteLine = L.polyline(coords, {
      color: '#f97316',
      weight: 4,
      opacity: 0.85
    }).addTo(map);
    map.fitBounds(mapRouteLine.getBounds(), { padding: [20, 20] });
    return;
  }

  if (latestLocation.value) {
    map.setView([latestLocation.value.lat, latestLocation.value.lng], 15);
  }
}

async function fetchTrackingSnapshot() {
  try {
    const res = await authenticatedFetch('/api/location/fetchAll');
    if (!res.ok) throw new Error('Failed to load tracking snapshot');
    const data = await res.json();

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
  } catch (err) {
    console.error(err);
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
  window.addEventListener('popstate', handlePopState);
  await verifyToken();
  await nextTick();
  if (currentPage.value === 'map') {
    await renderMap();
  }
});

onUnmounted(() => {
  window.removeEventListener('popstate', handlePopState);
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
  background: radial-gradient(900px 300px at 12% 0%, rgba(249, 115, 22, 0.18), transparent 55%),
    radial-gradient(700px 320px at 88% 0%, rgba(14, 165, 233, 0.12), transparent 60%), var(--iku-bg);
  color: #e6eaf0;
}

.iku-grid-bg {
  background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
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
