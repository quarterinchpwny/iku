<template>
  <!-- Login View -->
  <div
    v-if="!isAuthenticated"
    class="flex min-h-screen items-center justify-center bg-slate-50 p-6 font-sans text-slate-800"
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
  <div v-else class="min-h-screen bg-slate-50 pb-12 font-sans text-slate-800">
    <!-- Header -->
    <header class="sticky top-0 z-30 border-b border-slate-200 bg-white">
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

    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <!-- LEFT COLUMN -->
        <div class="space-y-6 lg:col-span-4">
          <!-- Active Channels Widget -->
          <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
          <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
            class="flex h-full min-h-[600px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm"
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
              <button
                @click="fetchAll"
                class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <RotateCcw :size="14" />
                Refresh
              </button>
            </div>

            <!-- Content Area -->
            <div class="flex-1 overflow-x-auto p-2">
              <table class="w-full border-collapse text-left">
                <thead>
                  <tr class="border-b border-slate-200">
                    <template v-if="activeHistoryTab === 'history'">
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
                      <td colspan="5" class="px-4 py-12 text-center text-slate-400">
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
                      <td colspan="4" class="px-4 py-12 text-center text-slate-400">
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
                      <td colspan="2" class="px-4 py-12 text-center text-slate-400">
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
import { ref, reactive, onMounted, computed } from 'vue';
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
  Loader2
} from 'lucide-vue-next';

// --- State ---

// UI State
const activeUploadTab = ref('ota'); // 'ota' | 'apk'
const activeHistoryTab = ref('history'); // 'history' | 'apk' | 'bundles'
const dragOver = ref(false);
const dragOverApk = ref(false);

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

const channelOptions = computed(() => {
  const keys = Object.keys(channels);
  return keys.length ? keys : ['stable', 'beta', 'dev'];
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

onMounted(verifyToken);
</script>
