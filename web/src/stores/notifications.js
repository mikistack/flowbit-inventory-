import { defineStore } from 'pinia';
import api from '@/utils/api';

export const useNotificationStore = defineStore('notifications', {
  state: () => ({
    items: [],
    loading: false,
    error: '',
    pollingHandle: null,
  }),
  getters: {
    unreadCount: (state) => state.items.filter((item) => !item.readAt).length,
  },
  actions: {
    async fetchLatest(limit = 20) {
      this.loading = true;
      this.error = '';
      try {
        const { data } = await api.get('/notifications', { params: { limit } });
        this.items = data || [];
      } catch (error) {
        this.error = error.response?.data?.message || 'Unable to load notifications.';
      } finally {
        this.loading = false;
      }
    },
    async markAsRead(id) {
      try {
        await api.post(`/notifications/${id}/read`);
        this.items = this.items.filter((item) => item.id !== id);
      } catch (error) {
        console.error('Failed to mark notification as read', error);
      }
    },
    async markAllAsRead() {
      const ids = this.items.map((item) => item.id);
      if (!ids.length) return;
      await Promise.all(
        ids.map((id) =>
          api
            .post(`/notifications/${id}/read`)
            .catch((error) => console.error('Failed to clear notification', id, error)),
        ),
      );
      this.items = [];
    },
    startPolling(interval = 60000) {
      this.stopPolling();
      this.pollingHandle = setInterval(() => this.fetchLatest(), interval);
    },
    stopPolling() {
      if (this.pollingHandle) {
        clearInterval(this.pollingHandle);
        this.pollingHandle = null;
      }
    },
  },
});
