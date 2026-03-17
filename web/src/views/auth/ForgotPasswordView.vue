<script setup>
import { reactive } from 'vue';
import { useAuthStore } from '@/stores/auth';

const form = reactive({
  email: '',
});

const state = reactive({
  loading: false,
  message: '',
  error: '',
});

const authStore = useAuthStore();

const submit = async () => {
  state.loading = true;
  state.message = '';
  state.error = '';
  try {
    await authStore.requestPasswordReset(form.email);
    state.message = 'If the email exists, a reset link has been sent.';
  } catch (error) {
    state.error = error.response?.data?.message || 'Failed to request password reset.';
  } finally {
    state.loading = false;
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-100 px-4">
    <div class="bg-white rounded-3xl shadow-xl max-w-md w-full p-8 space-y-6">
      <div class="text-center">
        <p class="text-sm uppercase tracking-[0.3em] text-brand-500">Inventory Cloud</p>
        <h1 class="text-2xl font-semibold mt-2">Forgot Password</h1>
        <p class="text-slate-500">Enter your email to receive a reset link.</p>
      </div>
      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label class="text-sm font-medium text-slate-600">Email</label>
          <input
            v-model="form.email"
            type="email"
            required
            class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <button
          type="submit"
          class="w-full bg-brand-600 text-white rounded-2xl py-3 font-semibold hover:bg-brand-700 transition disabled:opacity-50"
          :disabled="state.loading"
        >
          {{ state.loading ? 'Submitting...' : 'Send Reset Link' }}
        </button>
        <p v-if="state.message" class="text-sm text-emerald-600 text-center">{{ state.message }}</p>
        <p v-if="state.error" class="text-sm text-rose-600 text-center">{{ state.error }}</p>
      </form>
    </div>
  </div>
</template>
