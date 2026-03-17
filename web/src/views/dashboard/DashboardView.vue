<script setup>
import { computed, onMounted, reactive, watch } from 'vue';
import { useRouter } from 'vue-router';
import ActionModal from '@/components/common/ActionModal.vue';
import api from '@/utils/api';
import { resolveActionConfig } from '@/utils/actions';
import { useLookupStore } from '@/stores/lookups';

const router = useRouter();
const lookupStore = useLookupStore();

const state = reactive({
  loading: true,
  error: '',
  filters: {
    warehouseId: '',
  },
  totals: {
    sales: 0,
    purchases: 0,
    profit: 0,
    expenses: 0,
    inventoryValue: 0,
    receivables: 0,
    payables: 0,
  },
  performance: {
    sales: 0,
    purchases: 0,
  },
  lowStock: [],
  transfers: [],
  reportCounts: {
    sales: 0,
    purchases: 0,
    salesReturns: 0,
    purchaseReturns: 0,
    expenses: 0,
  },
  inventoryBreakdown: [],
});

const dashboardModal = reactive({
  open: false,
  config: {},
});

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'ETB',
  maximumFractionDigits: 2,
});
const numberFormatter = new Intl.NumberFormat('en-US');

const formatCurrency = (value) => currencyFormatter.format(Number(value || 0));
const formatNumber = (value) => numberFormatter.format(Number(value || 0));

const metricCards = computed(() => [
  {
    label: 'Balance',
    value: formatCurrency(state.totals.inventoryValue),
    description: 'Current stock valuation',
  },
  {
    label: 'Sales',
    value: formatCurrency(state.totals.sales),
    description: 'Paid sales in this view',
  },
  {
    label: 'Purchases',
    value: formatCurrency(state.totals.purchases),
    description: 'Paid purchases in this view',
  },
  {
    label: 'Profit',
    value: formatCurrency(state.totals.profit),
    description: 'Sales − Purchases − Expenses',
  },
  {
    label: 'Expenses',
    value: formatCurrency(state.totals.expenses),
    description: 'Approved expenses',
  },
  {
    label: 'Customer Receivables',
    value: formatCurrency(state.totals.receivables),
    description: 'Outstanding balances owed to you',
  },
  {
    label: 'Supplier Payables',
    value: formatCurrency(state.totals.payables),
    description: 'Amounts you still owe suppliers',
  },
]);

const warehouseOptions = computed(() => [
  { label: 'All warehouses', value: '' },
  ...lookupStore.warehouses.map((warehouse) => ({ label: warehouse.name, value: String(warehouse.id) })),
]);

const selectedWarehouseLabel = computed(() => {
  if (!state.filters.warehouseId) return 'all warehouses';
  const warehouse = lookupStore.warehouses.find((w) => String(w.id) === String(state.filters.warehouseId));
  return warehouse ? warehouse.name : 'selected warehouse';
});

const performancePercents = computed(() => {
  const total = Number(state.performance.sales || 0) + Number(state.performance.purchases || 0);
  if (!total) {
    return { sales: 0, purchases: 0 };
  }
  return {
    sales: Math.round((Number(state.performance.sales || 0) / total) * 100),
    purchases: Math.round((Number(state.performance.purchases || 0) / total) * 100),
  };
});

const reportEntries = computed(() => [
  { label: 'Sales', value: state.reportCounts.sales },
  { label: 'Purchases', value: state.reportCounts.purchases },
  { label: 'Sales Returns', value: state.reportCounts.salesReturns },
  { label: 'Purchase Returns', value: state.reportCounts.purchaseReturns },
  { label: 'Expenses', value: state.reportCounts.expenses },
]);

const openQuickAction = (label, context = {}) => {
  dashboardModal.config = resolveActionConfig(label, context);
  dashboardModal.open = true;
};

const handleQuickAction = (label, context = {}) => {
  const routeMap = {
    'Record Purchase': '/purchases',
    'Record Sale': '/sales',
    'New Adjustment': '/adjustments',
    'New Transfer': '/transfers',
  };
  if (routeMap[label]) {
    router.push(routeMap[label]);
    return;
  }
  openQuickAction(label, context);
};

const fetchDashboard = async () => {
  state.loading = true;
  state.error = '';
  try {
    const params = {};
    if (state.filters.warehouseId) {
      params.warehouseId = state.filters.warehouseId;
    }
    const { data } = await api.get('/reports/dashboard-summary', { params });
    Object.assign(state.totals, data.totals || {});
    state.totals.receivables = Number(data.totals?.receivables || data.totals?.salesDue || 0);
    state.totals.payables = Number(data.totals?.payables || data.totals?.purchasesDue || 0);
    Object.assign(state.performance, data.performance || {});
    state.lowStock = data.lowStock || [];
    state.transfers = data.transfers || [];
    state.reportCounts = {
      sales: data.reportCounts?.sales || 0,
      purchases: data.reportCounts?.purchases || 0,
      salesReturns: data.reportCounts?.salesReturns || 0,
      purchaseReturns: data.reportCounts?.purchaseReturns || 0,
      expenses: data.reportCounts?.expenses || 0,
    };
    state.inventoryBreakdown = data.inventoryBreakdown || [];
  } catch (error) {
    state.error = error.response?.data?.message || error.message || 'Failed to load dashboard data.';
  } finally {
    state.loading = false;
  }
};

let hydrated = false;
onMounted(async () => {
  await lookupStore.loadWarehouses();
  await fetchDashboard();
  hydrated = true;
});

watch(
  () => state.filters.warehouseId,
  () => {
    if (!hydrated) return;
    fetchDashboard();
  },
);
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">Inventory Dashboard</h1>
        <p class="text-sm text-slate-500">
          Snapshot for
          <span class="font-semibold text-slate-700">{{ selectedWarehouseLabel }}</span>
        </p>
      </div>
      <label class="text-sm text-slate-500 flex flex-col gap-2">
        Warehouse
        <select
          v-model="state.filters.warehouseId"
          class="rounded-2xl border border-slate-200 px-4 py-2 text-slate-700"
          :disabled="state.loading && !hydrated"
        >
          <option v-for="option in warehouseOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
    </header>

    <p v-if="state.error" class="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ state.error }}
    </p>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
      <article v-for="card in metricCards" :key="card.label" class="card p-5">
        <p class="text-sm text-slate-500">{{ card.label }}</p>
        <h3 class="text-2xl font-semibold mt-2">{{ card.value }}</h3>
        <p class="text-xs text-slate-400 mt-1">{{ card.description }}</p>
      </article>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <article class="card col-span-2 p-6">
        <header class="flex items-center justify-between mb-4">
          <div>
            <p class="text-sm text-slate-500">Performance</p>
            <h3 class="text-lg font-semibold">Sales vs Purchases</h3>
            <p class="text-xs text-slate-400 mt-1">Data filtered by {{ selectedWarehouseLabel }}</p>
          </div>
        </header>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p class="text-sm text-slate-500">Sales</p>
            <p class="text-3xl font-semibold">{{ formatCurrency(state.performance.sales) }}</p>
            <div class="h-2 rounded-full bg-slate-100 mt-3">
              <div class="h-full rounded-full bg-brand-500" :style="{ width: `${performancePercents.sales}%` }"></div>
            </div>
            <p class="text-xs text-slate-400 mt-1">{{ performancePercents.sales }}% of total</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Purchases</p>
            <p class="text-3xl font-semibold">{{ formatCurrency(state.performance.purchases) }}</p>
            <div class="h-2 rounded-full bg-slate-100 mt-3">
              <div class="h-full rounded-full bg-emerald-400" :style="{ width: `${performancePercents.purchases}%` }"></div>
            </div>
            <p class="text-xs text-slate-400 mt-1">{{ performancePercents.purchases }}% of total</p>
          </div>
        </div>
      </article>
      <article class="card p-6">
        <header class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">Low Stock Alerts</h3>
          <span class="text-xs text-slate-400">Auto-updated</span>
        </header>
        <ul v-if="state.lowStock.length" class="space-y-3">
          <li v-for="item in state.lowStock" :key="item.id" class="p-3 rounded-2xl border border-slate-100">
            <p class="text-sm font-semibold">{{ item.name }}</p>
            <p class="text-xs text-slate-500">{{ item.code }} • {{ item.warehouse }}</p>
            <p class="text-xs mt-1 text-rose-500 font-medium">Qty {{ item.quantity }} / Alert {{ item.alertQuantity }}</p>
          </li>
        </ul>
        <p v-else class="text-sm text-slate-500">No low-stock alerts for this selection.</p>
      </article>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <article class="card p-6">
        <h3 class="text-lg font-semibold mb-4">Quick Links</h3>
        <div class="grid grid-cols-2 gap-3">
          <button
            type="button"
            class="rounded-2xl border border-dashed border-slate-200 py-4 text-sm font-medium"
            @click="openQuickAction('Add Product', { resource: 'products' })"
          >
            Add Product
          </button>
          <button
            type="button"
            class="rounded-2xl border border-dashed border-slate-200 py-4 text-sm font-medium"
            @click="handleQuickAction('Record Purchase')"
          >
            Record Purchase
          </button>
          <button
            type="button"
            class="rounded-2xl border border-dashed border-slate-200 py-4 text-sm font-medium"
            @click="handleQuickAction('Record Sale')"
          >
            Record Sale
          </button>
          <button
            type="button"
            class="rounded-2xl border border-dashed border-slate-200 py-4 text-sm font-medium"
            @click="openQuickAction('Generate Backup', { resource: 'backups' })"
          >
            Generate Backup
          </button>
        </div>
      </article>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <article class="card p-6">
        <header class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-semibold">Reports Snapshot</h3>
            <p class="text-xs text-slate-400">Counts respect the selected warehouse</p>
          </div>
          <button type="button" class="text-sm text-brand-600" @click="router.push({ name: 'reports-profit-loss' })">
            View reports
          </button>
        </header>
        <dl class="grid grid-cols-2 gap-4 text-sm">
          <template v-for="entry in reportEntries" :key="entry.label">
            <div class="rounded-2xl border border-slate-100 px-4 py-3">
              <dt class="text-xs uppercase tracking-wide text-slate-500">{{ entry.label }}</dt>
              <dd class="text-xl font-semibold text-slate-900">{{ formatNumber(entry.value) }}</dd>
            </div>
          </template>
        </dl>
      </article>
      <article class="card p-6">
        <header class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-semibold">Inventory by Warehouse</h3>
            <p class="text-xs text-slate-400">Sum of quantity × cost</p>
          </div>
        </header>
        <div v-if="state.inventoryBreakdown.length" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-slate-500">
                <th class="py-2">Warehouse</th>
                <th class="py-2">Quantity</th>
                <th class="py-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in state.inventoryBreakdown" :key="row.warehouseId || row.warehouse" class="border-t">
                <td class="py-2">{{ row.warehouse }}</td>
                <td class="py-2">{{ formatNumber(row.quantity) }}</td>
                <td class="py-2 text-right">{{ formatCurrency(row.stockValue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-sm text-slate-500">No inventory data available for this view.</p>
      </article>
    </div>

    <ActionModal v-model="dashboardModal.open" :config="dashboardModal.config" />
  </section>
</template>
