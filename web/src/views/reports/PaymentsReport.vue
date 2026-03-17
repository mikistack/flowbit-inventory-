<script setup>
import { reactive, ref } from 'vue';
import api from '@/utils/api';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

const tabs = [
  { label: 'Purchase Payments', key: 'purchasePayments' },
  { label: 'Sales Payments', key: 'salePayments' },
  { label: 'Sales Return Payments', key: 'saleReturnPayments' },
  { label: 'Purchase Return Payments', key: 'purchaseReturnPayments' },
];

const state = reactive({
  loading: false,
  error: null,
  data: {
    purchasePayments: [],
    salePayments: [],
    saleReturnPayments: [],
    purchaseReturnPayments: [],
  },
});

const activeTab = ref(tabs[0].key);

const fetchData = async () => {
  state.loading = true;
  state.error = null;
  try {
    const { data } = await api.get('/reports/payments');
    state.data = data;
  } catch (error) {
    state.error = error?.response?.data?.message || 'Failed to load payments';
  } finally {
    state.loading = false;
  }
};

fetchData();

const exportPaymentsToCsv = () => {
  try {
    const rows = state.data[activeTab.value] || [];
    const csv = Papa.unparse(rows, { skipEmptyLines: true });
    saveAs(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      `payments-${activeTab.value}-${new Date().toISOString().slice(0, 10)}.csv`,
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
      <h1 class="text-2xl font-semibold">Payments</h1>
    </header>

    <div class="card p-4">
      <div class="flex flex-wrap gap-2 items-center">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="px-4 py-2 rounded-2xl text-sm font-medium border"
          :class="activeTab === tab.key ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200'"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
        <button type="button" class="ml-auto px-4 py-2 rounded-2xl border border-slate-200 text-sm font-medium" @click="exportPaymentsToCsv">
          Export CSV
        </button>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div v-if="state.loading" class="p-6 text-center text-sm text-slate-500">Loading payments...</div>
      <div v-else-if="state.error" class="p-6 text-center text-sm text-rose-500">{{ state.error }}</div>
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-slate-500">
          <tr>
            <th class="py-3 px-4 text-left">Date</th>
            <th class="py-3 px-4 text-left">Reference</th>
            <th class="py-3 px-4 text-left">Linked Record</th>
            <th class="py-3 px-4 text-left">Partner</th>
            <th class="py-3 px-4 text-left">Paid By</th>
            <th class="py-3 px-4 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="payment in state.data[activeTab] || []"
            :key="payment.id"
            class="border-b last:border-0 text-slate-700"
          >
            <td class="py-3 px-4">{{ payment.date }}</td>
            <td class="py-3 px-4">{{ payment.reference }}</td>
            <td class="py-3 px-4">{{ payment.related }}</td>
            <td class="py-3 px-4">{{ payment.partner }}</td>
            <td class="py-3 px-4">{{ payment.paidBy }}</td>
            <td class="py-3 px-4 text-right">{{ payment.amount }}</td>
          </tr>
          <tr v-if="!state.loading && (state.data[activeTab] || []).length === 0">
            <td colspan="6" class="py-4 px-4 text-center text-slate-500">No payments recorded.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
