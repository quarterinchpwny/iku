<script setup lang="ts">
defineProps<{
  cityLabel: string;
  dayLabel: string;
  conditionLabel: string;
  conditionIcon: string;
  accent: string;
  glow: string;
  temperature: string;
  feelsLike: string;
  humidity: string;
  precipitation: string;
  windSpeed: string;
  uvIndex: string;
  sunriseLabel: string;
  sunsetLabel: string;
}>();
</script>

<template>
  <article
    class="min-h-full rounded-3xl p-5 text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
    :style="{ background: `linear-gradient(180deg, ${accent}, ${glow})` }"
  >
    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="text-[0.86rem] leading-[1.1] opacity-90">{{ dayLabel }}</div>
        <div class="mt-1 font-bold text-[0.86rem] leading-[1.1] opacity-90">{{ cityLabel }}</div>
      </div>
      <div class="rounded-full bg-white/20 px-3 py-2 text-[0.8rem] font-semibold">{{ conditionLabel }}</div>
    </div>

    <div class="mt-4 flex justify-start text-white/95">
      <Icon :name="conditionIcon" size="96" />
    </div>

    <div class="mt-4 flex items-end gap-4">
      <div class="text-[clamp(3.4rem,7vw,4.8rem)] font-bold leading-[0.9] tracking-[-0.06em]">{{ temperature }}</div>
      <div class="pb-[0.55rem] text-[0.9rem] opacity-90">Feels like {{ feelsLike }}</div>
    </div>

    <div class="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
      <div>
        <span class="block text-[0.72rem] opacity-70">Humidity</span>
        <strong class="mt-1 block text-[0.95rem] font-bold">{{ humidity }}</strong>
      </div>
      <div>
        <span class="block text-[0.72rem] opacity-70">Rain</span>
        <strong class="mt-1 block text-[0.95rem] font-bold">{{ precipitation }}</strong>
      </div>
      <div>
        <span class="block text-[0.72rem] opacity-70">Wind</span>
        <strong class="mt-1 block text-[0.95rem] font-bold">{{ windSpeed }}</strong>
      </div>
      <div>
        <span class="block text-[0.72rem] opacity-70">UV</span>
        <strong class="mt-1 block text-[0.95rem] font-bold">{{ uvIndex }}</strong>
      </div>
      <div>
        <span class="block text-[0.72rem] opacity-70">Sunrise</span>
        <strong class="mt-1 block text-[0.95rem] font-bold">{{ sunriseLabel }}</strong>
      </div>
      <div>
        <span class="block text-[0.72rem] opacity-70">Sunset</span>
        <strong class="mt-1 block text-[0.95rem] font-bold">{{ sunsetLabel }}</strong>
      </div>
    </div>
  </article>
</template>
