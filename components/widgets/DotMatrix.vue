<template>
  <div
    class="grid"
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
        width: `${dotSize - gap}px`,
        height: `${dotSize - gap}px`,
        backgroundColor: dot.lit ? litColor : unlitColor
      }"
    ></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

// SETTINGS
const props = defineProps({
  text: String
});
const dotSize = 8; // px size of each dot
const gap = 2; // space between dots
const litColor = '#00ff00';
const unlitColor = '#4d4d4d';

const cols = 40; // total columns
const rows = 15; // total rows
const dots = ref([]); // will hold dot states

onMounted(() => {
  generateDots();
});

function generateDots() {
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');

  // Fill background black
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, cols, rows);

  // Draw text in Doto font
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
      const lit = r + g + b > 100; // pixel brightness check
      dots.value.push({ lit });
    }
  }
}

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
