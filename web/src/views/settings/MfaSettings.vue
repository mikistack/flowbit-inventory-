<script setup>
import { reactive } from 'vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const state = reactive({
  loading: false,
  secret: '',
  otpauth: '',
  message: '',
  error: '',
  token: '',
});

const setupMfa = async () => {
  state.loading = true;
  state.error = '';
  state.message = '';
  try {
    const { secret, otpauth } = await authStore.setupMfa();
    state.secret = secret;
    state.otpauth = otpauth;
    state.message = 'Scan the QR code or enter the secret in your authenticator app.';
  } catch (error) {
    state.error = error.response?.data?.message || 'Failed to set up MFA.';
  } finally {
    state.loading = false;
  }
};

const disableMfa = async () => {
  state.loading = true;
  state.error = '';
  state.message = '';
  try {
    await authStore.disableMfa(state.token || undefined);
    state.message = 'MFA disabled.';
    state.secret = '';
    state.otpauth = '';
  } catch (error) {
    state.error = error.response?.data?.message || 'Failed to disable MFA.';
  } finally {
    state.loading = false;
  }
};
</script>

<template>
  <div class="card p-6 space-y-4">
    <h2 class="text-lg font-semibold">Multi-Factor Authentication</h2>
    <p class="text-sm text-slate-500">Add an extra layer of security using an authenticator app.</p>
    <div class="space-x-3">
      <button type="button" class="btn-primary" :disabled="state.loading" @click="setupMfa">
        Setup MFA
      </button>
      <input
        v-model="state.token"
        type="text"
        placeholder="MFA token to disable"
        class="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
      />
      <button type="button" class="btn-secondary" :disabled="state.loading" @click="disableMfa">
        Disable MFA
      </button>
    </div>
    <div v-if="state.otpauth" class="space-y-2">
      <p class="text-sm text-slate-600">{{ state.message }}</p>
      <div class="rounded-xl border border-dashed border-slate-300 p-4 text-sm">
        <p><strong>Secret:</strong> {{ state.secret }}</p>
        <p><strong>URL:</strong> {{ state.otpauth }}</p>
      </div>
    </div>
    <p v-if="state.error" class="text-sm text-rose-600">{{ state.error }}</p>
    <p v-if="state.message" class="text-sm text-emerald-600">{{ state.message }}</p>
  </div>
</template>
