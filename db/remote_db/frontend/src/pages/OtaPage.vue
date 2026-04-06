<template>
  <main class="mx-auto max-w-7xl px-4 py-8 text-white sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <div class="space-y-6 lg:col-span-4">
        <div
          class="iku-card overflow-hidden rounded-[1rem] border border-zinc-800 bg-zinc-950/90 shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
        >
          <div
            class="flex items-center justify-between border-b border-zinc-800 bg-[#090a0c]/90 px-5 py-4"
          >
            <h3 class="flex items-center gap-2 font-semibold text-white">
              <Radio :size="18" class="text-orange-400" />Active Channels
            </h3>
          </div>
          <div class="divide-y divide-zinc-800">
            <div
              v-for="(channel, name) in channels"
              :key="name"
              class="flex items-start justify-between p-5 transition-colors hover:bg-[#090a0c]/90"
            >
              <div>
                <div class="mb-1 flex items-center gap-2">
                  <span class="font-semibold capitalize text-zinc-100">{{ name }}</span>
                  <span
                    :class="[
                      'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                      name === 'stable'
                        ? 'border-orange-500/50 bg-orange-500/10 text-orange-300'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-300'
                    ]"
                  >
                    {{ name }}
                  </span>
                </div>
                <div class="flex items-center gap-2 text-sm text-zinc-400">
                  <Package :size="14" />v{{ channel.version }}
                </div>
                <div class="mt-1 text-xs text-zinc-500">
                  Updated {{ new Date(channel.updated).toLocaleDateString() }}
                </div>
              </div>
              <a
                :href="`/api/ota/bundle/${channel.key}`"
                target="_blank"
                class="rounded-md border border-zinc-700 bg-zinc-900 p-2 text-zinc-300 transition hover:border-orange-500 hover:text-white"
                title="Download Latest"
              >
                <Download :size="16" />
              </a>
            </div>
            <div
              v-if="Object.keys(channels).length === 0"
              class="p-8 text-center text-sm text-zinc-500"
            >
              No active channels found.
            </div>
          </div>
        </div>

        <div
          class="iku-card overflow-hidden rounded-[1rem] border border-zinc-800 bg-zinc-950/90 shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
        >
          <div class="border-b border-zinc-800">
            <div class="flex">
              <button
                @click="activeUploadTab = 'ota'"
                :class="[
                  'flex-1 border-b-2 py-4 text-center text-sm font-medium transition-colors',
                  activeUploadTab === 'ota'
                    ? 'border-orange-500 bg-zinc-950 text-orange-300'
                    : 'border-transparent bg-[#090a0c]/90 text-zinc-500 hover:text-zinc-200'
                ]"
              >
                Upload OTA
              </button>
              <button
                @click="activeUploadTab = 'apk'"
                :class="[
                  'flex-1 border-b-2 py-4 text-center text-sm font-medium transition-colors',
                  activeUploadTab === 'apk'
                    ? 'border-orange-500 bg-zinc-950 text-orange-300'
                    : 'border-transparent bg-[#090a0c]/90 text-zinc-500 hover:text-zinc-200'
                ]"
              >
                Upload APK
              </button>
            </div>
          </div>
          <div class="p-6">
            <form v-if="activeUploadTab === 'ota'" @submit.prevent="handleUpload" class="space-y-5">
              <div class="space-y-2">
                <label class="block text-sm font-medium text-zinc-300">Target Channel</label>
                <div class="relative">
                  <select
                    v-model="selectedChannel"
                    class="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 pl-3 pr-10 text-sm text-zinc-200 outline-none transition focus:border-orange-500"
                  >
                    <option v-for="channel in channelOptions" :key="channel" :value="channel">
                      {{ channel }}
                    </option>
                  </select>
                  <div
                    class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500"
                  >
                    <MoreVertical :size="16" />
                  </div>
                </div>
              </div>
              <div class="space-y-2">
                <label class="block text-sm font-medium text-zinc-300">Version</label>
                <input
                  v-model="versionInput"
                  placeholder="e.g. 1.0.3"
                  class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-200 outline-none transition focus:border-orange-500"
                />
              </div>
              <div class="space-y-2">
                <label class="block text-sm font-medium text-zinc-300">Update Package (ZIP)</label>
                <div
                  @dragover.prevent="dragOver = true"
                  @dragleave.prevent="dragOver = false"
                  @drop.prevent="handleDrop($event, 'ota')"
                  :class="[
                    'relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                    dragOver
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-zinc-700 bg-[#090a0c]/90 hover:border-orange-500/50'
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
                    <div
                      class="rounded-full border border-zinc-700 bg-zinc-900 p-2 text-orange-300"
                    >
                      <component :is="uploadFile ? CheckCircle : CloudUpload" :size="24" />
                    </div>
                    <p class="text-sm font-medium text-zinc-300">
                      {{ uploadFile ? uploadFile.name : 'Click to upload or drag ZIP' }}
                    </p>
                    <p v-if="uploadFile" class="text-xs text-zinc-500">
                      {{ (uploadFile.size / 1024 / 1024).toFixed(2) }} MB
                    </p>
                  </div>
                </div>
                <button
                  v-if="uploadFile"
                  type="button"
                  @click.stop="clearUpload"
                  class="pl-1 text-xs text-rose-400 hover:text-rose-300"
                >
                  Remove file
                </button>
              </div>
              <div class="flex gap-3 pt-2">
                <button
                  type="submit"
                  :disabled="uploading"
                  class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
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
                  class="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-orange-500 hover:text-white"
                >
                  Clear
                </button>
              </div>
            </form>

            <form
              v-if="activeUploadTab === 'apk'"
              @submit.prevent="handleApkUpload"
              class="space-y-5"
            >
              <div class="space-y-2">
                <label class="block text-sm font-medium text-zinc-300">Version</label>
                <input
                  v-model="apkVersionInput"
                  placeholder="e.g. 1.0.3"
                  class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-200 outline-none transition focus:border-orange-500"
                />
              </div>
              <div class="space-y-2">
                <label class="block text-sm font-medium text-zinc-300"
                  >Application Package (APK)</label
                >
                <div
                  @dragover.prevent="dragOverApk = true"
                  @dragleave.prevent="dragOverApk = false"
                  @drop.prevent="handleDrop($event, 'apk')"
                  :class="[
                    'relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                    dragOverApk
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-zinc-700 bg-[#090a0c]/90 hover:border-orange-500/50'
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
                    <div
                      class="rounded-full border border-zinc-700 bg-zinc-900 p-2 text-orange-300"
                    >
                      <component :is="apkFile ? CheckCircle : Smartphone" :size="24" />
                    </div>
                    <p class="text-sm font-medium text-zinc-300">
                      {{ apkFile ? apkFile.name : 'Click to upload or drag APK' }}
                    </p>
                    <p v-if="apkFile" class="text-xs text-zinc-500">
                      {{ (apkFile.size / 1024 / 1024).toFixed(2) }} MB
                    </p>
                  </div>
                </div>
                <button
                  v-if="apkFile"
                  type="button"
                  @click.stop="clearApkUpload"
                  class="pl-1 text-xs text-rose-400 hover:text-rose-300"
                >
                  Remove file
                </button>
              </div>
              <div class="flex gap-3 pt-2">
                <button
                  type="submit"
                  :disabled="apkUploading"
                  class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
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
                  class="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-orange-500 hover:text-white"
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
          class="iku-card flex h-full min-h-[600px] flex-col rounded-[1rem] border border-zinc-800 bg-zinc-950/90 shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
        >
          <div
            class="flex flex-col justify-between gap-4 border-b border-zinc-800 px-6 py-4 sm:flex-row sm:items-center"
          >
            <div class="flex space-x-1 self-start rounded-lg bg-[#090a0c]/90 p-1">
              <button
                @click="activeHistoryTab = 'history'"
                :class="[
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  activeHistoryTab === 'history'
                    ? 'bg-zinc-950 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                ]"
              >
                <Clock :size="14" />History
              </button>
              <button
                @click="activeHistoryTab = 'apk'"
                :class="[
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  activeHistoryTab === 'apk'
                    ? 'bg-zinc-950 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                ]"
              >
                <Smartphone :size="14" />APK History
              </button>
              <button
                @click="activeHistoryTab = 'bundles'"
                :class="[
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  activeHistoryTab === 'bundles'
                    ? 'bg-zinc-950 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                ]"
              >
                <Package :size="14" />Bundles
              </button>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="activeHistoryTab === 'history' && selectedHistory.length > 0"
                @click="handleDeleteSelectedHistory"
                class="inline-flex items-center gap-2 rounded-lg border border-rose-900 bg-rose-950/50 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-950/70"
              >
                <Trash2 :size="14" />Delete Selected ({{ selectedHistory.length }})
              </button>
              <button
                v-if="activeHistoryTab === 'apk' && selectedApks.length > 0"
                @click="handleDeleteSelectedApk"
                class="inline-flex items-center gap-2 rounded-lg border border-rose-900 bg-rose-950/50 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-950/70"
              >
                <Trash2 :size="14" />Delete Selected ({{ selectedApks.length }})
              </button>
              <button
                v-if="activeHistoryTab === 'bundles' && selectedBundles.length > 0"
                @click="handleDeleteSelectedBundles"
                class="inline-flex items-center gap-2 rounded-lg border border-rose-900 bg-rose-950/50 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-950/70"
              >
                <Trash2 :size="14" />Delete Selected ({{ selectedBundles.length }})
              </button>
              <button
                @click="fetchAll"
                class="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-orange-500 hover:text-white"
              >
                <RotateCcw :size="14" />Refresh
              </button>
            </div>
          </div>
          <div class="flex-1 overflow-x-auto p-2">
            <table class="w-full border-collapse text-left">
              <thead>
                <tr class="border-b border-zinc-800">
                  <template v-if="activeHistoryTab === 'history'">
                    <th class="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        :checked="history.length > 0 && selectedHistory.length === history.length"
                        @change="
                          selectedHistory = $event.target.checked ? history.map((entry) => entry.id) : []
                        "
                        class="rounded border-zinc-700 bg-zinc-900 text-orange-500"
                      />
                    </th>
                    <th
                      class="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500"
                    >
                      Channel
                    </th>
                    <th
                      class="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500"
                    >
                      Version
                    </th>
                    <th
                      class="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500"
                    >
                      Filename
                    </th>
                    <th
                      class="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500"
                    >
                      Uploaded
                    </th>
                    <th
                      class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500"
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
                          selectedApks = $event.target.checked ? apks.map((entry) => entry.id) : []
                        "
                        class="rounded border-zinc-700 bg-zinc-900 text-orange-500"
                      />
                    </th>
                    <th
                      class="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500"
                    >
                      Version
                    </th>
                    <th
                      class="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500"
                    >
                      Filename
                    </th>
                    <th
                      class="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500"
                    >
                      Uploaded
                    </th>
                    <th
                      class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500"
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
                          selectedBundles = $event.target.checked ? bundles.map((entry) => entry.name) : []
                        "
                        class="rounded border-zinc-700 bg-zinc-900 text-orange-500"
                      />
                    </th>
                    <th
                      class="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500"
                    >
                      Key / Name
                    </th>
                    <th
                      class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500"
                    >
                      Actions
                    </th>
                  </template>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-800">
                <template v-if="activeHistoryTab === 'history'">
                  <tr
                    v-for="entry in history"
                    :key="`${entry.channel}-${entry.version}`"
                    class="group transition-colors hover:bg-[#090a0c]/90"
                  >
                    <td class="px-4 py-3">
                      <input
                        type="checkbox"
                        v-model="selectedHistory"
                        :value="entry.id"
                        class="rounded border-zinc-700 bg-zinc-900 text-orange-500"
                      />
                    </td>
                    <td class="px-4 py-3 text-sm font-medium capitalize text-zinc-200">
                      <span
                        :class="[
                          'rounded-full border px-2 py-0.5 text-xs',
                          entry.channel === 'stable'
                            ? 'border-orange-500/50 bg-orange-500/10 text-orange-300'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-300'
                        ]"
                      >
                        {{ entry.channel }}
                      </span>
                    </td>
                    <td class="px-4 py-3 font-mono text-sm text-zinc-300">{{ entry.version }}</td>
                    <td
                      class="max-w-[150px] truncate px-4 py-3 text-sm text-zinc-500"
                      :title="entry.filename"
                    >
                      {{ entry.filename }}
                    </td>
                    <td class="px-4 py-3 text-sm text-zinc-500">
                      {{ new Date(entry.uploaded_at).toLocaleString() }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 text-right">
                      <div
                        class="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100"
                      >
                        <button
                          @click="handleRollback(entry.channel, entry.version)"
                          title="Rollback"
                          class="rounded-md border border-zinc-800 bg-zinc-900 p-2 text-zinc-500 transition hover:border-orange-500/40 hover:text-orange-300"
                        >
                          <RotateCcw :size="16" />
                        </button>
                        <a
                          :href="`/api/ota/bundle/${entry.filename}`"
                          target="_blank"
                          title="Download"
                          class="rounded-md border border-zinc-800 bg-zinc-900 p-2 text-zinc-500 transition hover:border-orange-500/40 hover:text-zinc-100"
                        >
                          <Download :size="16" />
                        </a>
                        <button
                          @click="
                            handleDeleteHistory(
                              entry.id,
                              entry.channel,
                              entry.version,
                              entry.filename
                            )
                          "
                          title="Delete"
                          class="rounded-md border border-zinc-800 bg-zinc-900 p-2 text-zinc-500 transition hover:border-rose-700 hover:text-rose-300"
                        >
                          <Trash2 :size="16" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="history.length === 0">
                    <td colspan="6" class="px-4 py-12 text-center text-zinc-500">
                      No OTA history available
                    </td>
                  </tr>
                </template>
                <template v-if="activeHistoryTab === 'apk'">
                  <tr
                    v-for="entry in apks"
                    :key="entry.id"
                    class="group transition-colors hover:bg-[#090a0c]/90"
                  >
                    <td class="px-4 py-3">
                      <input
                        type="checkbox"
                        v-model="selectedApks"
                        :value="entry.id"
                        class="rounded border-zinc-700 bg-zinc-900 text-orange-500"
                      />
                    </td>
                    <td class="px-4 py-3 font-mono text-sm text-zinc-200">{{ entry.version }}</td>
                    <td
                      class="max-w-[200px] truncate px-4 py-3 text-sm text-zinc-400"
                      :title="entry.filename"
                    >
                      {{ entry.filename }}
                    </td>
                    <td class="px-4 py-3 text-sm text-zinc-500">
                      {{ new Date(entry.uploaded_at).toLocaleString() }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 text-right">
                      <div
                        class="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100"
                      >
                        <a
                          :href="`/api/ota/bundle/${entry.filename}`"
                          target="_blank"
                          title="Download"
                          class="rounded-md border border-zinc-800 bg-zinc-900 p-2 text-zinc-500 transition hover:border-orange-500/40 hover:text-zinc-100"
                        >
                          <Download :size="16" />
                        </a>
                        <button
                          @click="handleDeleteApk(entry.id, entry.filename)"
                          title="Delete"
                          class="rounded-md border border-zinc-800 bg-zinc-900 p-2 text-zinc-500 transition hover:border-rose-700 hover:text-rose-300"
                        >
                          <Trash2 :size="16" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="apks.length === 0">
                    <td colspan="5" class="px-4 py-12 text-center text-zinc-500">
                      No APKs uploaded
                    </td>
                  </tr>
                </template>
                <template v-if="activeHistoryTab === 'bundles'">
                  <tr
                    v-for="entry in bundles"
                    :key="entry.name"
                    class="group transition-colors hover:bg-[#090a0c]/90"
                  >
                    <td class="px-4 py-3">
                      <input
                        type="checkbox"
                        v-model="selectedBundles"
                        :value="entry.name"
                        class="rounded border-zinc-700 bg-zinc-900 text-orange-500"
                      />
                    </td>
                    <td
                      class="flex items-center gap-2 px-4 py-3 text-sm font-medium text-zinc-200"
                    >
                      <Package :size="16" class="text-zinc-500" />{{ entry.name }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 text-right">
                      <div
                        class="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100"
                      >
                        <a
                          :href="`/api/ota/bundle/${entry.name}`"
                          target="_blank"
                          title="Download"
                          class="rounded-md border border-zinc-800 bg-zinc-900 p-2 text-zinc-500 transition hover:border-orange-500/40 hover:text-zinc-100"
                        >
                          <Download :size="16" />
                        </a>
                        <button
                          @click="handleDeleteBundle(entry.name)"
                          title="Delete"
                          class="rounded-md border border-zinc-800 bg-zinc-900 p-2 text-zinc-500 transition hover:border-rose-700 hover:text-rose-300"
                        >
                          <Trash2 :size="16" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="bundles.length === 0">
                    <td colspan="3" class="px-4 py-12 text-center text-zinc-500">
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
  MoreVertical,
  Package,
  Radio,
  RotateCcw,
  Smartphone,
  Trash2
} from 'lucide-vue-next';
import { useAdminAppContext } from '../composables/useAdminAppContext';

const app = useAdminAppContext();
const {
  activeHistoryTab,
  activeUploadTab,
  apkFile,
  apkUploading,
  apkVersionInput,
  apks,
  bundles,
  channelOptions,
  channels,
  clearApkUpload,
  clearUpload,
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
  selectedApks,
  selectedBundles,
  selectedChannel,
  selectedHistory,
  uploadFile,
  uploading,
  versionInput
} = app.ota;
</script>
