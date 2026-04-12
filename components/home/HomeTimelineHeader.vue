<script setup lang="ts">
const props = defineProps<{
  dayLabel: string;
  summary: string;
  placeCount: number;
  tripCount: number;
  segmentCount: number;
  movementSpanLabel: string;
  durationLabel: string;
  syncLabel: string;
  days: Array<{
    dayKey: string;
    label: string;
    segmentCount: number;
    placeCount: number;
    tripCount: number;
  }>;
  activeDayKey: string;
}>();

const emit = defineEmits<{
  select: [dayKey: string];
}>();
</script>

<template>
  <section class="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,22,0.98),rgba(7,10,16,0.94))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] outline outline-1 outline-white/5">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div class="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
          Shield Timeline
        </div>
        <div class="mt-2 text-2xl font-black leading-tight text-white">
          {{ dayLabel }}
        </div>
        <div class="mt-2 max-w-2xl text-sm text-zinc-400">
          {{ summary }}
        </div>
        <div class="mt-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          {{ segmentCount }} timeline segments
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div class="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div class="text-[9px] uppercase tracking-[0.24em] text-zinc-500">Places</div>
          <div class="mt-2 text-lg font-black text-white">{{ placeCount }}</div>
        </div>
        <div class="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div class="text-[9px] uppercase tracking-[0.24em] text-zinc-500">Trips</div>
          <div class="mt-2 text-lg font-black text-white">{{ tripCount }}</div>
        </div>
        <div class="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div class="text-[9px] uppercase tracking-[0.24em] text-zinc-500">Movement Span</div>
          <div class="mt-2 text-lg font-black text-white">{{ movementSpanLabel }}</div>
        </div>
        <div class="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div class="text-[9px] uppercase tracking-[0.24em] text-zinc-500">Sync</div>
          <div class="mt-2 text-sm font-black text-white">{{ syncLabel }}</div>
        </div>
      </div>
    </div>

    <div class="scrollbar-hide mt-5 flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="day in props.days"
        :key="day.dayKey"
        class="min-w-[132px] rounded-[22px] border px-4 py-3 text-left transition"
        :class="
          activeDayKey === day.dayKey
            ? 'border-cyan-400/30 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.25),transparent_42%),linear-gradient(180deg,rgba(15,40,56,0.96),rgba(9,18,28,0.96))] text-white shadow-[0_14px_32px_rgba(8,145,178,0.18)]'
            : 'border-white/10 bg-black/20 text-zinc-300'
        "
        @click="emit('select', day.dayKey)"
      >
        <div class="text-[10px] font-bold uppercase tracking-[0.2em]">
          {{ day.label }}
        </div>
        <div class="mt-2 text-sm font-black">{{ day.segmentCount }} segments</div>
        <div class="mt-1 text-[11px]" :class="activeDayKey === day.dayKey ? 'text-cyan-100' : 'text-zinc-500'">
          {{ day.placeCount }} places • {{ day.tripCount }} trips
        </div>
      </button>
    </div>
  </section>
</template>
