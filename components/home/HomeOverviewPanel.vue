<script setup lang="ts">
defineProps<{
  heading: string;
  summary: string;
  stats: Array<{
    label: string;
    value: string;
    detail?: string;
  }>;
}>();
</script>

<template>
  <section class="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,22,0.98),rgba(7,9,14,0.96))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.3)] outline outline-1 outline-white/5">
    <div class="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div class="rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_34%),radial-gradient(circle_at_92%_18%,rgba(249,115,22,0.1),transparent_24%),linear-gradient(180deg,rgba(12,17,28,0.98),rgba(8,11,18,0.94))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div class="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400">
          {{ heading }}
        </div>
        <div class="mt-3 max-w-xl text-2xl font-black leading-tight text-white">
          {{ summary }}
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <article
          v-for="item in stats"
          :key="item.label"
          class="rounded-[22px] border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
          <div class="text-[9px] font-bold uppercase tracking-[0.24em] text-zinc-500">
            {{ item.label }}
          </div>
          <div class="mt-2 text-xl font-black leading-none text-white">
            {{ item.value }}
          </div>
          <div v-if="item.detail" class="mt-2 text-[11px] text-zinc-500">
            {{ item.detail }}
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
