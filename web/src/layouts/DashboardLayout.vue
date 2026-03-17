<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import SidebarNav from '@/components/navigation/SidebarNav.vue';
import TopBar from '@/components/navigation/TopBar.vue';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();
const isMobile = ref(false);

const handleResize = () => {
  const mobile = window.innerWidth <= 1024;
  isMobile.value = mobile;
  appStore.setMobile(mobile);
};

onMounted(() => {
  handleResize();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <div class="min-h-screen flex bg-slate-50 text-slate-900">
    <SidebarNav v-if="!isMobile" :collapsed="appStore.sidebarCollapsed" />
    <SidebarNav
      v-else
      :collapsed="false"
      :mobile="true"
      :visible="appStore.sidebarVisible"
    />
    <div
      v-if="isMobile && appStore.sidebarVisible"
      class="fixed inset-0 bg-black/40 z-30"
      @click="appStore.setSidebarVisible(false)"
    ></div>
    <div class="flex-1 flex flex-col min-h-screen">
      <TopBar />
      <main class="flex-1 overflow-y-auto p-4 sm:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
