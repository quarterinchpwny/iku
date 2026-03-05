<template>
  <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div class="text-sm font-semibold tracking-wide text-slate-800">API Access Logs</div>
        <div class="flex flex-wrap items-center gap-2">
          <select
            :value="sourceFilter"
            @change="emit('update:sourceFilter', $event.target.value)"
            class="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
          >
            <option value="ALL">All Sources</option>
            <option value="HTTP">HTTP</option>
            <option value="PLUGIN">Plugin</option>
          </select>
          <select
            :value="methodFilter"
            @change="emit('update:methodFilter', $event.target.value)"
            class="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
          >
            <option value="">All Methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
            <option value="PLUGIN">PLUGIN</option>
          </select>
          <input
            :value="statusFilter"
            @input="emit('update:statusFilter', $event.target.value)"
            type="number"
            placeholder="Status"
            class="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
          />
          <input
            :value="pathFilter"
            @input="emit('update:pathFilter', $event.target.value)"
            type="text"
            placeholder="Path contains"
            class="w-44 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
          />
          <button
            @click="emit('apply')"
            class="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Apply
          </button>
        </div>
      </div>
      <div class="max-h-[72vh] overflow-auto rounded-lg border border-slate-200">
        <div
          v-for="log in logs"
          :key="log.id"
          class="border-b border-slate-100 px-3 py-2 text-xs last:border-b-0"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-[10px] text-slate-700">
              {{ log.source }} {{ log.method }} {{ log.path }}{{ log.query || '' }}
            </span>
            <span class="font-mono text-[10px]" :class="apiLogClass(log.status)">
              {{ log.status }} · {{ Number(log.duration_ms || 0) }}ms
            </span>
          </div>
          <div class="mt-1 text-[10px] text-slate-500">
            {{ formatApiLogTime(log.timestamp) }} · ip {{ log.ip || '-' }} · auth {{ log.auth_subject || '-' }}
          </div>
          <div
            v-if="log.error"
            class="mt-1 font-mono text-[10px]"
            :class="Number(log.status) >= 400 ? 'text-rose-600' : 'text-slate-500'"
          >
            {{ log.error }}
          </div>
        </div>
        <div v-if="logs.length === 0" class="px-3 py-4 text-center text-xs text-slate-500">
          No API access logs yet.
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
defineProps({
  logs: { type: Array, required: true },
  sourceFilter: { type: String, required: true },
  methodFilter: { type: String, required: true },
  statusFilter: { type: String, required: true },
  pathFilter: { type: String, required: true },
});

const emit = defineEmits([
  'apply',
  'update:sourceFilter',
  'update:methodFilter',
  'update:statusFilter',
  'update:pathFilter',
]);

function apiLogClass(status) {
  if (!Number.isFinite(Number(status))) return 'text-slate-500';
  if (Number(status) >= 500) return 'text-rose-600';
  if (Number(status) >= 400) return 'text-amber-600';
  return 'text-emerald-600';
}

function formatApiLogTime(ts) {
  return new Date(Number(ts || 0)).toLocaleTimeString();
}
</script>
