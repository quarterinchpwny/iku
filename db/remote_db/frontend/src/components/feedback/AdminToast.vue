<template>
  <Transition
    enter-active-class="transition ease-out duration-300"
    enter-from-class="transform opacity-0 translate-y-2"
    enter-to-class="transform opacity-100 translate-y-0"
    leave-active-class="transition ease-in duration-200"
    leave-from-class="transform opacity-100 translate-y-0"
    leave-to-class="transform opacity-0 translate-y-2"
  >
    <div
      v-if="message"
      :class="`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3 shadow-lg ${message.type === 'error' ? 'bg-red-600 text-white' : message.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'}`"
    >
      <component :is="message.type === 'error' ? AlertCircle : CheckCircle" :size="20" />
      <span class="text-sm font-medium">{{ message.text }}</span>
    </div>
  </Transition>
</template>

<script setup>
import { AlertCircle, CheckCircle } from 'lucide-vue-next'
import { useAdminAppContext } from '../../composables/useAdminAppContext'

const { message } = useAdminAppContext().feedback
</script>
