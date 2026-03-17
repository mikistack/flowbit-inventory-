<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import api from '@/utils/api';
import { useLookupStore } from '@/stores/lookups';
import ProductSearchSelect from '@/components/products/ProductSearchSelect.vue';

const lookupStore = useLookupStore();

const records = ref([]);
const status = reactive({ loading: false, error: '', success: '' });

const form = reactive({
  reference: '',
  warehouseId: '',
  note: '',
});

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const createLine = (overrides = {}) => ({
  uid: uid(),
  productId: '',
  quantity: '',
  type: 'addition',
  ...overrides,
});

const lineItems = ref([createLine()]);

const warehouses = computed(() => lookupStore.warehouses);
const products = computed(() => lookupStore.products);

const addLine = () => {
  lineItems.value.push(createLine());
};

const removeLine = (index) => {
  if (lineItems.value.length === 1) return;
  lineItems.value.splice(index, 1);
};

const resetForm = () => {
  form.reference = `ADJ-${Date.now()}`;
  form.warehouseId = warehouses.value[0]?.id || '';
  form.note = '';
  lineItems.value = [
    createLine({
      productId: products.value[0]?.id || '',
    }),
  ];
};

const fetchRecords = async () => {
  const { data } = await api.get('/adjustments', { params: { limit: 10 } });
  records.value = data.data || data;
};

const normalizeLine = (item) => ({
  productId: item.productId,
  quantity: Number(item.quantity) || 0,
  type: item.type,
});

const submit = async () => {
  status.loading = true;
  status.error = '';
  try {
    const payload = {
      reference: form.reference,
      warehouseId: form.warehouseId,
      note: form.note,
      items: lineItems.value.filter((item) => item.productId).map(normalizeLine).filter((item) => item.quantity > 0),
    };
    if (!payload.items.length) {
      status.error = 'Add at least one product line.';
      status.loading = false;
      return;
    }
    await api.post('/adjustments', payload);
    status.success = 'Adjustment recorded.';
    await fetchRecords();
    resetForm();
    setTimeout(() => (status.success = ''), 2000);
  } catch (error) {
    status.error = error.response?.data?.message || 'Failed to save adjustment.';
  } finally {
    status.loading = false;
  }
};

const handleProductPicked = (item, product) => {
  if (!product) return;
  item.productId = product.id;
};

const loadLookups = async () => {
  await Promise.all([lookupStore.loadProducts(), lookupStore.loadWarehouses()]);
  if (!form.reference) resetForm();
};

onMounted(async () => {
  await loadLookups();
  await fetchRecords();
});
</script>

<template>
  <section class="space-y-6">
    <header>
      <p class="text-sm uppercase tracking-[0.3em] text-brand-500">Inventory</p>
      <h1 class="text-2xl font-semibold">Adjustments</h1>
      <p class="text-slate-500 text-sm">Manually add or subtract stock from a warehouse.</p>
    </header>

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="card p-6 space-y-4">
        <h2 class="text-lg font-semibold">New Adjustment</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="text-sm text-slate-600">
            Reference
            <input v-model="form.reference" type="text" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" />
          </label>
          <label class="text-sm text-slate-600">
            Warehouse
            <select v-model="form.warehouseId" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2">
              <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">{{ warehouse.name }}</option>
            </select>
          </label>
          <label class="text-sm text-slate-600 col-span-full">
            Note
            <textarea v-model="form.note" rows="2" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" />
          </label>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">Lines</h3>
            <button type="button" class="text-sm text-brand-600 font-semibold" @click="addLine">+ Add Product</button>
          </div>
          <table class="w-full text-sm border border-slate-100 rounded-2xl overflow-hidden">
            <thead class="bg-slate-50 text-slate-500">
              <tr>
                <th class="py-2 px-3 text-left">Product</th>
                <th class="py-2 px-3 text-left">Qty</th>
                <th class="py-2 px-3 text-left">Type</th>
                <th class="py-2 px-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in lineItems" :key="item.uid" class="border-t">
                <td class="py-2 px-3">
                  <ProductSearchSelect
                    :products="products"
                    v-model="item.productId"
                    label="Product"
                    placeholder="Search product"
                    @selected="(product) => handleProductPicked(item, product)"
                  />
                </td>
                <td class="py-2 px-3">
                  <input v-model.number="item.quantity" type="number" min="1" class="w-full rounded-xl border border-slate-200 px-2 py-1" />
                </td>
                <td class="py-2 px-3">
                  <select v-model="item.type" class="w-full rounded-xl border border-slate-200 px-2 py-1">
                    <option value="addition">Add</option>
                    <option value="subtraction">Subtract</option>
                  </select>
                </td>
                <td class="py-2 px-3 text-right">
                  <button type="button" class="text-xs text-rose-500" @click="removeLine(index)">Remove</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex gap-3">
          <button
            type="button"
            class="px-4 py-2 rounded-2xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
            :disabled="status.loading"
            @click="submit"
          >
            {{ status.loading ? 'Saving...' : 'Save Adjustment' }}
          </button>
          <button type="button" class="px-4 py-2 rounded-2xl border border-slate-200 text-sm" @click="resetForm">Reset</button>
        </div>

        <p v-if="status.error" class="text-sm text-rose-500">{{ status.error }}</p>
        <p v-if="status.success" class="text-sm text-emerald-600">{{ status.success }}</p>
      </div>

      <div class="card p-6 space-y-3">
        <h2 class="text-lg font-semibold">Recent Adjustments</h2>
        <p v-if="!records.length" class="text-sm text-slate-500">No adjustments recorded yet.</p>
        <table v-else class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="py-2 px-3 text-left">Reference</th>
              <th class="py-2 px-3 text-left">Warehouse</th>
              <th class="py-2 px-3 text-left">Lines</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="adjustment in records" :key="adjustment.id" class="border-b">
              <td class="py-2 px-3">
                <p class="font-semibold">{{ adjustment.reference }}</p>
                <p class="text-xs text-slate-500">{{ new Date(adjustment.date).toLocaleDateString() }}</p>
              </td>
              <td class="py-2 px-3">{{ adjustment.Warehouse?.name || '—' }}</td>
              <td class="py-2 px-3">{{ adjustment.items?.length || 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
