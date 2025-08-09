<template>
  <div class="dot-matrix-container">
    <div
      class="dot-matrix-grid"
      :style="{
        gridTemplateColumns: `repeat(${columns}, ${dotSize}px)`,
        gridTemplateRows: `repeat(${rows}, ${dotSize}px)`,
        gap: `${gap}px`
      }"
    >
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
import { computed } from 'vue';
import { motion, AnimatePresence } from 'motion-v';

const props = defineProps({
  rows: { type: Number, default: 40 },
  columns: { type: Number, default: 34 },
  dotSize: { type: Number, default: 8 },
  gap: { type: Number, default: 4 },
  activeDots: { type: Array, default: () => [] },
  activeDotPositions: { type: Array, default: () => [] },
  numberText: { type: [String, Number], default: '' },
  editable: { type: Boolean, default: false },
  modelValue: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:modelValue']);

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

function getTextWidth(text) {
  return text
    .toString()
    .split('')
    .reduce((width, digit, i, arr) => {
      const pattern = numberMap[digit];
      if (!pattern) return width;
      const digitWidth = Math.max(...pattern.map(([_, c]) => c)) + 1;
      return width + digitWidth + (i < arr.length - 1 ? 1 : 0);
    }, 0);
}

function generateNumberDots(number, startRow, startCol) {
  const digits = number.toString().split('');
  const all = [];
  let offsetCol = startCol;

  digits.forEach((digit) => {
    const pattern = numberMap[digit];
    if (!pattern) return;

    let digitStartRow = startRow;

    pattern.forEach(([r, c]) => {
      all.push({ row: digitStartRow + r, col: offsetCol + c });
    });

    const width = Math.max(...pattern.map(([_, c]) => c)) + 1;
    offsetCol += width + 1;
  });

  return all;
}

const numberDotPositions = computed(() => {
  if (!props.numberText) return [];
  const startRow = props.rows - 7; // Adjusted to fit the number in the last 7 rows
  // const textWidth = getTextWidth(props.numberText);
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
  padding: 20px;
  overflow: auto;
}

.dot-matrix-grid {
  display: grid;
  position: relative;
}

.dot-background {
  background-color: #4d4d4d;
  border-radius: 50%;
}

.dot {
  position: absolute;
  background-color: #4d4d4d;
  border-radius: 50%;
}

.dot.active {
  @apply bg-orange-600;
}

.dot-background.editable:hover {
  filter: brightness(1.2);
}
</style>
e>
