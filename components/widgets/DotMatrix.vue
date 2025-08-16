<template>
  <div
    ref="gridEl"
    class="grid h-auto w-full"
    :style="{
      gridTemplateColumns: `repeat(${cols}, ${dotSize}px)`,
      gridTemplateRows: `repeat(${rows}, ${dotSize}px)`,
      gap: `${gap}px`
    }"
  >
    <div
      v-for="(dot, i) in dots"
      :key="i"
      class="rounded-full transition-colors duration-150"
      :style="{
        width: `${dotSize}px`,
        height: `${dotSize}px`,
        backgroundColor: dot.lit ? litColor : unlitColor
      }"
    ></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';

const props = defineProps({
  text: String
});

const cols = 40;
const rows = 15;
const gap = ref(2); // px
const dotSize = ref(5);
const litColor = '#ff7300ff';
const unlitColor = '#4d4d4d';

const dots = ref([]);
const gridEl = ref(null);

function resizeDots() {
  if (!gridEl.value) return;
  const containerWidth = gridEl.value.clientWidth;
  // snap to integers to prevent subpixel gaps on mobile
  dotSize.value = Math.floor(
    (containerWidth - (cols - 1) * gap.value) / cols
  );
}

function generateDots() {
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, cols, rows);

  ctx.fillStyle = 'white';
  ctx.font = `${rows}px Doto`;
  ctx.textBaseline = 'top';
  ctx.fillText(props.text, 0, 0);

  const imageData = ctx.getImageData(0, 0, cols, rows).data;
  dots.value = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = (y * cols + x) * 4;
      const r = imageData[idx];
      const g = imageData[idx + 1];
      const b = imageData[idx + 2];
      const lit = r + g + b > 100;
      dots.value.push({ lit });
    }
  }
}

onMounted(() => {
  resizeDots();
  generateDots();
  window.addEventListener('resize', resizeDots);
});

watch(
  () => props.text,
  () => {
    generateDots();
  }
);
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Doto:wght@300;400&display=swap');
:root {
  font-family: 'Doto', monospace;
}
</style>
