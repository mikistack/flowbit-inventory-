<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/utils/api';
import { useLookupStore } from '@/stores/lookups';

const lookupStore = useLookupStore();
const router = useRouter();

const state = reactive({
  loading: false,
  error: '',
});

const filters = reactive({
  search: '',
  warehouseId: 'all',
  onlyLowStock: false,
});

const inventory = ref([]);

const warehouses = computed(() => lookupStore.warehouses || []);

const loadInventory = async () => {
  state.loading = true;
  state.error = '';
  try {
    const { data } = await api.get('/inventory', { params: { limit: 1000 } });
    inventory.value = data.data || data;
  } catch (error) {
    state.error = error.response?.data?.message || 'Failed to load inventory records.';
  } finally {
    state.loading = false;
  }
};

const ensureLookups = async () => {
  await Promise.all([lookupStore.loadWarehouses(), lookupStore.loadProducts()]);
};

const filterMatch = (record) => {
  if (!record?.Product) return false;
  const needle = filters.search.trim().toLowerCase();
  if (needle) {
    const haystacks = [
      record.Product.name,
      record.Product.code,
      record.Product.sku,
      record.Product.barcodeSymbology,
    ]
      .filter(Boolean)
      .map((value) => value.toString().toLowerCase());
    if (!haystacks.some((value) => value.includes(needle))) {
      return false;
    }
  }
  if (filters.warehouseId !== 'all' && String(record.warehouseId) !== String(filters.warehouseId)) {
    return false;
  }
  if (filters.onlyLowStock) {
    const threshold = Number(record.reorderPoint) || 0;
    return Number(record.quantityOnHand) <= threshold;
  }
  return true;
};

const filteredInventory = computed(() => inventory.value.filter(filterMatch));

const startSale = (record) => {
  router.push({
    name: 'sales',
    query: {
      productId: record.productId,
      warehouseId: record.warehouseId,
    },
  });
};

const summary = computed(() => {
  const totalProducts = new Set();
  let totalQty = 0;
  let stockValue = 0;
  let lowStock = 0;

  filteredInventory.value.forEach((record) => {
    const qty = Number(record.quantityOnHand) || 0;
    const cost = Number(record.Product?.cost) || 0;
    totalProducts.add(record.productId);
    totalQty += qty;
    stockValue += qty * cost;
    const threshold = Number(record.reorderPoint) || 0;
    if (threshold > 0 && qty <= threshold) {
      lowStock += 1;
    }
  });

  return {
    totalProducts: totalProducts.size,
    totalQty,
    stockValue,
    lowStock,
  };
});

onMounted(async () => {
  await ensureLookups();
  await loadInventory();
});
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-brand-500">Inventory</p>
        <h1 class="text-2xl font-semibold">Inventory Overview</h1>
        <p class="text-slate-500 text-sm">
          Live product availability per warehouse with low-stock alerts and stock valuation.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="px-4 py-2 rounded-2xl border border-slate-200 text-sm font-medium hover:bg-slate-50"
          @click="loadInventory"
          :disabled="state.loading"
        >
          {{ state.loading ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <article class="card p-4">
        <p class="text-xs uppercase tracking-wide text-slate-500">Tracked SKUs</p>
        <p class="text-3xl font-semibold">{{ summary.totalProducts }}</p>
        <p class="text-xs text-slate-400 mt-1">Products with on-hand stock</p>
      </article>
      <article class="card p-4">
        <p class="text-xs uppercase tracking-wide text-slate-500">Total Quantity</p>
        <p class="text-3xl font-semibold">{{ summary.totalQty.toLocaleString() }}</p>
        <p class="text-xs text-slate-400 mt-1">All warehouses combined</p>
      </article>
      <article class="card p-4">
        <p class="text-xs uppercase tracking-wide text-slate-500">Stock Value (Cost)</p>
        <p class="text-3xl font-semibold">ETB {{ summary.stockValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</p>
        <p class="text-xs text-slate-400 mt-1">Quantity × landed cost</p>
      </article>
      <article class="card p-4">
        <p class="text-xs uppercase tracking-wide text-slate-500">Low Stock Alerts</p>
        <p class="text-3xl font-semibold">{{ summary.lowStock }}</p>
        <p class="text-xs text-slate-400 mt-1">At or below reorder point</p>
      </article>
    </div>

    <div class="card p-4 space-y-3">
      <div class="flex flex-col md:flex-row gap-3">
        <input
          v-model="filters.search"
          type="search"
          class="rounded-2xl border border-slate-200 px-4 py-2 flex-1"
          placeholder="Search by product name, SKU, or barcode…"
        />
        <select
          v-model="filters.warehouseId"
          class="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="all">All Warehouses</option>
          <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
            {{ warehouse.name }}
          </option>
        </select>
        <label class="inline-flex items-center gap-2 text-sm text-slate-600">
          <input v-model="filters.onlyLowStock" type="checkbox" class="rounded border-slate-300" />
          Show only low-stock
        </label>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div v-if="state.loading" class="p-6 text-center text-slate-500 text-sm">Loading inventory…</div>
      <div v-else-if="state.error" class="p-6 text-center text-rose-500 text-sm">{{ state.error }}</div>
      <div v-else-if="!filteredInventory.length" class="p-6 text-center text-slate-500 text-sm">
        No inventory records found for the selected filters.
      </div>
      <table v-else class="w-full text-sm">
        <thead class="bg-slate-50 text-slate-500">
          <tr>
            <th class="py-3 px-4 text-left font-semibold">Product</th>
            <th class="py-3 px-4 text-left font-semibold">Warehouse</th>
            <th class="py-3 px-4 text-left font-semibold">On Hand</th>
            <th class="py-3 px-4 text-left font-semibold">Reorder Point</th>
            <th class="py-3 px-4 text-left font-semibold">Value (Cost)</th>
            <th class="py-3 px-4 text-right font-semibold">Status</th>
            <th class="py-3 px-4 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in filteredInventory" :key="`${record.productId}-${record.warehouseId}`" class="border-b last:border-0">
            <td class="py-3 px-4">
              <p class="font-semibold text-slate-800">{{ record.Product?.name || 'Unnamed' }}</p>
              <p class="text-xs text-slate-500">{{ record.Product?.code || '—' }}</p>
            </td>
            <td class="py-3 px-4">{{ record.Warehouse?.name || '—' }}</td>
            <td class="py-3 px-4 font-semibold">{{ Number(record.quantityOnHand).toLocaleString() }}</td>
            <td class="py-3 px-4">{{ record.reorderPoint ?? '—' }}</td>
            <td class="py-3 px-4">
              ETB {{ (Number(record.quantityOnHand) * Number(record.Product?.cost || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 }) }}
            </td>
            <td class="py-3 px-4 text-right">
              <span
                class="px-2.5 py-1 rounded-full text-xs font-semibold"
                :class="Number(record.quantityOnHand) <= Number(record.reorderPoint || 0)
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-emerald-50 text-emerald-600'"
              >
                {{ Number(record.quantityOnHand) <= Number(record.reorderPoint || 0) ? 'Low' : 'OK' }}
              </span>
            </td>
            <td class="py-3 px-4 text-right">
              <button
                type="button"
                class="text-xs font-semibold text-brand-600"
                @click="startSale(record)"
              >
                Start Sale
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
