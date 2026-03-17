<script setup>
import { reactive, computed, onMounted } from 'vue';
import api from '@/utils/api';
import { useLookupStore } from '@/stores/lookups';

const lookupStore = useLookupStore();
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const state = reactive({
  loading: false,
  saving: false,
  error: '',
  saved: false,
  notifLoading: false,
  notifSaving: false,
  notifSuccess: false,
  notifError: '',
});

const form = reactive({
  defaultCurrency: '',
  companyName: '',
  companyPhone: '',
  footer: '',
  defaultWarehouseId: '',
  defaultCustomerId: '',
  address: '',
  logoFile: null,
});

const notificationForm = reactive({
  lowStockThreshold: 5,
  highSalesThreshold: 10000,
  highPurchaseThreshold: 10000,
  highAdditionThreshold: 100,
  csvSchedule: {
    daily: true,
    weekly: false,
    monthly: false,
    hour: 8,
  },
  opsReportSchedule: {
    daily: true,
    weekly: true,
    monthly: true,
    hour: 8,
  },
  channels: {
    inApp: true,
    telegram: {
      enabled: false,
      botToken: '',
      chatId: '',
    },
  },
});

const opsSummary = reactive({
  period: 'daily',
  loading: false,
  sending: false,
  error: '',
  data: null,
});

const availableCurrencies = computed(() => lookupStore.currencies || []);
const availableWarehouses = computed(() => lookupStore.warehouses || []);
const availableCustomers = computed(() => lookupStore.customers || []);

const handleFileChange = (event) => {
  const [file] = event.target.files || [];
  form.logoFile = file || null;
};

const fetchSettings = async () => {
  state.loading = true;
  state.error = '';
  try {
    const { data } = await api.get('/settings', { params: { limit: 200 } });
    const settings = data.data || data || [];
    const getValue = (key, fallback = null) =>
      settings.find((item) => item.key === key)?.value?.value ?? fallback;
    form.defaultCurrency = getValue('defaultCurrency', '');
    form.companyName = getValue('companyName', '');
    form.companyPhone = getValue('companyPhone', '');
    form.footer = getValue('footer', '');
    form.defaultWarehouseId = getValue('defaultWarehouseId', '');
    form.defaultCustomerId = getValue('defaultCustomerId', '');
    form.address = getValue('address', '');

  } catch (error) {
    state.error = error.response?.data?.message || 'Unable to load system settings.';
  } finally {
    state.loading = false;
  }
};

const saveSetting = async (key, value) => {
  await api.post('/settings', { key, value: { value } });
};

const saveSystemSettings = async () => {
  state.saving = true;
  state.saved = false;
  try {
    await Promise.all([
      saveSetting('defaultCurrency', form.defaultCurrency),
      saveSetting('companyName', form.companyName),
      saveSetting('companyPhone', form.companyPhone),
      saveSetting('footer', form.footer),
      saveSetting('defaultWarehouseId', form.defaultWarehouseId),
      saveSetting('defaultCustomerId', form.defaultCustomerId),
      saveSetting('address', form.address),
    ]);
    state.saved = true;
  } catch (error) {
    state.error = error.response?.data?.message || 'Failed to save system settings.';
  } finally {
    state.saving = false;
  }
};

onMounted(async () => {
  await Promise.all([
    lookupStore.loadWarehouses(),
    lookupStore.loadCustomers(),
    lookupStore.loadCurrencies(),
  ]);
  await fetchSettings();
  await loadNotificationSettings();
  await fetchOpsSummary();
});

const loadNotificationSettings = async () => {
  state.notifLoading = true;
  state.notifError = '';
  try {
    const { data } = await api.get('/settings/notification');
    notificationForm.lowStockThreshold = data.lowStockThreshold ?? 5;
    notificationForm.highSalesThreshold = Number(data.highSalesThreshold ?? 10000);
    notificationForm.highPurchaseThreshold = Number(data.highPurchaseThreshold ?? 10000);
    notificationForm.highAdditionThreshold = Number(data.highAdditionThreshold ?? 100);
    notificationForm.csvSchedule = {
      daily: Boolean(data.csvSchedule?.daily),
      weekly: Boolean(data.csvSchedule?.weekly),
      monthly: Boolean(data.csvSchedule?.monthly),
      hour: data.csvSchedule?.hour ?? 8,
    };
    notificationForm.opsReportSchedule = {
      daily: data.opsReportSchedule?.daily ?? true,
      weekly: data.opsReportSchedule?.weekly ?? true,
      monthly: data.opsReportSchedule?.monthly ?? true,
      hour: data.opsReportSchedule?.hour ?? data.csvSchedule?.hour ?? 8,
    };
    notificationForm.channels = {
      inApp: data.channels?.inApp !== false,
      telegram: {
        enabled: Boolean(data.channels?.telegram?.enabled),
        botToken: data.channels?.telegram?.botToken || '',
        chatId: data.channels?.telegram?.chatId || '',
      },
    };
  } catch (error) {
    state.notifError = error.response?.data?.message || 'Unable to load notification settings.';
  } finally {
    state.notifLoading = false;
  }
};

const saveNotificationSettings = async () => {
  state.notifSaving = true;
  state.notifSuccess = false;
  state.notifError = '';
  try {
    await api.put('/settings/notification', {
      lowStockThreshold: notificationForm.lowStockThreshold,
      highSalesThreshold: notificationForm.highSalesThreshold,
      highPurchaseThreshold: notificationForm.highPurchaseThreshold,
      highAdditionThreshold: notificationForm.highAdditionThreshold,
      csvSchedule: { ...notificationForm.csvSchedule },
      opsReportSchedule: { ...notificationForm.opsReportSchedule },
      channels: {
        inApp: notificationForm.channels.inApp,
        telegram: { ...notificationForm.channels.telegram },
      },
    });
    state.notifSuccess = true;
  } catch (error) {
    state.notifError = error.response?.data?.message || 'Failed to save notification settings.';
  } finally {
    state.notifSaving = false;
  }
};

const fetchOpsSummary = async () => {
  opsSummary.loading = true;
  opsSummary.error = '';
  try {
    const { data } = await api.get('/reports/ops-summary', { params: { period: opsSummary.period } });
    opsSummary.data = data;
  } catch (error) {
    opsSummary.error = error.response?.data?.message || 'Unable to load summary.';
  } finally {
    opsSummary.loading = false;
  }
};

const sendOpsSummaryNotification = async () => {
  opsSummary.sending = true;
  opsSummary.error = '';
  try {
    await api.post('/reports/ops-summary/notify', { period: opsSummary.period });
    await fetchOpsSummary();
  } catch (error) {
    opsSummary.error = error.response?.data?.message || 'Unable to dispatch summary.';
  } finally {
    opsSummary.sending = false;
  }
};
</script>

<template>
  <section class="space-y-6">
    <header>
      <p class="text-sm uppercase tracking-[0.3em] text-brand-500">Settings</p>
      <h1 class="text-2xl font-semibold">System Settings</h1>
      <p class="text-slate-500 text-sm">
        Configure company profile, defaults, and integration credentials.
      </p>
    </header>

    <p v-if="state.error" class="text-sm text-rose-600">{{ state.error }}</p>
    <p v-if="state.saved" class="text-sm text-emerald-600">Settings updated successfully.</p>

    <div class="card p-6 space-y-4">
      <h2 class="text-lg font-semibold">Company & Defaults</h2>
      <div v-if="state.loading" class="text-sm text-slate-500">Loading settings…</div>
      <form v-else class="grid gap-4 md:grid-cols-3">
        <label class="text-sm text-slate-600 flex flex-col gap-1">
          Default Currency
          <select v-model="form.defaultCurrency" class="input">
            <option value="">Select currency</option>
            <option v-for="currency in availableCurrencies" :key="currency.id" :value="currency.code">
              {{ currency.name }} ({{ currency.code }})
            </option>
          </select>
        </label>
        <div></div>
        <div></div>
        <label class="text-sm text-slate-600 flex flex-col gap-1">
          Company Name
          <input v-model="form.companyName" type="text" class="input" />
        </label>
        <label class="text-sm text-slate-600 flex flex-col gap-1">
          Company Phone
          <input v-model="form.companyPhone" type="text" class="input" />
        </label>
        <label class="text-sm text-slate-600 flex flex-col gap-1">
          Footer Text
          <input v-model="form.footer" type="text" class="input" />
        </label>
        <label class="text-sm text-slate-600 flex flex-col gap-1">
          Default Customer
          <select v-model="form.defaultCustomerId" class="input">
            <option value="">Choose Customer</option>
            <option v-for="customer in availableCustomers" :key="customer.id" :value="customer.id">
              {{ customer.name }}
            </option>
          </select>
        </label>
        <label class="text-sm text-slate-600 flex flex-col gap-1">
          Default Warehouse
          <select v-model="form.defaultWarehouseId" class="input">
            <option value="">Choose Warehouse</option>
            <option v-for="warehouse in availableWarehouses" :key="warehouse.id" :value="warehouse.id">
              {{ warehouse.name }} ({{ warehouse.type === 'storage' ? 'Storage' : 'Store' }})
            </option>
          </select>
        </label>
        <label class="text-sm text-slate-600 flex flex-col gap-1 md:col-span-2">
          Address
          <textarea v-model="form.address" rows="2" class="input" />
        </label>
        <div class="md:col-span-3">
          <button type="button" class="btn-primary" :disabled="state.saving" @click="saveSystemSettings">
            {{ state.saving ? 'Saving…' : 'Save System Settings' }}
          </button>
        </div>
      </form>
    </div>
    <div class="card p-6 space-y-4">
      <h2 class="text-lg font-semibold">Alerts & Notifications</h2>
      <p class="text-sm text-slate-500">
        Configure low-stock alerts, high-value sales/purchase notifications, and CSV report schedules.
      </p>
      <p v-if="state.notifError" class="text-sm text-rose-600">{{ state.notifError }}</p>
      <p v-if="state.notifSuccess" class="text-sm text-emerald-600">Notification settings saved.</p>
      <div v-if="state.notifLoading" class="text-sm text-slate-500">Loading notification settings…</div>
      <form v-else class="grid gap-4 md:grid-cols-3">
        <label class="text-sm text-slate-600 flex flex-col gap-1">
          Low Stock Alert Threshold
          <input
            v-model.number="notificationForm.lowStockThreshold"
            type="number"
            min="1"
            class="input"
          />
        </label>
        <label class="text-sm text-slate-600 flex flex-col gap-1">
          High Sales Alert (Amount)
          <input
            v-model.number="notificationForm.highSalesThreshold"
            type="number"
            min="0"
            class="input"
          />
        </label>
        <label class="text-sm text-slate-600 flex flex-col gap-1">
          High Purchase Alert (Amount)
          <input
            v-model.number="notificationForm.highPurchaseThreshold"
            type="number"
            min="0"
            class="input"
          />
        </label>
        <label class="text-sm text-slate-600 flex flex-col gap-1">
          High Stock Intake Alert (Quantity)
          <input
            v-model.number="notificationForm.highAdditionThreshold"
            type="number"
            min="0"
            class="input"
          />
        </label>
        <div class="md:col-span-3 space-y-2">
          <p class="text-sm font-semibold text-slate-600">CSV Report Schedule</p>
          <div class="flex flex-wrap gap-3">
            <label class="flex items-center gap-2 text-sm text-slate-600">
              <input v-model="notificationForm.csvSchedule.daily" type="checkbox" /> Daily
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-600">
              <input v-model="notificationForm.csvSchedule.weekly" type="checkbox" /> Weekly
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-600">
              <input v-model="notificationForm.csvSchedule.monthly" type="checkbox" /> Monthly
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-600">
              Send at
              <select v-model.number="notificationForm.csvSchedule.hour" class="input w-24">
                <option v-for="hour in 24" :key="hour" :value="hour - 1">
                  {{ (hour - 1).toString().padStart(2, '0') }}:00
                </option>
              </select>
            </label>
          </div>
        </div>
        <div class="md:col-span-3 space-y-2">
          <p class="text-sm font-semibold text-slate-600">Operations Summary Schedule</p>
          <p class="text-xs text-slate-500">
            Automatically deliver worker stats and low-stock snapshots to admins.
          </p>
          <div class="flex flex-wrap gap-3">
            <label class="flex items-center gap-2 text-sm text-slate-600">
              <input v-model="notificationForm.opsReportSchedule.daily" type="checkbox" /> Daily
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-600">
              <input v-model="notificationForm.opsReportSchedule.weekly" type="checkbox" /> Weekly
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-600">
              <input v-model="notificationForm.opsReportSchedule.monthly" type="checkbox" /> Monthly
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-600">
              Send at
              <select v-model.number="notificationForm.opsReportSchedule.hour" class="input w-24">
                <option v-for="hour in 24" :key="hour" :value="hour - 1">
                  {{ (hour - 1).toString().padStart(2, '0') }}:00
                </option>
              </select>
            </label>
          </div>
        </div>
        <div class="md:col-span-3 space-y-2">
          <p class="text-sm font-semibold text-slate-600">Channels</p>
          <label class="flex items-center gap-2 text-sm text-slate-600">
            <input v-model="notificationForm.channels.inApp" type="checkbox" /> In-app notifications
          </label>
          <label class="flex items-center gap-2 text-sm text-slate-600">
            <input v-model="notificationForm.channels.telegram.enabled" type="checkbox" /> Telegram bot
          </label>
          <div
            v-if="notificationForm.channels.telegram.enabled"
            class="grid gap-4 md:grid-cols-2 border border-slate-100 rounded-2xl p-4"
          >
            <label class="text-sm text-slate-600 flex flex-col gap-1">
              Bot Token
              <input
                v-model="notificationForm.channels.telegram.botToken"
                type="text"
                class="input"
                placeholder="12345:ABC..."
              />
            </label>
            <label class="text-sm text-slate-600 flex flex-col gap-1">
              Default Chat ID / Channel
              <input
                v-model="notificationForm.channels.telegram.chatId"
                type="text"
                class="input"
                placeholder="@inventory_alerts"
              />
            </label>
            <p class="text-xs text-slate-500 md:col-span-2">
              Configure your bot webhook in Telegram to point at <code>{{ API_BASE }}</code>/integrations/telegram/webhook.
              Admins can update each user's chat ID under People → Users.
            </p>
          </div>
        </div>
        <div class="md:col-span-3">
          <button
            type="button"
            class="btn-primary"
            :disabled="state.notifSaving"
            @click="saveNotificationSettings"
          >
            {{ state.notifSaving ? 'Saving…' : 'Save Notification Settings' }}
          </button>
        </div>
      </form>
    </div>
    <div class="card p-6 space-y-4">
      <h2 class="text-lg font-semibold">Operations Summary</h2>
      <p class="text-sm text-slate-500">
        Preview the worker roster and low-stock items and send scheduled digests to admins.
      </p>
      <div class="flex flex-wrap gap-3 items-center">
        <label class="text-sm text-slate-600 flex items-center gap-2">
          Period
          <select v-model="opsSummary.period" class="input w-32">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <button type="button" class="btn-secondary" :disabled="opsSummary.loading" @click="fetchOpsSummary">
          {{ opsSummary.loading ? 'Refreshing…' : 'Refresh Preview' }}
        </button>
        <button
          type="button"
          class="btn-primary"
          :disabled="opsSummary.sending"
          @click="sendOpsSummaryNotification"
        >
          {{ opsSummary.sending ? 'Sending…' : 'Send To Admins' }}
        </button>
      </div>
      <p v-if="opsSummary.error" class="text-sm text-rose-600">{{ opsSummary.error }}</p>
      <div v-if="opsSummary.data" class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <article class="rounded-2xl border border-slate-100 p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">Sales</p>
            <p class="text-2xl font-semibold">
              ETB {{ Number(opsSummary.data.metrics?.sales?.total || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }}
            </p>
            <p class="text-xs text-slate-500">{{ opsSummary.data.metrics?.sales?.count || 0 }} records</p>
          </article>
          <article class="rounded-2xl border border-slate-100 p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">Purchases</p>
            <p class="text-2xl font-semibold">
              ETB {{
                Number(opsSummary.data.metrics?.purchases?.total || 0).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })
              }}
            </p>
            <p class="text-xs text-slate-500">{{ opsSummary.data.metrics?.purchases?.count || 0 }} records</p>
          </article>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <p class="text-sm font-semibold text-slate-700">Active Workers</p>
            <ul class="space-y-1 max-h-48 overflow-y-auto text-sm text-slate-600">
              <li
                v-for="worker in opsSummary.data.workers.slice(0, 6)"
                :key="worker.id"
                class="rounded-xl border border-slate-100 px-3 py-2"
              >
                <p class="font-semibold text-slate-800">{{ worker.name }}</p>
                <p class="text-xs text-slate-500">
                  {{ worker.role }} · {{ worker.status }} · {{ worker.warehouse || 'Unassigned' }}
                </p>
              </li>
              <li v-if="!opsSummary.data.workers.length" class="text-xs text-slate-500">No workers found.</li>
            </ul>
          </div>
          <div class="space-y-2">
            <p class="text-sm font-semibold text-slate-700">
              Low-stock Items ({{ opsSummary.data.lowStock.length }})
            </p>
            <ul class="space-y-1 max-h-48 overflow-y-auto text-sm text-slate-600">
              <li
                v-for="record in opsSummary.data.lowStock"
                :key="`${record.productId}-${record.warehouse}`"
                class="rounded-xl border border-rose-100 px-3 py-2"
              >
                <p class="font-semibold text-slate-800">{{ record.product }}</p>
                <p class="text-xs text-slate-500">
                  {{ record.warehouse || '—' }} · Qty {{ record.quantity }} (Alert {{ record.reorderPoint }})
                </p>
              </li>
              <li v-if="!opsSummary.data.lowStock.length" class="text-xs text-slate-500">No low-stock items 🎉</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.card {
  @apply rounded-3xl border border-slate-100 bg-white shadow-sm;
}
.input {
  @apply rounded-2xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-200;
}
.btn-primary {
  @apply px-4 py-2 rounded-2xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50;
}
.btn-secondary {
  @apply px-4 py-2 rounded-2xl border border-slate-200 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50;
}
</style>
