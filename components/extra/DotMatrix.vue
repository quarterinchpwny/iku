<template>
  <div
    class="dot-matrix"
    :style="{
      gridTemplateColumns: `repeat(${columns}, ${dotSize}px)`,
      gridTemplateRows: `repeat(${rows}, ${dotSize}px)`,
      gap: `${gap}px`
    }"
  >
    <div
      v-for="index in totalDots"
      :key="index"
      class="dot"
      :class="{ active: isActive(index - 1) }"
      :style="{
        width: `${dotSize}px`,
        height: `${dotSize}px`
      }"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  rows: { type: Number, default: 20 },
  columns: { type: Number, default: 22 },
  dotSize: { type: Number, default: 12 },
  gap: { type: Number, default: 9 },
  activeDots: { type: Array, default: () => [] },
  activeDotPositions: { type: Array, default: () => [] },
  numberText: { type: [String, Number], default: '' } // 👈 new prop
});

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
    [0, 3],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 1],
    [4, 2],
    [4, 3]
  ],
  '°': [
    [0, 1],
    [0, 2],
    [1, 1],
    [1, 2]
  ]
};

function generateNumberDots(number, startRow, startCol) {
  const digits = number.toString().split('');
  const all = [];

  digits.forEach((digit, i) => {
    const pattern = numberMap[digit];
    if (!pattern) return;
    const offsetCol = startCol + i * 6;
    pattern.forEach(([r, c]) => {
      all.push({ row: startRow + r, col: offsetCol + c });
    });
  });

  return all;
}

const numberDotPositions = computed(() => {
  if (!props.numberText) return [];

  // Position at bottom right (6 rows tall, 5 wide each digit, 1 col gap)
  const startRow = props.rows - 7;
  const maxDigits = props.numberText.toString().length;
  const startCol = props.columns - maxDigits * 6;

  return generateNumberDots(props.numberText, startRow, startCol);
});

const allPositions = computed(() => [...props.activeDotPositions, ...numberDotPositions.value]);

const activeSet = computed(() => {
  const indexSet = new Set(props.activeDots);
  allPositions.value.forEach((pos) => {
    if (
      pos &&
      typeof pos.row === 'number' &&
      typeof pos.col === 'number' &&
      pos.row >= 0 &&
      pos.col >= 0 &&
      pos.row < props.rows &&
      pos.col < props.columns
    ) {
      const index = dotIndex(pos.row, pos.col, props.columns);
      indexSet.add(index);
    }
  });
  return indexSet;
});

const totalDots = computed(() => props.rows * props.columns);

function dotIndex(row, col, columns) {
  return row * columns + col;
}

function isActive(index) {
  return activeSet.value.has(index);
}
</script>

<style scoped>
.dot-matrix {
  display: grid;
  justify-content: center;
  padding: 20px;
  overflow-x: auto;
}

.dot {
  background-color: #4d4d4d;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.dot.active {
  @apply bg-orange-500 shadow-md ring-stone-950;
}
</style>
