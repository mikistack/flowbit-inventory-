<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Bars3CenterLeftIcon, BellAlertIcon } from '@heroicons/vue/24/outline';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';

const appStore = useAppStore();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const route = useRoute();
const router = useRouter();
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const title = computed(() => route.meta?.title || 'Dashboard');

const showProfileMenu = ref(false);
const showNotifications = ref(false);
const menuRef = ref(null);
const notificationsRef = ref(null);

const toggleProfileMenu = () => {
  showProfileMenu.value = !showProfileMenu.value;
  if (showProfileMenu.value) {
    showNotifications.value = false;
  }
};

const handleClickOutside = (event) => {
  if (menuRef.value && !menuRef.value.contains(event.target)) {
    showProfileMenu.value = false;
  }
  if (notificationsRef.value && !notificationsRef.value.contains(event.target)) {
    showNotifications.value = false;
  }
};

const logout = () => {
  authStore.logout();
  showProfileMenu.value = false;
  router.push({ name: 'login' }).finally(() => {
    window.location.reload();
  });
};

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value;
  if (showNotifications.value) {
    showProfileMenu.value = false;
    notificationStore.fetchLatest();
  }
};

const openNotification = (notification) => {
  if (!notification) return;
  if (!notification.readAt) {
    notificationStore.markAsRead(notification.id);
  }
  if (notification.meta?.filePath) {
    window.open(`${API_BASE}/notifications/${notification.id}/file`, '_blank');
  }
};

const formatTimestamp = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString();
};


onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  notificationStore.fetchLatest();
  notificationStore.startPolling();
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
  notificationStore.stopPolling();
});
</script>

<template>
  <header class="min-h-[64px] border-b border-slate-200 bg-white flex flex-wrap items-center gap-3 px-4 sm:px-6">
    <div class="flex items-center gap-3 flex-1 min-w-[200px]">
      <button
        type="button"
        class="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
        @click="appStore.toggleSidebar"
      >
        <Bars3CenterLeftIcon class="w-5 h-5" />
      </button>
      <div class="flex flex-col">
        <p class="text-[11px] uppercase tracking-wide text-slate-500">Current Module</p>
        <p class="text-base sm:text-lg font-semibold text-slate-900 truncate max-w-[160px] sm:max-w-none">
          {{ title }}
        </p>
      </div>
    </div>
    <div class="flex items-center gap-2 sm:gap-4 flex-1 justify-end flex-wrap sm:flex-nowrap">
      <div class="relative order-2 sm:order-1" ref="notificationsRef">
        <button
          type="button"
          class="relative p-2 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100"
          @click.stop="toggleNotifications"
        >
          <BellAlertIcon class="w-5 h-5" />
          <span
            v-if="notificationStore.unreadCount"
            class="absolute -top-0.5 -right-0.5 h-4 min-w-[1rem] px-1 text-[10px] bg-rose-500 text-white rounded-full flex items-center justify-center"
          >
            {{ notificationStore.unreadCount > 9 ? '9+' : notificationStore.unreadCount }}
          </span>
        </button>
        <div
          v-if="showNotifications"
          class="absolute right-0 mt-2 w-80 bg-white border border-slate-100 rounded-2xl shadow-xl p-4 space-y-3 z-50"
        >
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold text-slate-900">Alerts</p>
            <button
              type="button"
              class="text-xs text-slate-500 hover:text-slate-700"
              @click="notificationStore.fetchLatest()"
            >
              Refresh
            </button>
            <button
              v-if="notificationStore.items.length"
              type="button"
              class="ml-2 text-xs text-brand-600 hover:text-brand-700"
              @click="notificationStore.markAllAsRead()"
            >
              Clear all
            </button>
          </div>
          <p v-if="notificationStore.loading" class="text-xs text-slate-500">Loading notifications…</p>
          <p v-else-if="notificationStore.error" class="text-xs text-rose-600">
            {{ notificationStore.error }}
          </p>
          <ul v-else class="space-y-3 max-h-72 overflow-y-auto">
            <li
              v-for="notification in notificationStore.items"
              :key="notification.id"
              class="border border-slate-100 rounded-xl p-3 hover:bg-slate-50 cursor-pointer"
              :class="{ 'opacity-60': notification.readAt }"
              @click="openNotification(notification)"
            >
              <p class="text-sm font-semibold text-slate-900">{{ notification.title }}</p>
              <p class="text-xs text-slate-600">{{ notification.message }}</p>
              <div class="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                <span>{{ formatTimestamp(notification.createdAt) }}</span>
                <span v-if="notification.meta?.filePath" class="text-brand-600 font-semibold">Download</span>
              </div>
            </li>
            <li v-if="!notificationStore.items.length" class="text-xs text-slate-500">No notifications yet.</li>
          </ul>
        </div>
      </div>
      <div class="flex items-center gap-2 sm:gap-3 relative order-1 sm:order-2" ref="menuRef">
        <div class="text-right hidden sm:block">
          <p class="text-sm font-medium text-slate-900">
            {{ authStore.user?.firstName || 'Admin' }} {{ authStore.user?.lastName || '' }}
          </p>
          <p class="text-xs text-slate-500">{{ authStore.user?.role || 'Admin' }}</p>
        </div>
        <button
          type="button"
          class="h-10 w-10 rounded-full bg-brand-500 text-white flex items-center justify-center font-semibold focus:ring-2 focus:ring-brand-200"
          @click.stop="toggleProfileMenu"
        >
          {{ (authStore.user?.firstName || 'A').charAt(0) }}
        </button>
        <div
          v-if="showProfileMenu"
          class="absolute right-0 top-12 w-64 bg-white border border-slate-100 rounded-2xl shadow-lg p-4 z-50"
        >
          <p class="text-sm font-semibold text-slate-900">
            {{ authStore.user?.firstName }} {{ authStore.user?.lastName }}
          </p>
          <p class="text-xs text-slate-500">{{ authStore.user?.email }}</p>
          <p class="text-xs text-slate-500 mt-1 capitalize">Role: {{ authStore.user?.role || 'Admin' }}</p>
          <div class="mt-4 border border-slate-100 rounded-xl p-3 space-y-2">
            <p class="text-xs font-semibold text-slate-600">Telegram Chat ID</p>
            <p class="text-xs text-slate-500">
              {{ authStore.user?.telegramChatId || 'Not set by admin' }}
            </p>
            <p class="text-[11px] text-slate-500">
              Admins can update chat IDs from People → Users.
            </p>
          </div>
          <div class="mt-4 flex gap-2">
            <button type="button" class="flex-1 rounded-2xl border border-slate-200 text-sm py-2" @click="showProfileMenu = false">
              Close
            </button>
            <button type="button" class="flex-1 rounded-2xl bg-rose-50 text-rose-600 text-sm py-2 font-semibold" @click="logout">
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
