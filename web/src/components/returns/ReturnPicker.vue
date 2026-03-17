<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import api from '@/utils/api';

const props = defineProps({
  type: {
    type: String,
    default: 'sale', // 'sale' or 'purchase'
  },
});

const emit = defineEmits(['selected']);

const state = reactive({
  loading: false,
  error: '',
});

const filters = reactive({
  partner: '',
  status: 'any',
  minTotal: '',
  maxTotal: '',
  minQuantity: '',
  productSearch: '',
});

const transactions = ref([]);

const endpoint = computed(() => (props.type === 'purchase' ? '/purchases' : '/sales'));
const partnerLabel = computed(() => (props.type === 'purchase' ? 'Supplier' : 'Customer'));

const fetchTransactions = async () => {
  state.loading = true;
  state.error = '';
  try {
    const { data } = await api.get(endpoint.value, { params: { limit: 200 } });
    transactions.value = data.data || data || [];
  } catch (error) {
    state.error = error.response?.data?.message || 'Unable to load transactions.';
  } finally {
    state.loading = false;
  }
};

const normalizeTotal = (tx) => {
  const paid = Number(tx.paid || 0);
  const due = Number(tx.due || 0);
  const shipping = Number(tx.shipping || 0);
  const discount = Number(tx.discount || 0);
  const tax = Number(tx.orderTax || 0);
  return paid + due + shipping + tax - discount;
};

const normalizeQuantity = (tx) =>
  (tx.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);

const matchesFilters = (tx) => {
  if (filters.status !== 'any' && tx.status !== filters.status) return false;
  if (filters.partner) {
    const needle = filters.partner.toLowerCase();
    const name =
      props.type === 'purchase'
        ? tx.Supplier?.name || tx.Supplier?.code
        : tx.Customer?.name || tx.Customer?.code;
    if (!name || !name.toLowerCase().includes(needle)) return false;
  }
  const total = normalizeTotal(tx);
  const quantity = normalizeQuantity(tx);
  if (filters.minTotal && total < Number(filters.minTotal)) return false;
  if (filters.maxTotal && total > Number(filters.maxTotal)) return false;
  if (filters.minQuantity && quantity < Number(filters.minQuantity)) return false;
  if (filters.productSearch) {
    const term = filters.productSearch.toLowerCase();
    const hasProduct = (tx.items || []).some((item) => {
      const product = item.Product || item.product || {};
      return (
        product.name?.toLowerCase().includes(term) ||
        product.code?.toLowerCase().includes(term)
      );
    });
    if (!hasProduct) return false;
  }
  return true;
};

const filteredTransactions = computed(() =>
  transactions.value.filter(matchesFilters).slice(0, 25),
);

const selectTransaction = (tx) => {
  emit('selected', {
    id: tx.id,
    reference: tx.reference,
    customerId: tx.customerId,
    supplierId: tx.supplierId,
    warehouseId: tx.warehouseId,
    total: normalizeTotal(tx),
    status: tx.status,
    date: tx.date || tx.createdAt,
    partnerName:
      props.type === 'purchase'
        ? tx.Supplier?.name || tx.Supplier?.code
        : tx.Customer?.name || tx.Customer?.code,
  });
};

onMounted(() => {
  fetchTransactions();
});
</script>

<template>
  <div class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div class="flex items-center justify-between">
      <p class="text-sm font-semibold text-slate-700">
        Find {{ props.type === 'purchase' ? 'purchase' : 'sale' }} to return
      </p>
      <button type="button" class="text-xs text-brand-600 font-semibold" @click="fetchTransactions">
        Refresh
      </button>
    </div>
    <div class="grid gap-3 md:grid-cols-3">
      <label class="text-xs text-slate-500 flex flex-col gap-1">
        {{ partnerLabel }} name
        <input v-model="filters.partner" type="search" class="rounded-xl border border-slate-200 px-3 py-2" />
      </label>
      <label class="text-xs text-slate-500 flex flex-col gap-1">
        Status
        <select v-model="filters.status" class="rounded-xl border border-slate-200 px-3 py-2">
          <option value="any">Any</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
      </label>
      <label class="text-xs text-slate-500 flex flex-col gap-1">
        Min total
        <input v-model.number="filters.minTotal" type="number" class="rounded-xl border border-slate-200 px-3 py-2" />
      </label>
      <label class="text-xs text-slate-500 flex flex-col gap-1">
        Max total
        <input v-model.number="filters.maxTotal" type="number" class="rounded-xl border border-slate-200 px-3 py-2" />
      </label>
      <label class="text-xs text-slate-500 flex flex-col gap-1">
        Min quantity
        <input v-model.number="filters.minQuantity" type="number" class="rounded-xl border border-slate-200 px-3 py-2" />
      </label>
      <label class="text-xs text-slate-500 flex flex-col gap-1">
        Product code or name
        <input v-model="filters.productSearch" type="search" class="rounded-xl border border-slate-200 px-3 py-2" />
      </label>
    </div>
    <p v-if="state.loading" class="text-xs text-slate-500">Loading {{ props.type }} data…</p>
    <p v-if="state.error" class="text-xs text-rose-600">{{ state.error }}</p>
    <div v-if="!state.loading" class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead class="bg-white text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left">Reference</th>
            <th class="px-3 py-2 text-left">{{ partnerLabel }}</th>
            <th class="px-3 py-2 text-left">Total</th>
            <th class="px-3 py-2 text-left">Status</th>
            <th class="px-3 py-2 text-left">Date</th>
            <th class="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tx in filteredTransactions" :key="tx.id" class="border-t border-slate-100">
            <td class="px-3 py-2 font-semibold text-slate-800">{{ tx.reference }}</td>
            <td class="px-3 py-2">{{ props.type === 'purchase' ? tx.Supplier?.name : tx.Customer?.name }}</td>
            <td class="px-3 py-2">ETB {{ normalizeTotal(tx).toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</td>
            <td class="px-3 py-2 capitalize">{{ tx.status }}</td>
            <td class="px-3 py-2">{{ new Date(tx.createdAt).toLocaleString() }}</td>
            <td class="px-3 py-2 text-right">
              <button type="button" class="text-brand-600 font-semibold" @click="selectTransaction(tx)">Select</button>
            </td>
          </tr>
          <tr v-if="!filteredTransactions.length">
            <td colspan="6" class="px-3 py-3 text-center text-slate-500">No transactions match your filters.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
