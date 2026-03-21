<template>
  <section class="rounded-[28px] border border-slate-700/70 bg-slate-950/80 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{{ eyebrow }}</p>
        <h3 class="text-lg font-semibold text-white">{{ title }}</h3>
      </div>
      <p v-if="updatedAt" class="text-xs text-slate-400">{{ updatedAt }}</p>
    </div>
    <pre
      class="max-h-[28rem] overflow-auto rounded-2xl bg-stone-950 px-4 py-3 text-xs leading-6 text-stone-100"
    >{{ prettyJson(payload) }}</pre>
  </section>
</template>

<script setup>
import { prettyJson } from '@/lib/queuePrediction'

defineProps({
  eyebrow: {
    type: String,
    default: 'Payload',
  },
  title: {
    type: String,
    required: true,
  },
  payload: {
    type: [Object, Array, String, Number, Boolean, null],
    default: null,
  },
  updatedAt: {
    type: String,
    default: '',
  },
})
</script>
