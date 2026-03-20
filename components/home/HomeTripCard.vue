<script setup lang="ts">
import HomeTripMap from '~/components/home/HomeTripMap.vue';

defineProps<{
  row: {
    id: string;
    timelineIndex: number;
    mode: string;
    rangeLabel: string;
    startPlace: string;
    endPlace: string;
    startStory: string;
    endStory: string;
    story: string;
    points: Array<{ lat: number; lng: number }>;
    pointCount: number;
    displacementMeters: number;
    durationLabel: string;
  };
  featured?: boolean;
}>();
</script>

<template>
  <article
    class="rounded-[28px] border p-4 transition outline outline-1 outline-white/5"
    :class="
      featured
        ? 'border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_36%),linear-gradient(180deg,rgba(10,14,22,0.98),rgba(7,10,16,0.96))] shadow-[0_20px_60px_rgba(0,0,0,0.36)]'
        : 'border-white/10 bg-[linear-gradient(180deg,rgba(10,14,22,0.98),rgba(8,10,16,0.94))]'
    "
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <span
            class="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.22em]"
            :class="
              featured
                ? 'bg-cyan-400/12 text-cyan-300'
                : 'bg-black/25 text-zinc-400'
            "
          >
            {{ row.mode }}
          </span>
          <span class="text-[10px] text-zinc-500">Trip {{ row.timelineIndex }}</span>
        </div>
        <div class="mt-3 text-xl font-black leading-tight text-white">
          {{ row.startPlace }} to {{ row.endPlace }}
        </div>
        <div class="mt-2 text-sm text-zinc-400">
          {{ row.story }}
        </div>
      </div>
      <div class="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div class="text-[9px] uppercase tracking-[0.22em] text-zinc-500">Window</div>
        <div class="mt-2 text-[11px] font-bold text-zinc-200">{{ row.rangeLabel }}</div>
      </div>
    </div>

    <div class="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <HomeTripMap :points="row.points" :featured="featured" />
      <div class="grid gap-3">
        <div class="rounded-[22px] border border-white/10 bg-black/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div class="text-[9px] uppercase tracking-[0.22em] text-emerald-500">Start</div>
          <div class="mt-2 text-sm font-bold text-white">{{ row.startPlace }}</div>
          <div class="mt-1 text-[11px] leading-relaxed text-zinc-500">{{ row.startStory }}</div>
        </div>
        <div class="rounded-[22px] border border-white/10 bg-black/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div class="text-[9px] uppercase tracking-[0.22em] text-amber-500">End</div>
          <div class="mt-2 text-sm font-bold text-white">{{ row.endPlace }}</div>
          <div class="mt-1 text-[11px] leading-relaxed text-zinc-500">{{ row.endStory }}</div>
        </div>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <span class="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-zinc-400">
        {{ row.pointCount }} points
      </span>
      <span class="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-zinc-400">
        {{ row.displacementMeters }}m
      </span>
      <span class="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-zinc-400">
        {{ row.durationLabel }}
      </span>
    </div>
  </article>
</template>
