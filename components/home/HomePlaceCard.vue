<script setup lang="ts">
defineProps<{
  row: {
    key: string;
    title: string;
    rangeLabel: string;
    durationLabel: string;
    visitLabel: string;
    autoLabel: string;
    coordinateLabel: string;
    source: string;
  };
  featured?: boolean;
}>();
</script>

<template>
  <article
    class="rounded-[28px] border p-4 transition outline outline-1 outline-white/5"
    :class="
      featured
        ? 'border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_38%),linear-gradient(180deg,rgba(10,14,22,0.98),rgba(7,10,16,0.96))] shadow-[0_20px_60px_rgba(0,0,0,0.36)]'
        : 'border-white/10 bg-[linear-gradient(180deg,rgba(10,14,22,0.98),rgba(8,10,16,0.94))]'
    "
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <span
            class="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.22em]"
            :class="featured ? 'bg-emerald-400/12 text-emerald-300' : 'bg-black/25 text-zinc-400'"
          >
            Place
          </span>
          <span class="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{{ row.source }}</span>
        </div>
        <div class="mt-3 text-xl font-black leading-tight text-white">
          {{ row.title }}
        </div>
        <div class="mt-2 text-sm text-zinc-400">
          Stayed for {{ row.durationLabel }} at this location.
        </div>
      </div>
      <div class="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div class="text-[9px] uppercase tracking-[0.22em] text-zinc-500">Window</div>
        <div class="mt-2 text-[11px] font-bold text-zinc-200">{{ row.rangeLabel }}</div>
      </div>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-3">
      <div class="rounded-[22px] border border-white/10 bg-black/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div class="text-[9px] uppercase tracking-[0.22em] text-zinc-500">Visits</div>
        <div class="mt-2 text-sm font-bold text-white">{{ row.visitLabel }}</div>
      </div>
      <div class="rounded-[22px] border border-white/10 bg-black/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div class="text-[9px] uppercase tracking-[0.22em] text-zinc-500">Label</div>
        <div class="mt-2 text-sm font-bold text-white">{{ row.autoLabel }}</div>
      </div>
      <div class="rounded-[22px] border border-white/10 bg-black/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div class="text-[9px] uppercase tracking-[0.22em] text-zinc-500">Coords</div>
        <div class="mt-2 text-sm font-bold text-white">{{ row.coordinateLabel }}</div>
      </div>
    </div>
  </article>
</template>
