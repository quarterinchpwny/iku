<script setup lang="ts">
defineProps<{
  items: Array<{
    label: string;
    value: string;
    detail?: string;
    tone?: string;
  }>;
}>();
</script>

<template>
  <section class="grid grid-cols-2 gap-2 md:grid-cols-4">
    <article
      v-for="item in items"
      :key="item.label"
      class="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,18,28,0.96),rgba(10,12,18,0.92))] px-4 py-3 shadow-[0_14px_28px_rgba(0,0,0,0.24)] outline outline-1 outline-white/5"
    >
      <div class="text-[9px] font-bold uppercase tracking-[0.28em] text-zinc-500">
        {{ item.label }}
      </div>
      <div class="mt-2 text-lg font-black text-white" :class="item.tone || ''">
        {{ item.value }}
      </div>
      <div v-if="item.detail" class="mt-1 text-[11px] text-zinc-500">
        {{ item.detail }}
      </div>
    </article>
  </section>
</template>
