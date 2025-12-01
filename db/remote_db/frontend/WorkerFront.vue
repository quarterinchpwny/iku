<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <div class="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Left: Upload + Channels -->
      <div class="col-span-1 rounded-2xl bg-white p-6 shadow">
        <h2 class="mb-2 text-lg font-semibold">Upload OTA Build</h2>
        <form @submit.prevent="handleUpload" class="space-y-4">
          <div>
            <label class="block text-sm font-medium">Channel</label>
            <select
              v-model="selectedChannel"
              class="mt-1 block w-full rounded-md border-gray-200 p-2"
            >
              <option v-for="c in channelOptions" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium">Version</label>
            <input
              v-model="versionInput"
              placeholder="e.g. 1.0.3 or 1700000000"
              class="mt-1 block w-full rounded-md border-gray-200 p-2"
            />
          </div>
          <div>
            <label class="block text-sm font-medium">Zip file</label>
            <input ref="fileRef" type="file" accept=".zip" class="mt-1 block w-full" />
          </div>
          <div class="flex items-center space-x-2">
            <button
              :disabled="uploading"
              class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {{ uploading ? 'Uploading...' : 'Upload' }}
            </button>
            <button type="button" @click="clearUpload" class="rounded-lg border px-3 py-2">
              Clear
            </button>
          </div>
        </form>
        <div class="mt-6">
          <h3 class="mb-2 text-sm font-medium">Channels (active)</h3>
          <div class="space-y-2">
            <div
              v-for="(m, name) in channels"
              :key="name"
              class="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <div class="text-sm font-semibold">{{ name }}</div>
                <div class="text-xs text-gray-500">
                  v{{ m.version }} • {{ new Date(m.updated).toLocaleString() }}
                </div>
              </div>
              <div>
                <a class="text-sm underline" :href="`/api/ota/bundle/${m.key}`" target="_blank"
                  >Download</a
                >
              </div>
            </div>
            <div v-if="Object.keys(channels).length === 0" class="text-sm text-gray-500">
              No channels yet
            </div>
          </div>
        </div>
      </div>

      <!-- Right-top: Bundles list -->
      <div class="col-span-2 rounded-2xl bg-white p-6 shadow">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold">Bundles & History</h2>
          <div class="flex items-center space-x-2">
            <button @click="fetchAll" class="rounded-lg border px-3 py-2">Refresh</button>
          </div>
        </div>

        <!-- Bundles Table -->
        <div class="mb-6">
          <h3 class="mb-2 text-sm font-medium">Bundles</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="text-left">
                  <th class="p-2">Key / Name</th>
                  <th class="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="b in bundles" :key="b.name" class="border-t">
                  <td class="p-2">{{ b.name }}</td>
                  <td class="p-2">
                    <div class="flex items-center space-x-2">
                      <a
                        class="text-sm underline"
                        :href="`/api/ota/bundle/${b.name}`"
                        target="_blank"
                        >Download</a
                      >
                      <button
                        @click="handleDeleteBundle(b.name)"
                        class="rounded border px-2 py-1 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="bundles.length === 0">
                  <td class="p-2 text-gray-500" colspan="2">No bundles</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- History Table -->
        <div>
          <h3 class="mb-2 text-sm font-medium">History</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="text-left">
                  <th class="p-2">Channel</th>
                  <th class="p-2">Version</th>
                  <th class="p-2">Filename</th>
                  <th class="p-2">Uploaded At</th>
                  <th class="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in history" :key="`${h.channel}-${h.version}`" class="border-t">
                  <td class="p-2">{{ h.channel }}</td>
                  <td class="p-2">{{ h.version }}</td>
                  <td class="break-all p-2">{{ h.filename }}</td>
                  <td class="p-2">{{ new Date(h.uploaded_at).toLocaleString() }}</td>
                  <td class="p-2">
                    <div class="flex items-center space-x-2">
                      <button
                        @click="handleRollback(h.channel, h.version)"
                        class="rounded bg-yellow-500 px-2 py-1 text-sm text-white"
                      >
                        Rollback
                      </button>
                      <a
                        class="text-sm underline"
                        :href="`/api/ota/bundle/${h.filename}`"
                        target="_blank"
                        >Download</a
                      >
                      <button
                        @click="handleDeleteHistory(h.id, h.channel, h.version)"
                        class="rounded border px-2 py-1 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="history.length === 0">
                  <td class="p-2 text-gray-500" colspan="5">No history</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div
      v-if="message"
      :class="`fixed bottom-6 right-6 rounded-lg p-4 shadow-lg ${message.type === 'error' ? 'bg-red-600 text-white' : message.type === 'success' ? 'bg-green-600 text-white' : 'bg-gray-800 text-white'}`"
    >
      {{ message.text }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';

const bundles = ref([]);
const channels = reactive({});
const history = ref([]);
const loading = ref(false);
const uploading = ref(false);
const selectedChannel = ref('stable');
const versionInput = ref('');
const fileRef = ref(null);
const message = ref(null);

const channelOptions = computed(() => {
  const keys = Object.keys(channels);
  return keys.length ? keys : ['stable', 'beta', 'dev'];
});

function toast(text, type = 'info') {
  message.value = { text, type };
  setTimeout(() => (message.value = null), 4000);
}

async function fetchAll() {
  loading.value = true;
  try {
    const [bundlesRes, channelsRes, historyRes] = await Promise.all([
      fetch('/api/ota/admin/bundles')
        .then((r) => r.json())
        .catch(() => ({ bundles: [] })),
      fetch('/api/ota/admin/channels')
        .then((r) => r.json())
        .catch(() => ({ channels: {} })),
      fetch('/api/ota/admin/history')
        .then((r) => r.json())
        .catch(() => ({ history: [] }))
    ]);

    bundles.value = bundlesRes.bundles || bundlesRes.objects || [];
    Object.assign(channels, channelsRes.channels || {});
    history.value = historyRes.history || [];
  } catch (err) {
    console.error(err);
    toast('Failed to load data', 'error');
  } finally {
    loading.value = false;
  }
}

function clearUpload() {
  versionInput.value = '';
  if (fileRef.value) fileRef.value.value = null;
}

async function handleUpload() {
  const file = fileRef.value?.files?.[0];
  if (!file) return toast('Please select a file', 'error');
  if (!versionInput.value) return toast('Please enter a version', 'error');

  const fd = new FormData();
  fd.append('file', file);
  fd.append('version', versionInput.value);
  fd.append('channel', selectedChannel.value);

  uploading.value = true;
  try {
    const res = await fetch('/api/ota/upload', { method: 'POST', body: fd });
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

async function handleDeleteBundle(key) {
  if (!confirm(`Delete bundle ${key}? This will remove the ZIP from storage.`)) return;
  try {
    const res = await fetch('/api/ota/admin/bundle', {
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
    const res = await fetch(`/api/ota/admin/manifest/${channel}`, {
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

async function handleDeleteHistory(id, channel, version) {
  if (!confirm(`Delete history ${channel}:${version}?`)) return;
  try {
    const res = await fetch('/api/ota/admin/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, version })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Delete history failed');
    toast('History deleted', 'success');
    await fetchAll();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Delete history error', 'error');
  }
}

onMounted(fetchAll);
</script>
