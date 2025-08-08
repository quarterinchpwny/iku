<template>
  <div class="flex h-screen w-full flex-col p-2">
    <ExtraDotMatrix
      numberText="5°C"
      :activeDotPositions="[
        { row: 10, col: 2 },
        { row: 0, col: 1 }
      ]"
    />
  </div>
</template>

<script setup></script>
