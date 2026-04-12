<template>
  <section class="rounded-[1rem] border border-zinc-800 bg-zinc-950 p-5">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">{{ eyebrow }}</p>
        <h3 class="text-lg font-semibold text-white">{{ title }}</h3>
      </div>
      <p v-if="updatedAt" class="text-xs text-zinc-500">{{ updatedAt }}</p>
    </div>
    <pre
      class="max-h-[28rem] overflow-auto rounded-lg border border-zinc-800 bg-[#090a0c] px-4 py-3 text-xs leading-6 text-zinc-100"
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
