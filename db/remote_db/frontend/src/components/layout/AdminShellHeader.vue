<template>
  <header class="iku-header sticky top-0 z-30 border-b border-slate-200 bg-white">
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <div class="flex items-center gap-3">
        <div>
          <img :src="logoSvg" alt="IKU" class="h-7 w-auto" />
          <p class="text-xs text-slate-500">System Dashboard</p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <button
            @click="goToPage('dashboard')"
            :class="[
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              currentPage === 'dashboard'
                ? 'border-indigo-500 bg-indigo-600 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            ]"
          >
            Dashboard
          </button>
          <button
            @click="goToPage('map')"
            :class="[
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              currentPage === 'map'
                ? 'border-indigo-500 bg-indigo-600 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            ]"
          >
            Map
          </button>
          <button
            @click="goToPage('logs')"
            :class="[
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              currentPage === 'logs'
                ? 'border-indigo-500 bg-indigo-600 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            ]"
          >
            Logs
          </button>
          <button
            @click="goToPage('queue')"
            :class="[
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              currentPage === 'queue'
                ? 'border-indigo-500 bg-indigo-600 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            ]"
          >
            Queue
          </button>
        </div>
        <button
          @click="handleLogout"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <LogOut :size="14" /> Logout
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { LogOut } from 'lucide-vue-next'
import logoSvg from '../../assets/logo-svg.svg'
import { useAdminAppContext } from '../../composables/useAdminAppContext'

const { currentPage, goToPage, handleLogout } = useAdminAppContext().shell
</script>
