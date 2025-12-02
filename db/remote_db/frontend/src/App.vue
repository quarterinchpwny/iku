<template>
  <!-- Login View -->
  <div v-if="!isAuthenticated" class="flex min-h-screen items-center justify-center bg-gray-50 p-6">
    <div class="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
      <h1 class="mb-4 text-center text-2xl font-bold">Admin Login</h1>
      <form @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label for="username" class="block text-sm font-medium">Username</label>
          <input
            v-model="username"
            id="username"
            type="text"
            required
            class="mt-1 block w-full rounded-md border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label for="password" class="block text-sm font-medium">Password</label>
          <input
            v-model="password"
            id="password"
            type="password"
            required
            class="mt-1 block w-full rounded-md border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <button
            :disabled="loggingIn"
            class="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {{ loggingIn ? 'Logging in...' : 'Login' }}
          </button>
        </div>
        <p v-if="loginError" class="text-center text-sm text-red-600">{{ loginError }}</p>
      </form>
    </div>
  </div>

  <!-- Main Dashboard View -->
  <div v-else class="min-h-screen bg-gray-50 p-6">
     <div class="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Left: Upload + Channels -->
      <div class="col-span-1 rounded-2xl bg-white p-6 shadow">
        <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-semibold">Upload OTA Build</h2>
            <button @click="handleLogout" class="rounded-lg border px-3 py-2 text-sm">Logout</button>
        </div>
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

        <hr class="my-6" />

        <!-- APK Upload -->
        <h2 class="mb-2 text-lg font-semibold">Upload APK Build</h2>
        <form @submit.prevent="handleApkUpload" class="space-y-4">
          <div>
            <label class="block text-sm font-medium">Version</label>
            <input
              v-model="apkVersionInput"
              placeholder="e.g. 1.0.3"
              class="mt-1 block w-full rounded-md border-gray-200 p-2"
            />
          </div>
          <div>
            <label class="block text-sm font-medium">APK file</label>
            <input ref="apkFileRef" type="file" accept=".apk" class="mt-1 block w-full" />
          </div>
          <div class="flex items-center space-x-2">
            <button
              :disabled="apkUploading"
              class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {{ apkUploading ? 'Uploading...' : 'Upload APK' }}
            </button>
            <button type="button" @click="clearApkUpload" class="rounded-lg border px-3 py-2">
              Clear
            </button>
          </div>
        </form>
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
                        @click="handleDeleteHistory(h.id, h.channel, h.version, h.filename)"
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

        <!-- APK History -->
        <div class="mt-6">
          <h3 class="mb-2 text-sm font-medium">APK History</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="text-left">
                  <th class="p-2">Version</th>
                  <th class="p-2">Filename</th>
                  <th class="p-2">Uploaded At</th>
                  <th class="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in apks" :key="h.id" class="border-t">
                  <td class="p-2">{{ h.version }}</td>
                  <td class="break-all p-2">{{ h.filename }}</td>
                  <td class="p-2">{{ new Date(h.uploaded_at).toLocaleString() }}</td>
                  <td class="p-2">
                    <div class="flex items-center space-x-2">
                      <a
                        class="text-sm underline"
                        :href="`/api/ota/bundle/${h.filename}`"
                        target="_blank"
                        >Download</a
                      >
                      <button
                        @click="handleDeleteApk(h.id, h.filename)"
                        class="rounded border px-2 py-1 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="apks.length === 0">
                  <td class="p-2 text-gray-500" colspan="4">No APKs</td>
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

// Auth state
const isAuthenticated = ref(false);
const authToken = ref(localStorage.getItem('authToken') || null);
const username = ref('');
const password = ref('');
const loggingIn = ref(false);
const loginError = ref('');


// Dashboard state
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
const fileRef = ref(null);
const apkFileRef = ref(null);
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
      body: JSON.stringify({ username: username.value, password: password.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    
    authToken.value = data.token;
    localStorage.setItem('authToken', data.token);
    isAuthenticated.value = true;
    fetchAll(); // Load data after successful login
  } catch (err) {
    loginError.value = err.message;
  } finally {
    loggingIn.value = false;
  }
}

async function handleLogout() {
    if (authToken.value) {
        // Invalidate token on the server
        await authenticatedFetch('/api/auth/logout', { method: 'POST' });
    }
  localStorage.removeItem('authToken');
  authToken.value = null;
  isAuthenticated.value = false;
  // Clear all data
  bundles.value = [];
  Object.keys(channels).forEach(key => delete channels[key]);
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
    // Token is invalid, clear it
    localStorage.removeItem('authToken');
    authToken.value = null;
    isAuthenticated.value = false;
  }
}

// --- API Helper ---

async function authenticatedFetch(url, options = {}) {
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${authToken.value}`,
  };
  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    // If we get a 401, our token is invalid, so log out
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

function clearUpload() {
  versionInput.value = '';
  if (fileRef.value) fileRef.value.value = null;
}

function clearApkUpload() {
  apkVersionInput.value = '';
  if (apkFileRef.value) apkFileRef.value.value = null;
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
    const res = await authenticatedFetch('/api/ota/upload', { method: 'POST', body: fd });
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
  const file = apkFileRef.value?.files?.[0];
  if (!file) return toast('Please select an APK file', 'error');
  if (!apkVersionInput.value) return toast('Please enter a version', 'error');

  const fd = new FormData();
  fd.append('file', file);
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
  if (!confirm(`Delete history ${channel}:${version}? This will also delete the bundle ${filename}.`)) return;
  try {
    const res = await authenticatedFetch('/api/ota/admin/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, filename })
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
    const res = await authenticatedFetch('/api/ota/admin/apk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, filename })
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