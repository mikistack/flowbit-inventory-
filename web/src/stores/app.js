import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    sidebarCollapsed: false,
    sidebarVisible: false,
    isMobile: false,
  }),
  actions: {
    toggleSidebar() {
      if (this.isMobile) {
        this.sidebarVisible = !this.sidebarVisible;
      } else {
        this.sidebarCollapsed = !this.sidebarCollapsed;
      }
    },
    setSidebarVisible(visible) {
      this.sidebarVisible = visible;
    },
    setMobile(flag) {
      this.isMobile = flag;
      if (!flag) {
        this.sidebarVisible = false;
      }
    },
  },
});
