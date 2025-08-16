<script setup lang="ts">
import DotMatrix from './DotMatrix.vue';

const numberText = ref('');
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <DotMatrix :text="numberText" />
    </div>
    <div class="p-4">
      <input v-model="numberText" type="text" class="w-full" />
    </div>
  </div>
</template>
