<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const go = (name) => {
  router.push({ name });
};
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col">
    <header class="px-4 py-3 bg-white shadow flex items-center justify-between">
      <div>
        <p class="text-[10px] uppercase tracking-[0.4em] text-slate-400">Flow Bit</p>
        <p class="text-sm font-semibold text-slate-900">Inventory Mobile</p>
      </div>
      <button
        type="button"
        class="text-xs font-semibold text-brand-600"
        @click="() => router.push({ name: 'dashboard' })"
      >
        Desktop
      </button>
    </header>
    <main class="flex-1 overflow-y-auto">
      <router-view />
    </main>
    <nav class="bg-white border-t border-slate-100 px-4 py-2 grid grid-cols-3 text-xs text-center">
      <button type="button" class="py-2" @click="go('mobile-home')">Home</button>
      <button type="button" class="py-2" @click="go('sales')">Sales</button>
      <button type="button" class="py-2" @click="go('purchases')">Purchases</button>
    </nav>
  </div>
</template>
