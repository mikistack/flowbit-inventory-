import { defineStore } from 'pinia';
import api from '@/utils/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
    permissions: [],
    profileLoaded: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.accessToken),
  },
  actions: {
    async login(credentials) {
      const { data } = await api.post('/auth/login', credentials);
      this.setSession(data);
    },
    setSession(data) {
      this.user = data.user;
      this.permissions = data.user?.permissions || [];
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      this.profileLoaded = true;
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
    },
    async fetchProfile() {
      if (!this.accessToken) return;
      const { data } = await api.get('/auth/me');
      this.user = data;
      this.permissions = data.permissions || [];
      this.profileLoaded = true;
    },
    async logout() {
      try {
        await api.post('/auth/logout');
      } catch (error) {
        // ignore, still clear local state
      }
      this.user = null;
      this.permissions = [];
      this.accessToken = null;
      this.refreshToken = null;
      this.profileLoaded = false;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    },
    hasPermission(key) {
      if (!key) return true;
      if (['Admin', 'Super Admin'].includes(this.user?.role)) return true;
      return this.permissions.includes(key);
    },
    async requestPasswordReset(username) {
      return api.post('/auth/password-reset/request', { username });
    },
    async resetPassword(username, code, password) {
      return api.post('/auth/password-reset/complete', { username, code, password });
    },
    async changePassword(currentPassword, newPassword) {
      return api.post('/auth/change-password', { currentPassword, newPassword });
    },
  },
});
