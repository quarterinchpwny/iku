<script setup lang="ts">
import { reactive, watch } from 'vue';

const props = defineProps<{
  places: Array<{
    key: string;
    labelName: string;
    visitCount: number;
    autoLabel: string;
    canRename: boolean;
    lastSeenMs: number;
  }>;
  savingKey: string;
}>();

const emit = defineEmits<{
  rename: [placeKey: string, name: string];
}>();

const drafts = reactive<Record<string, string>>({});

watch(
  () => props.places,
  (places) => {
    for (const place of places) {
      if (!(place.key in drafts)) drafts[place.key] = place.labelName;
    }
  },
  { immediate: true }
);

function submit(placeKey: string) {
  emit('rename', placeKey, String(drafts[placeKey] || '').trim());
}

function lastSeenLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
</script>

<template>
  <section class="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,22,0.98),rgba(7,10,16,0.94))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] outline outline-1 outline-white/5">
    <div class="flex items-end justify-between gap-3">
      <div>
        <div class="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">Visited Places</div>
        <div class="mt-2 text-2xl font-black leading-tight text-white">Most visited stops</div>
      </div>
      <div class="text-sm text-zinc-400">{{ places.length }} places</div>
    </div>

    <div class="mt-5 grid gap-3 md:grid-cols-2">
      <article
        v-for="place in places"
        :key="place.key"
        class="rounded-[22px] border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm font-bold text-white">{{ place.labelName }}</div>
            <div class="mt-1 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              {{ place.visitCount }} visits • {{ place.autoLabel }}
            </div>
          </div>
          <div class="text-[11px] text-zinc-500">Seen {{ lastSeenLabel(place.lastSeenMs) }}</div>
        </div>

        <div v-if="place.canRename" class="mt-4 flex gap-2">
          <input
            v-model.trim="drafts[place.key]"
            type="text"
            maxlength="128"
            class="flex-1 rounded-2xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/40"
          />
          <button
            class="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100 transition disabled:opacity-50"
            :disabled="savingKey === place.key || !drafts[place.key]"
            @click="submit(place.key)"
          >
            {{ savingKey === place.key ? 'Saving...' : 'Rename' }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
