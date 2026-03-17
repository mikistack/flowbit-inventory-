<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api from '@/utils/api';

const form = reactive({
  username: '',
  password: '',
});

const status = reactive({
  loading: false,
  message: '',
});

const resetState = reactive({
  username: '',
  code: '',
  newPassword: '',
  stage: 'init',
  loading: false,
  message: '',
  success: false,
});

const showReset = ref(false);
const authStore = useAuthStore();
const router = useRouter();
const usernameInput = ref(null);

const submit = async () => {
  status.message = '';
  status.loading = true;
  try {
    const payload = {
      username: (form.username || '').trim(),
      password: (form.password || '').trim(),
    };
    const { data } = await api.post('/auth/login', payload);
    authStore.setSession(data);
    router.push({ name: 'dashboard' });
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Login failed.';
    status.message = message;
    console.error('Login error', error);
    usernameInput.value?.focus();
  } finally {
    status.loading = false;
  }
};

const toggleReset = () => {
  showReset.value = !showReset.value;
  resetState.username = form.username || '';
  resetState.code = '';
  resetState.newPassword = '';
  resetState.stage = 'init';
  resetState.message = '';
  resetState.success = false;
};

const sendResetCode = async () => {
  resetState.loading = true;
  resetState.message = '';
  try {
    await authStore.requestPasswordReset(resetState.username);
    resetState.stage = 'verify';
    resetState.message = 'We sent an OTP to the configured Telegram chat.';
  } catch (error) {
    resetState.message = error.response?.data?.message || 'Unable to send code.';
  } finally {
    resetState.loading = false;
  }
};

const completeReset = async () => {
  resetState.loading = true;
  resetState.message = '';
  try {
    await authStore.resetPassword(resetState.username, resetState.code, resetState.newPassword);
    resetState.success = true;
    resetState.message = 'Password updated. You can now sign in.';
    resetState.stage = 'init';
  } catch (error) {
    resetState.message = error.response?.data?.message || 'Unable to reset password.';
  } finally {
    resetState.loading = false;
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-100 px-4">
    <div class="bg-white rounded-3xl shadow-xl max-w-md w-full p-8 space-y-6">
      <div class="flex flex-col items-center gap-3 text-center">
        <img src="/flowbit-logo.png" alt="Flow Bit" class="h-12 w-auto" />
        <p class="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Flow Bit</p>
        <p class="text-sm uppercase tracking-[0.3em] text-brand-500">Inventory Management System</p>
        <h1 class="text-2xl font-semibold mt-2">Welcome back</h1>
      </div>
      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label class="text-sm font-medium text-slate-600">Username</label>
          <input
            v-model="form.username"
            type="text"
            required
            class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:ring-2 focus:ring-brand-400"
            ref="usernameInput"
          />
        </div>
        <div>
          <label class="text-sm font-medium text-slate-600">Password</label>
          <input
            v-model="form.password"
            type="password"
            required
            class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-500">Forgot password?</span>
          <button type="button" class="text-brand-600 font-semibold" @click="toggleReset">
            {{ showReset ? 'Hide reset form' : 'Reset via Telegram OTP' }}
          </button>
        </div>
        <button
          type="submit"
          class="w-full bg-brand-600 text-white rounded-2xl py-3 font-semibold hover:bg-brand-700 transition disabled:opacity-50"
          :disabled="status.loading"
        >
          {{ status.loading ? 'Signing In...' : 'Sign In' }}
        </button>
        <p v-if="status.message" class="text-center text-sm text-rose-600">{{ status.message }}</p>
      </form>
      <div class="text-center text-xs text-slate-500">
        By signing in you accept Flow Bit&apos;s
        <RouterLink to="/legal/terms" class="font-semibold text-brand-600 hover:underline">Terms of Use</RouterLink>
        and
        <RouterLink to="/legal/privacy" class="font-semibold text-brand-600 hover:underline">Privacy Policy</RouterLink>.
      </div>
      <div
        v-if="showReset"
        class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3"
      >
        <p class="text-sm font-semibold text-slate-700">Reset password via Telegram</p>
        <div class="space-y-2">
          <label class="text-xs font-medium text-slate-600">Username</label>
          <input
            v-model="resetState.username"
            type="text"
            class="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-brand-300"
          />
        </div>
        <div v-if="resetState.stage === 'verify'" class="space-y-2">
          <label class="text-xs font-medium text-slate-600">OTP Code</label>
          <input
            v-model="resetState.code"
            type="text"
            class="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-brand-300"
            placeholder="Enter the code from Telegram"
          />
          <label class="text-xs font-medium text-slate-600">New Password</label>
          <input
            v-model="resetState.newPassword"
            type="password"
            class="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-brand-300"
            placeholder="New password"
          />
        </div>
        <div class="flex gap-2">
          <button
            v-if="resetState.stage === 'init'"
            type="button"
            class="flex-1 rounded-xl bg-brand-50 text-brand-700 font-semibold py-2"
            :disabled="resetState.loading || !resetState.username"
            @click="sendResetCode"
          >
            {{ resetState.loading ? 'Sending…' : 'Send Telegram Code' }}
          </button>
          <button
            v-else
            type="button"
            class="flex-1 rounded-xl bg-brand-600 text-white font-semibold py-2 disabled:opacity-50"
            :disabled="resetState.loading || !resetState.code || !resetState.newPassword"
            @click="completeReset"
          >
            {{ resetState.loading ? 'Updating…' : 'Update Password' }}
          </button>
        </div>
        <p v-if="resetState.message" :class="['text-xs', resetState.success ? 'text-emerald-600' : 'text-slate-600']">
          {{ resetState.message }}
        </p>
      </div>
      <p class="text-center text-[11px] uppercase tracking-wider text-slate-400">Crafted by Flow Bit</p>
    </div>
  </div>
</template>
