<script setup lang="ts">
import DotMatrix from './DotMatrix.vue';

const numberText = ref('123');
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <DotMatrix :text="numberText" />
    </div>
    <div class="rounded bg-red-500 p-4">
      <input type="text" v-model="numberText" class="w-full" />
    </div>
  </div>
</template>
