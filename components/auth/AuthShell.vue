<template>
  <div class="min-h-screen bg-[#05070b] px-4 py-4 text-zinc-100">
    <div class="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[28rem] flex-col gap-4 pb-6">
      <section
        class="overflow-hidden rounded-[1rem] border border-white/10 bg-[#1a1c1e] shadow-[0_10px_30px_rgba(0,0,0,0.55),0_0_20px_rgba(255,255,255,0.04)]"
      >
        <div class="border-b border-white/10 px-5 py-4">
          <div class="flex items-center justify-between gap-3">
            <NuxtLink to="/" class="inline-flex min-w-0 items-center gap-3 text-zinc-100">
              <span
                class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[1rem] border border-orange-500/30 bg-[#18120d] text-lg font-semibold text-orange-400"
              >
                行
              </span>
              <div class="min-w-0">
                <div class="truncate text-base font-semibold">IKU</div>
                <div class="truncate text-sm text-zinc-500">Commute and movement tracking</div>
              </div>
            </NuxtLink>
            <slot name="headerAction" />
          </div>
        </div>

        <div class="space-y-4 px-5 py-5">
          <div class="space-y-2">
            <h1 class="text-2xl font-semibold tracking-tight text-zinc-50">
              {{ title }}
            </h1>
            <p class="text-sm leading-6 text-zinc-400">
              {{ description }}
            </p>
          </div>

          <div class="grid gap-2">
            <div
              v-for="item in highlights"
              :key="item.title"
              class="rounded-[1rem] border border-white/10 bg-black/30 px-4 py-3"
            >
              <div class="text-sm font-medium text-zinc-100">{{ item.title }}</div>
              <p class="mt-1 text-sm leading-6 text-zinc-500">{{ item.body }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-[1rem] border border-zinc-800 bg-zinc-950 p-5">
        <slot />
      </section>

      <section class="grid gap-2">
        <div
          v-for="item in details"
          :key="item.label"
          class="rounded-[1rem] border border-zinc-800 bg-zinc-900/70 px-4 py-3"
        >
          <div class="text-sm font-medium text-zinc-200">{{ item.label }}</div>
          <div class="mt-1 text-sm leading-6 text-zinc-500">{{ item.value }}</div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description: string
  highlights: Array<{ title: string; body: string }>
  details: Array<{ label: string; value: string }>
}>()
</script>
