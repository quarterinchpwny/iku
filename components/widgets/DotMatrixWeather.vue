<script setup lang="ts">
import DotMatrix from './DotMatrix.vue';

const editableDots = ref([]);
const numberText = ref('° F');
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <DotMatrix v-model="editableDots" :editable="true" :numberText="numberText" />
    </div>
    <div class="rounded bg-gray-100 p-4">
      <input type="text" v-model="numberText" class="w-full" />
    </div>
  </div>
</template>
