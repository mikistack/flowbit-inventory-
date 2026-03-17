<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  HomeIcon,
  TagIcon,
  ArrowsRightLeftIcon,
  UsersIcon,
  Cog8ToothIcon,
  ChartPieIcon,
} from '@heroicons/vue/24/outline';
import { navigation } from '@/constants/navigation';
import { useAuthStore } from '@/stores/auth';

const props = defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  },
  mobile: {
    type: Boolean,
    default: false,
  },
  visible: {
    type: Boolean,
    default: false,
  },
});

const route = useRoute();
const router = useRouter();
const openGroups = ref(new Set());
const authStore = useAuthStore();

const iconLibrary = {
  HomeIcon,
  TagIcon,
  ArrowsRightLeftIcon,
  UsersIcon,
  Cog8ToothIcon,
  ChartPieIcon,
};

const canAccess = (item) => !item.permission || authStore.hasPermission(item.permission);

const toggleGroup = (label) => {
  const updated = new Set(openGroups.value);
  if (updated.has(label)) {
    updated.delete(label);
  } else {
    updated.add(label);
  }
  openGroups.value = updated;
};

const isActive = (item) => {
  if (item.to?.name && route.name === item.to.name) return true;
  if (item.children) {
    return item.children.some((child) => child.to?.name === route.name);
  }
  return false;
};

const handleClick = async (item) => {
  if (item.children) {
    toggleGroup(item.label);
    return;
  }
  if (item.to) {
    await router.push(item.to);
  }
};

const normalizeNavigation = (items) =>
  items
    .map((item) => {
      const normalized = {
        ...item,
        icon: item.icon ? iconLibrary[item.icon] || HomeIcon : undefined,
      };
      if (item.children) {
        const children = normalizeNavigation(item.children);
        if (!children.length && !canAccess(item)) {
          return null;
        }
        return canAccess(item) || children.length ? { ...normalized, children } : null;
      }
      return canAccess(item) ? normalized : null;
    })
    .filter(Boolean);

const computedNavigation = computed(() => normalizeNavigation(navigation));
</script>

<template>
  <aside
    :class="[
      'bg-[#0f172a] text-white flex flex-col transition-all duration-200 z-40',
      mobile
        ? [
            'fixed inset-y-0 left-0 w-64 shadow-2xl transform',
            visible ? 'translate-x-0' : '-translate-x-full',
          ]
        : ['sticky top-0 h-screen', collapsed ? 'w-[72px]' : 'w-64'],
    ]"
  >
    <div class="flex items-center gap-3 px-4 py-5 border-b border-white/10">
      <div class="h-11 w-11 rounded-2xl bg-white flex items-center justify-center">
        <img src="/flowbit-logo.png" alt="Flow Bit" class="h-8 w-8 object-contain" />
      </div>
      <div v-if="!collapsed">
        <p class="text-sm uppercase tracking-wide text-white/70">Inventory Management</p>
      </div>
    </div>

    <nav class="flex-1 overflow-y-auto px-2 py-4">
      <ul class="space-y-1">
        <li v-for="item in computedNavigation" :key="item.label">
          <button
            type="button"
            class="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition"
            :class="isActive(item) ? 'bg-white/10 text-white' : 'text-white/70'"
            @click="handleClick(item)"
          >
            <component v-if="item.icon" :is="item.icon" class="w-5 h-5" />
            <span v-if="!collapsed" class="flex-1 text-left font-medium">{{ item.label }}</span>
            <svg
              v-if="item.children && !collapsed"
              class="w-4 h-4 transition-transform"
              :class="openGroups.has(item.label) ? 'rotate-90' : ''"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7" />
            </svg>
          </button>
          <transition name="fade">
            <ul
              v-if="item.children && openGroups.has(item.label) && !collapsed"
              class="ml-8 my-2 space-y-1 border-l border-white/5 pl-3 text-sm"
            >
              <li v-for="child in item.children" :key="child.label">
                <button
                  type="button"
                  class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/10"
                  :class="child.to?.name === route.name ? 'text-white' : 'text-white/70'"
                  @click="router.push(child.to)"
                >
                  {{ child.label }}
                </button>
              </li>
            </ul>
          </transition>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
