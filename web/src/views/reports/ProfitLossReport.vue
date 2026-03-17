<script setup>
import { computed, reactive, ref } from 'vue';
import api from '@/utils/api';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

const filters = reactive({
  range: 'last30',
  customFrom: '',
  customTo: '',
});

const summary = ref({
  sales: 0,
  purchases: 0,
  salesReturns: 0,
  purchaseReturns: 0,
  expenses: 0,
  profit: 0,
  paymentsReceived: 0,
  paymentsSent: 0,
  paymentsNet: 0,
});

const state = reactive({
  loading: false,
  error: null,
});

const cards = computed(() => [
  { label: 'Sales', value: summary.value.sales },
  { label: 'Purchases', value: summary.value.purchases },
  { label: 'Sales Return', value: summary.value.salesReturns },
  { label: 'Purchase Return', value: summary.value.purchaseReturns },
  { label: 'Expenses', value: summary.value.expenses },
  { label: 'Profit', value: summary.value.profit },
  { label: 'Payments Received', value: summary.value.paymentsReceived },
  { label: 'Payments Sent', value: summary.value.paymentsSent },
  { label: 'Payments Net', value: summary.value.paymentsNet },
]);

const fetchSummary = async () => {
  state.loading = true;
  state.error = null;
  try {
    const params = {};
    if (filters.customFrom && filters.customTo) {
      params.from = filters.customFrom;
      params.to = filters.customTo;
    } else {
      params.range = filters.range;
    }
    const { data } = await api.get('/reports/profit-loss', { params });
    summary.value = {
      paymentsReceived: data.summary?.paymentsReceived || 0,
      paymentsSent: data.summary?.paymentsSent || 0,
      paymentsNet: data.summary?.paymentsNet || 0,
      ...data.summary,
    };
  } catch (error) {
    state.error = error?.response?.data?.message || 'Unable to load summary';
  } finally {
    state.loading = false;
  }
};

fetchSummary();

const exportSummaryToCsv = () => {
  try {
    const rows = cards.value.map((card) => ({
      Metric: card.label,
      Value: card.value,
    }));
    const csv = Papa.unparse(rows, { skipEmptyLines: true });
    saveAs(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      `profit-loss-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  } catch (error) {
    state.error = 'Failed to export CSV file.';
    setTimeout(() => (state.error = null), 2000);
  }
};
</script>

<template>
  <section class="space-y-6">
    <header>
      <p class="text-sm uppercase tracking-[0.3em] text-brand-500">Reports</p>
      <h1 class="text-2xl font-semibold">Profit & Loss</h1>
    </header>
    <div class="card p-4 flex flex-wrap gap-3">
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="option in [
            { label: 'Today', value: 'today' },
            { label: 'Last 7 days', value: 'last7' },
            { label: 'Last 30 days', value: 'last30' },
            { label: 'Last 90 days', value: 'last90' },
            { label: 'Year', value: 'ytd' },
          ]"
          :key="option.value"
          type="button"
          class="px-4 py-2 rounded-2xl border text-sm font-medium"
          :class="filters.range === option.value ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200'"
          @click="filters.range = option.value"
        >
          {{ option.label }}
        </button>
      </div>
      <div class="flex gap-3 items-center ml-auto">
        <label class="text-sm text-slate-500 font-medium">Custom From</label>
        <input type="date" v-model="filters.customFrom" class="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <label class="text-sm text-slate-500 font-medium">To</label>
        <input type="date" v-model="filters.customTo" class="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <div class="flex gap-2">
          <button type="button" class="px-4 py-2 rounded-2xl bg-brand-600 text-white font-semibold text-sm" @click="fetchSummary">
            Apply
          </button>
          <button type="button" class="px-4 py-2 rounded-2xl border border-slate-200 text-sm font-medium" @click="exportSummaryToCsv">
            Export CSV
          </button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <article v-for="card in cards" :key="card.label" class="card p-4">
        <p class="text-sm text-slate-500">{{ card.label }}</p>
        <p class="text-xl font-semibold mt-2">
          <span v-if="state.loading">...</span>
          <span v-else>{{ card.value }}</span>
        </p>
      </article>
    </div>
    <p v-if="state.error" class="text-sm text-rose-500">{{ state.error }}</p>
  </section>
</template>
