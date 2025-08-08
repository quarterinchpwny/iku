<script setup lang="ts">
import DotMatrix from './DotMatrix.vue';

const editableDots = ref([]);
</script>

<template>
  <div>
    <DotMatrix v-model="editableDots" :editable="true" numberText="10.5" />
  </div>
</template>
