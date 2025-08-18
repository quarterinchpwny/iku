<template>
  <div
    ref="gridEl"
    class="grid h-auto w-full"
    :style="{
      gridTemplateColumns: `repeat(${cols}, minmax(${minDotSize}px, ${maxDotSize}px))`,
      gridTemplateRows: `repeat(${rows}, minmax(${minDotSize}px, ${maxDotSize}px))`,
      gap: `${gap}px`,
      lineHeight: 0
    }"
  >
    <div
      v-for="(dot, i) in dots"
      :key="i"
      :class="['rounded-full transition-colors duration-150', dot.lit?'glow':'']"
      :style="{
        width: '100%',
        aspectRatio: '1/1',
        backgroundColor: dot.lit ? litColor : unlitColor,
      }"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount } from "vue";

const props = defineProps({
  text: { type: String, default: "" },
});

// Grid configuration
const cols = ref(72);  // Default column count
const rows = ref(12);  // Fixed row count

// Visual settings
const gap = ref(2);
const dotSize =ref(2)
const minDotSize = ref(3);  // Minimum dot size in pixels
const maxDotSize = ref(12); // Maximum dot size in pixels
const targetDotSize = ref(10); // Ideal dot size
const litColor = "#ff7300ff";
const unlitColor = "#4d4d4d";

// State
const dots = ref([]);
const gridEl = ref(null);

// Font definition (same as before)
// --- 5x5 Font Map ---
const FONT_5x5 = {
  " ": ["00", "00", "00", "00", "00"], // Now 2x5 for space
  "!": ["00100", "00100", "00100", "00000", "00100"],
  ".": ["00000", "00000", "00000", "00100", "00100"],
  ",": ["00000", "00000", "00000", "00100", "01000"],
  "-": ["00000", "00000", "11111", "00000", "00000"],
  ":": ["00100", "00000", "00000", "00100", "00000"],
  "?": ["01110", "10001", "00110", "00000", "00100"],
  "0": ["01110", "10001", "10001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00010", "00100", "11111"],
  "3": ["11110", "00001", "00110", "00001", "11110"],
  "4": ["10010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "11110"],
  "6": ["01110", "10000", "11110", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "00100"],
  "8": ["01110", "10001", "01110", "10001", "01110"],
  "9": ["01110", "10001", "01111", "00001", "01110"],
  A: ["01110", "10001", "11111", "10001", "10001"],
  B: ["11110", "10001", "11110", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "11110", "10000", "11111"],
  F: ["11111", "10000", "11110", "10000", "10000"],
  G: ["01111", "10000", "10011", "10001", "01111"],
  H: ["10001", "10001", "11111", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "11100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001"],
  O: ["01110", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "11110", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10011", "01111"],
  R: ["11110", "10001", "11110", "10010", "10001"],
  S: ["01111", "10000", "01110", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10101", "11011", "10001"],
  X: ["10001", "01010", "00100", "01010", "10001"],
  Y: ["10001", "01010", "00100", "00100", "00100"],
  Z: ["11111", "00010", "00100", "01000", "11111"],
};
function glyphFor(ch) {
  const up = ch.toUpperCase();
  return FONT_5x5[up] || FONT_5x5["?"];
}

function updateGrid() {
  if (!gridEl.value) return;

  const containerWidth = gridEl.value.clientWidth;

  // Calculate how many columns we can fit with the target dot size
  const calculatedCols = Math.max(
    1,
    Math.floor(containerWidth / (targetDotSize.value + gap.value))
  );

  // Use either the default columns or the calculated maximum, whichever is smaller
  const numCols = Math.min(cols.value, calculatedCols);

  // Update reactive values
  if (cols.value !== numCols) {
    cols.value = numCols;
  }
}

function generateDots() {
  const buffer = new Array(rows.value * cols.value).fill(false);
  let cursorX = 0;
  let cursorY = 0;
  const lineHeight = 6; // 5 rows + 1 spacing

  for (const ch of props.text) {
    if (ch === '\n') {
      cursorX = 0;
      cursorY += lineHeight;
      continue;
    }

    const glyph = glyphFor(ch);
    const charWidth = glyph[0].length;
    const spacing = 1; // spacing after character

    // Check if we need to wrap to next line
    if (cursorX + charWidth > cols.value) {
      cursorX = 0;
      cursorY += lineHeight;
    }

    // Don't render if we're out of rows
    if (cursorY >= rows.value) break;

    // Render the character
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < charWidth; x++) {
        if (glyph[y] && glyph[y][x] === '1') {
          const posX = cursorX + x;
          const posY = cursorY + y;
          if (posX < cols.value && posY < rows.value) {
            buffer[posY * cols.value + posX] = true;
          }
        }
      }
    }

    cursorX += charWidth + spacing;
  }

  dots.value = buffer.map(lit => ({ lit }));
}

// Responsive adjustments
const handleResize = () => {
  updateGrid();
  generateDots();
};

onMounted(() => {
  handleResize();
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
});

watch(() => props.text, generateDots);
watch(cols, generateDots);
</script>

<style scoped>
.glow {
  -webkit-box-shadow: 0px 0px 20px 0px rgba(219, 132, 27, 0.9);
  -moz-box-shadow: 0px 0px 20px 0px rgba(219, 132, 27, 0.9);
  box-shadow: 0px 0px 20px 0px rgba(219, 132, 27, 0.9);
}
</style>