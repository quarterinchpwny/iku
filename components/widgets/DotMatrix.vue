<template>
  <div class="dot-matrix-container" ref="containerRef">
    <div class="dot-matrix-grid" :style="gridStyle">
      <div
        v-for="index in totalDots"
        :key="`bg-${index}`"
        class="dot-background"
        :style="{
          width: `${dotSize}px`,
          height: `${dotSize}px`,
          cursor: editable ? 'pointer' : 'default'
        }"
        @click="toggleDot(index - 1)"
      />

      <AnimatePresence>
        <motion.div
          v-for="index in activeDotIndices"
          :key="`fg-${index}`"
          class="dot active"
          :style="{
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            top: `${indexToPosition(index, columns).row * (dotSize + gap)}px`,
            left: `${indexToPosition(index, columns).col * (dotSize + gap)}px`
          }"
          :initial="{ opacity: 0, scale: 0.5 }"
          :animate="{ opacity: 1, scale: 1 }"
          :exit="{ opacity: 0, scale: 0.5 }"
          :transition="{ duration: 0.2 }"
        />
      </AnimatePresence>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { motion, AnimatePresence } from 'motion-v';

const props = defineProps({
  rows: { type: Number, default: 40 },
  columns: { type: Number, default: 45 },
  baseDotSize: { type: Number, default: 30 },
  baseGap: { type: Number, default: 6 },
  activeDots: { type: Array, default: () => [] },
  activeDotPositions: { type: Array, default: () => [] },
  numberText: { type: [String, Number], default: '' },
  editable: { type: Boolean, default: false },
  modelValue: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:modelValue']);

const containerRef = ref(null);

// reactive sizes
const dotSize = ref(props.baseDotSize);
const gap = ref(props.baseGap);

// compute gap ratio from base props so spacing scales proportionally
const gapRatio = computed(() => {
  // guard against division by zero
  return props.baseDotSize > 0 ? props.baseGap / props.baseDotSize : 0.4;
});

// grid total pixel size (used to explicitly size the grid)
const gridWidth = computed(() => props.columns * dotSize.value + (props.columns - 1) * gap.value);
const gridHeight = computed(() => props.rows * dotSize.value + (props.rows - 1) * gap.value);

// style object for the grid
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.columns}, ${dotSize.value}px)`,
  gridTemplateRows: `repeat(${props.rows}, ${dotSize.value}px)`,
  gap: `${gap.value}px`,
  width: `${gridWidth.value}px`,
  height: `${gridHeight.value}px`,
  position: 'relative'
}));

// calculate dotSize so the whole grid fits into the container (no overflow)
function calculateSize() {
  const container = containerRef.value;
  if (!container) return;

  const rect = container.getBoundingClientRect();
  let availableW = Math.max(0.1, rect.width);
  let availableH = rect.height;

  // If container has no explicit height, we fallback to viewport height portion
  if (!availableH || availableH < 10) {
    // fallback to 60% of viewport (safe default) to avoid zero height
    availableH = Math.max(100, window.innerHeight * 0.6);
  }

  // denom formula accounts for dots + gaps when gap = k * dotSize
  const k = gapRatio.value || 0.4;
  const denomW = props.columns + (props.columns - 1) * k;
  const denomH = props.rows + (props.rows - 1) * k;

  // candidate sizes (floor to avoid overflow due to fractions)
  const sizeByWidth = Math.floor(availableW / denomW);
  const sizeByHeight = Math.floor(availableH / denomH);

  // pick smaller so both width & height fit
  const computedSize = Math.max(2, Math.min(sizeByWidth, sizeByHeight));

  dotSize.value = computedSize;
  gap.value = Math.max(0, Math.round(dotSize.value * k));
}

// Resize handling: use ResizeObserver + window resize
let ro;
onMounted(async () => {
  await nextTick();
  calculateSize();
  window.addEventListener('resize', calculateSize);

  if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
    ro = new ResizeObserver(() => calculateSize());
    ro.observe(containerRef.value);
  }
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', calculateSize);
  if (ro) ro.disconnect();
});

// ===== existing logic for numbers & active dots (unchanged) =====
const numberMap = {
  0: [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 0],
    [1, 4],
    [2, 0],
    [2, 4],
    [3, 0],
    [3, 4],
    [4, 0],
    [4, 4],
    [5, 0],
    [5, 4],
    [6, 1],
    [6, 2],
    [6, 3]
  ],
  1: [
    [0, 2],
    [1, 1],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [5, 2],
    [6, 1],
    [6, 2],
    [6, 3]
  ],
  2: [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 0],
    [1, 4],
    [2, 4],
    [3, 3],
    [4, 2],
    [5, 1],
    [6, 0],
    [6, 1],
    [6, 2],
    [6, 3],
    [6, 4]
  ],
  3: [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 0],
    [1, 4],
    [2, 4],
    [3, 2],
    [3, 3],
    [4, 4],
    [5, 0],
    [5, 4],
    [6, 1],
    [6, 2],
    [6, 3]
  ],
  4: [
    [0, 3],
    [1, 2],
    [1, 3],
    [2, 1],
    [2, 3],
    [3, 0],
    [3, 3],
    [4, 0],
    [4, 1],
    [4, 2],
    [4, 3],
    [4, 4],
    [5, 3],
    [6, 3]
  ],
  5: [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 0],
    [2, 0],
    [3, 0],
    [3, 1],
    [3, 2],
    [3, 3],
    [4, 4],
    [5, 0],
    [5, 4],
    [6, 1],
    [6, 2],
    [6, 3]
  ],
  6: [
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 1],
    [2, 0],
    [3, 0],
    [3, 1],
    [3, 2],
    [3, 3],
    [4, 0],
    [4, 4],
    [5, 0],
    [5, 4],
    [6, 1],
    [6, 2],
    [6, 3]
  ],
  7: [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 3],
    [2, 2],
    [3, 2],
    [4, 1],
    [5, 1],
    [6, 0]
  ],
  8: [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 0],
    [1, 4],
    [2, 0],
    [2, 4],
    [3, 1],
    [3, 2],
    [3, 3],
    [4, 0],
    [4, 4],
    [5, 0],
    [5, 4],
    [6, 1],
    [6, 2],
    [6, 3]
  ],
  9: [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 0],
    [1, 4],
    [2, 0],
    [2, 4],
    [3, 1],
    [3, 2],
    [3, 3],
    [3, 4],
    [4, 4],
    [5, 3],
    [6, 2]
  ],
  C: [
    [0, 1],
    [0, 2],
    [1, 3],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
    [6, 1],
    [6, 2],
    [5, 3]
  ],
  F: [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 0],
    [3, 1],
    [3, 2],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
    [6, 0]
  ],
  '.': [[6, 0]],
  '°': [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1]
  ]
};

function generateNumberDots(number, startRow, startCol) {
  const digits = number.toString().split('');
  const all = [];
  let offsetCol = startCol;

  digits.forEach((digit) => {
    const pattern = numberMap[digit];
    if (!pattern) return;

    pattern.forEach(([r, c]) => {
      all.push({ row: startRow + r, col: offsetCol + c });
    });

    const width = Math.max(...pattern.map(([_, c]) => c)) + 1;
    offsetCol += width + 1;
  });

  return all;
}

const numberDotPositions = computed(() => {
  if (!props.numberText) return [];
  const startRow = props.rows - 7;
  const startCol = 0;
  return generateNumberDots(props.numberText, startRow, startCol);
});

const editablePositions = computed(() =>
  props.editable ? props.modelValue : props.activeDotPositions
);

const allPositions = computed(() => [...editablePositions.value, ...numberDotPositions.value]);

const activeSet = computed(() => {
  const set = new Set(props.activeDots);
  allPositions.value.forEach(({ row, col }) => {
    if (row >= 0 && col >= 0 && row < props.rows && col < props.columns) {
      set.add(row * props.columns + col);
    }
  });
  return set;
});

const activeDotIndices = computed(() => Array.from(activeSet.value));
const totalDots = computed(() => props.rows * props.columns);

function toggleDot(index) {
  if (!props.editable) return;
  const { row, col } = indexToPosition(index, props.columns);
  const key = `${row},${col}`;
  const current = new Set(props.modelValue.map(({ row, col }) => `${row},${col}`));

  if (current.has(key)) current.delete(key);
  else current.add(key);

  emit(
    'update:modelValue',
    Array.from(current).map((pair) => {
      const [row, col] = pair.split(',').map(Number);
      return { row, col };
    })
  );
}

function indexToPosition(index, columns) {
  return {
    row: Math.floor(index / columns),
    col: index % columns
  };
}
</script>

<style scoped>
.dot-matrix-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  overflow: hidden;
  padding: 0.5rem;
  box-sizing: border-box;
}

.dot-matrix-grid {
  display: grid;
  position: relative; /* important for absolutely positioned active dots */
  box-sizing: content-box;
  user-select: none;
}

.dot-background {
  background-color: #4d4d4d;
  border-radius: 50%;
}

.dot {
  position: absolute;
  background-color: #4d4d4d;
  border-radius: 50%;
  pointer-events: none; /* so clicks pass to the grid/background items */
}

.dot.active {
  background-color: #ea580c; /* Tailwind's orange-600 */
}

.dot-background.editable:hover {
  filter: brightness(1.2);
  pointer-events: auto;
}
</style>
