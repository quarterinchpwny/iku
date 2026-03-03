<template>
  <section class="geofence-manager">
    <header class="geofence-header">
      <h2>Geofences</h2>
      <button class="geo-btn ghost" @click="prefillFromCurrentLocation">Use Current Location</button>
    </header>

    <form class="geofence-form" @submit.prevent="submitGeofence">
      <label>
        <span>Name</span>
        <input v-model.trim="form.name" required maxlength="80" placeholder="Home Zone" />
      </label>

      <div class="coord-grid">
        <label>
          <span>Latitude</span>
          <input v-model.number="form.lat" type="number" step="0.000001" required />
        </label>
        <label>
          <span>Longitude</span>
          <input v-model.number="form.lng" type="number" step="0.000001" required />
        </label>
      </div>

      <label>
        <span>Radius (m)</span>
        <div class="radius-controls">
          <input v-model.number="form.radius" type="range" min="25" max="5000" step="5" />
          <input v-model.number="form.radius" type="number" min="25" max="5000" step="5" required />
        </div>
      </label>

      <label class="enabled-toggle">
        <input v-model="form.enabled" type="checkbox" />
        <span>Enabled</span>
      </label>

      <div class="form-actions">
        <button class="geo-btn" type="submit">{{ editingId ? 'Save Geofence' : 'Add Geofence' }}</button>
        <button v-if="editingId" class="geo-btn danger" type="button" @click="cancelEdit">Cancel</button>
      </div>
    </form>

    <ul class="geofence-list">
      <li v-for="item in geofences" :key="item.id" class="geofence-item">
        <div class="meta">
          <h3>{{ item.name }}</h3>
          <p>{{ item.lat.toFixed(6) }}, {{ item.lng.toFixed(6) }}</p>
          <p>{{ Math.round(item.radius) }}m · {{ item.enabled ? 'Enabled' : 'Disabled' }}</p>
        </div>
        <div class="actions">
          <button class="geo-btn ghost" @click="startEdit(item.id)">Edit</button>
          <button class="geo-btn danger" @click="deleteGeofence(item.id)">Remove</button>
        </div>
      </li>
      <li v-if="!geofences.length" class="empty">No geofences yet.</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useGeolocationStore } from '~/stores/geolocation';

const geoStore = useGeolocationStore();
const geofences = computed(() => geoStore.geofences || []);
const editingId = ref<number | null>(null);
const form = reactive({
  name: '',
  lat: 14.5764,
  lng: 121.0851,
  radius: 100,
  enabled: true
});

function clampRadius(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.max(25, Math.min(5000, Math.round(value)));
}

function resetForm() {
  editingId.value = null;
  form.name = '';
  form.radius = 100;
  form.enabled = true;
}

function prefillFromCurrentLocation() {
  const point = geoStore.currentPosition;
  if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
    form.lat = Number(point.lat);
    form.lng = Number(point.lng);
    return;
  }
  const fallback = geoStore.homeLocation;
  form.lat = Number(fallback.lat);
  form.lng = Number(fallback.lng);
}

function startEdit(id: number) {
  const target = geofences.value.find((entry: any) => Number(entry.id) === Number(id));
  if (!target) return;
  editingId.value = Number(target.id);
  form.name = String(target.name || '');
  form.lat = Number(target.lat);
  form.lng = Number(target.lng);
  form.radius = clampRadius(Number(target.radius));
  form.enabled = !!target.enabled;
}

function cancelEdit() {
  resetForm();
}

async function submitGeofence() {
  const payload = {
    name: String(form.name || '').trim(),
    lat: Number(form.lat),
    lng: Number(form.lng),
    radius: clampRadius(Number(form.radius)),
    enabled: !!form.enabled
  };
  if (!payload.name) return;
  if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lng)) return;

  if (editingId.value) {
    await geoStore.updateGeofence(editingId.value, payload);
  } else {
    await geoStore.createGeofence(payload);
  }
  resetForm();
}

async function deleteGeofence(id: number) {
  await geoStore.removeGeofence(Number(id));
  if (editingId.value === Number(id)) resetForm();
}

onMounted(async () => {
  await geoStore.loadGeofences();
  prefillFromCurrentLocation();
});
</script>

<style scoped>
.geofence-manager {
  margin: 0 auto;
  max-width: 880px;
  padding: 1.2rem;
  color: #f8fafc;
}
.geofence-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.geofence-header h2 {
  font-size: 1.2rem;
  letter-spacing: 0.04em;
  margin: 0;
}
.geofence-form {
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 12px;
  display: grid;
  gap: 0.9rem;
  margin-bottom: 1.2rem;
  padding: 1rem;
}
.geofence-form label {
  display: grid;
  gap: 0.35rem;
}
.geofence-form span {
  color: rgba(226, 232, 240, 0.88);
  font-size: 0.82rem;
}
.geofence-form input[type='number'],
.geofence-form input[type='text'],
.geofence-form input:not([type]) {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 8px;
  color: #f8fafc;
  padding: 0.58rem 0.7rem;
}
.coord-grid {
  display: grid;
  gap: 0.8rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.radius-controls {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: 1fr 130px;
}
.enabled-toggle {
  align-items: center;
  display: inline-flex;
  gap: 0.45rem;
}
.form-actions {
  display: flex;
  gap: 0.6rem;
}
.geofence-list {
  display: grid;
  gap: 0.75rem;
  list-style: none;
  margin: 0;
  padding: 0;
}
.geofence-item {
  align-items: center;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 10px;
  display: flex;
  justify-content: space-between;
  padding: 0.9rem;
}
.meta h3 {
  font-size: 0.97rem;
  margin: 0 0 0.2rem;
}
.meta p {
  color: rgba(226, 232, 240, 0.7);
  font-size: 0.8rem;
  margin: 0.12rem 0;
}
.actions {
  display: flex;
  gap: 0.5rem;
}
.geo-btn {
  background: #0ea5e9;
  border: 0;
  border-radius: 8px;
  color: #082f49;
  cursor: pointer;
  font-weight: 600;
  padding: 0.5rem 0.72rem;
}
.geo-btn.ghost {
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.35);
  color: #e2e8f0;
}
.geo-btn.danger {
  background: #ef4444;
  color: #fef2f2;
}
.empty {
  color: rgba(226, 232, 240, 0.6);
  padding: 0.8rem 0;
}
@media (max-width: 720px) {
  .coord-grid {
    grid-template-columns: 1fr;
  }
  .radius-controls {
    grid-template-columns: 1fr;
  }
  .geofence-item {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.6rem;
  }
}
</style>
