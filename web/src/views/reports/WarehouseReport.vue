<script setup>
import { reactive, ref } from 'vue';
import api from '@/utils/api';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

const warehouses = ref([{ label: 'All Warehouses', value: 'all' }]);
const selectedWarehouse = ref('all');

const cards = ref([]);

const state = reactive({
  loading: false,
  error: null,
});

const fetchWarehouses = async () => {
  try {
    const { data } = await api.get('/warehouses');
    const rows = data.data || data;
    warehouses.value = [
      { label: 'All Warehouses', value: 'all' },
      ...rows.map((warehouse) => ({ label: warehouse.name, value: warehouse.id })),
    ];
  } catch (error) {
    console.error(error);
  }
};

const fetchReport = async () => {
  state.loading = true;
  state.error = null;
  try {
    const params = selectedWarehouse.value === 'all' ? {} : { warehouseId: selectedWarehouse.value };
    const { data } = await api.get('/reports/warehouse', { params });
    cards.value = Object.entries(data.cards || {}).map(([key, value]) => ({
      label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
      value,
    }));
  } catch (error) {
    state.error = error?.response?.data?.message || 'Unable to load report';
  } finally {
    state.loading = false;
  }
};

fetchWarehouses();
fetchReport();

const exportWarehouseToCsv = () => {
  if (!cards.value.length) return;
  try {
    const rows = cards.value.map((card) => ({ Metric: card.label, Value: card.value }));
    const suffix = selectedWarehouse.value === 'all' ? 'all' : selectedWarehouse.value;
    const csv = Papa.unparse(rows, { skipEmptyLines: true });
    saveAs(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      `warehouse-report-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  } catch (error) {
    state.error = 'Failed to export CSV file.';
    setTimeout(() => (state.error = null), 2000);
  }
};
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-brand-500">Reports</p>
        <h1 class="text-2xl font-semibold">Warehouse Report</h1>
      </div>
      <div class="flex items-center gap-3">
        <select
          v-model="selectedWarehouse"
          class="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          @change="fetchReport"
        >
          <option v-for="warehouse in warehouses" :key="warehouse.value" :value="warehouse.value">
            {{ warehouse.label }}
          </option>
        </select>
        <button type="button" class="px-4 py-2 rounded-2xl border border-slate-200 text-sm font-medium" @click="exportWarehouseToCsv">
          Export CSV
        </button>
      </div>
    </header>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <article v-for="card in cards" :key="card.label" class="card p-4">
        <p class="text-sm text-slate-500">{{ card.label }}</p>
        <p class="text-2xl font-semibold mt-2">
          <span v-if="state.loading">...</span>
          <span v-else>{{ card.value }}</span>
        </p>
      </article>
    </div>
    <p v-if="state.error" class="text-sm text-rose-500">{{ state.error }}</p>

    <div class="card p-4">
      <div class="flex gap-3 flex-wrap text-sm">
        <button type="button" class="px-3 py-2 rounded-xl bg-slate-900 text-white">Quotations</button>
        <button type="button" class="px-3 py-2 rounded-xl border border-slate-200">Sales</button>
        <button type="button" class="px-3 py-2 rounded-xl border border-slate-200">Sales Return</button>
        <button type="button" class="px-3 py-2 rounded-xl border border-slate-200">Purchases Return</button>
        <button type="button" class="px-3 py-2 rounded-xl border border-slate-200">Expenses</button>
      </div>
    </div>
  </section>
</template>
