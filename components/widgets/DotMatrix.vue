<template>
  <div
    ref="gridEl"
    class="grid h-auto w-full"
    :style="{
      gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
      gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
      lineHeight: 0
    }"
  >
    <div
      v-for="(dot, i) in dots"
      :key="i"
      class="rounded-full transition-colors duration-150"
      :style="{
        width: `${dotDiameter}px`,
        height: `${dotDiameter}px`,
        margin: `${gap/2}px`,
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
const gap = 2; // px gap between dots (background shows through)
const cellSize = ref(5);
const dotDiameter = ref(3);
const litColor = '#ff7300ff';
const unlitColor = '#4d4d4d';

const dots = ref([]);
const gridEl = ref(null);

function resizeDots() {
  if (!gridEl.value) return;
  const containerWidth = gridEl.value.clientWidth;
  // Snap to device pixels for perfect sharpness
  const dpr = window.devicePixelRatio || 1;
  cellSize.value = Math.round((containerWidth / cols) * dpr) / dpr;
  dotDiameter.value = cellSize.value - gap;
}

function generateDots() {
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = cols * dpr;
  canvas.height = rows * dpr;
  const ctx = canvas.getContext('2d');

  ctx.scale(dpr, dpr); // Match logical coords to physical pixels

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
  window.addEventListener('resize', () => {
    resizeDots();
    generateDots();
  });
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
