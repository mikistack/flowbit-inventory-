<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import api from '@/utils/api';
import { useLookupStore } from '@/stores/lookups';
import ProductSearchSelect from '@/components/products/ProductSearchSelect.vue';
import ProductScanner from '@/components/products/ProductScanner.vue';

const lookupStore = useLookupStore();

const records = ref([]);
const status = reactive({ loading: false, error: '', success: '' });

const form = reactive({
  reference: '',
  fromWarehouseId: '',
  toWarehouseId: '',
  note: '',
});

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const createLine = (overrides = {}) => ({
  uid: uid(),
  productId: '',
  quantity: 1,
  price: 0,
  ...overrides,
});

const lineItems = ref([createLine()]);

const warehouses = computed(() => lookupStore.warehouses);
const products = computed(() => lookupStore.products);
const scannerStatus = reactive({ message: '' });
const quickSearchSelection = ref(null);

const ensureNumeric = (value) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
};

const updateNumericField = (item, field, value) => {
  item[field] = ensureNumeric(value);
};

const lineSubtotal = (item) => {
  const qty = ensureNumeric(item.quantity);
  const price = ensureNumeric(item.price);
  return qty * price;
};

const addLine = () => {
  const defaultProduct = products.value[0];
  lineItems.value.push(
    createLine({
      productId: defaultProduct?.id || '',
      price: defaultProduct ? ensureNumeric(defaultProduct.cost || defaultProduct.price) : 0,
    }),
  );
};

const removeLine = (index) => {
  if (lineItems.value.length === 1) return;
  lineItems.value.splice(index, 1);
};

const handleProductPicked = (item, product) => {
  if (!product) return;
  item.productId = product.id;
  item.price = ensureNumeric(product.cost || product.price);
};

const insertLineFromProduct = (product) => {
  if (!product?.id) return;
  const existing = lineItems.value.find((line) => line.productId === product.id);
  if (existing) {
    existing.quantity = ensureNumeric(existing.quantity) + 1;
    handleProductPicked(existing, product);
    return;
  }
  lineItems.value.push(
    createLine({
      productId: product.id,
      price: ensureNumeric(product.cost || product.price),
    }),
  );
};

const handleScannerDetected = async (code) => {
  scannerStatus.message = '';
  try {
    const { data } = await api.get('/products/lookup', { params: { code } });
    insertLineFromProduct(data);
  } catch (error) {
    scannerStatus.message = error.response?.data?.message || 'Product not found.';
  }
};

const handleQuickSearchSelected = (product) => {
  if (!product) return;
  insertLineFromProduct(product);
  quickSearchSelection.value = null;
};

const resetForm = () => {
  form.reference = `TRF-${Date.now()}`;
  form.fromWarehouseId = warehouses.value[0]?.id || '';
  const alternateWarehouse = warehouses.value.find((warehouse) => warehouse.id !== form.fromWarehouseId);
  form.toWarehouseId = alternateWarehouse?.id || '';
  form.note = '';
  lineItems.value = [
    createLine({
      productId: products.value[0]?.id || '',
      price: products.value[0] ? ensureNumeric(products.value[0]?.cost || products.value[0]?.price) : 0,
    }),
  ];
};

const fetchRecords = async () => {
  const { data } = await api.get('/transfers', { params: { limit: 10 } });
  records.value = data.data || data;
};

const invalidWarehouseSelection = computed(
  () => form.fromWarehouseId && form.toWarehouseId && form.fromWarehouseId === form.toWarehouseId,
);

const submit = async () => {
  status.loading = true;
  status.error = '';
  try {
    const payload = {
      reference: form.reference,
      fromWarehouseId: form.fromWarehouseId,
      toWarehouseId: form.toWarehouseId,
      note: form.note,
      items: lineItems.value
        .filter((item) => item.productId && ensureNumeric(item.quantity) > 0)
        .map((item) => ({
          productId: item.productId,
          quantity: ensureNumeric(item.quantity),
          price: ensureNumeric(item.price),
        })),
    };
    if (!payload.items.length) {
      status.error = 'Add at least one product line.';
      status.loading = false;
      return;
    }
    if (payload.fromWarehouseId === payload.toWarehouseId) {
      status.error = 'Select different source and destination warehouses.';
      status.loading = false;
      return;
    }
    await api.post('/transfers', payload);
    status.success = 'Transfer recorded.';
    await fetchRecords();
    await lookupStore.loadProducts(true);
    resetForm();
    setTimeout(() => (status.success = ''), 2000);
  } catch (error) {
    status.error = error.response?.data?.message || 'Failed to save transfer.';
  } finally {
    status.loading = false;
  }
};

const loadLookups = async () => {
  await Promise.all([lookupStore.loadProducts(), lookupStore.loadWarehouses()]);
  if (warehouses.value.length < 2) {
    status.error = 'Create at least two warehouses to transfer stock.';
  }
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
      <h1 class="text-2xl font-semibold">Transfers</h1>
      <p class="text-slate-500 text-sm">Move stock between warehouses.</p>
    </header>

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="card p-6 space-y-4">
        <h2 class="text-lg font-semibold">New Transfer</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="text-sm text-slate-600">
            Reference
            <input v-model="form.reference" type="text" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" />
          </label>
          <label class="text-sm text-slate-600">
            From
            <select v-model="form.fromWarehouseId" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2">
              <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">{{ warehouse.name }}</option>
            </select>
          </label>
          <label class="text-sm text-slate-600">
            To
            <select v-model="form.toWarehouseId" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2">
              <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">{{ warehouse.name }}</option>
            </select>
          </label>
          <label class="text-sm text-slate-600 col-span-full">
            Note
            <textarea v-model="form.note" rows="2" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" />
          </label>
        </div>

        <div v-if="warehouses.length < 2" class="rounded-2xl bg-amber-50 p-4 text-sm text-amber-700">
          Add at least two warehouses in Settings → Warehouses to create transfers.
        </div>

        <div v-else class="space-y-3">
          <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
            <div>
              <p class="text-sm font-semibold text-slate-700">Scan or search product</p>
              <p class="text-xs text-slate-500">Each scan or selection adds the product as a new line item.</p>
            </div>
            <ProductScanner @detected="handleScannerDetected" />
            <p v-if="scannerStatus.message" class="text-xs text-rose-500">{{ scannerStatus.message }}</p>
            <ProductSearchSelect
              :products="products"
              v-model="quickSearchSelection"
              label="Search products"
              placeholder="Type name or SKU"
              @selected="handleQuickSearchSelected"
            />
          </div>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">Lines</h3>
            <button type="button" class="text-sm text-brand-600 font-semibold" @click="addLine">+ Add Product</button>
          </div>
          <table class="w-full text-sm border border-slate-100 rounded-2xl overflow-hidden">
            <thead class="bg-slate-50 text-slate-500">
              <tr>
                <th class="py-2 px-3 text-left">Product</th>
                <th class="py-2 px-3 text-left">Qty</th>
                <th class="py-2 px-3 text-left">Cost</th>
                <th class="py-2 px-3 text-left">Subtotal</th>
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
                  <input
                    :value="item.quantity"
                    type="number"
                    min="1"
                    class="w-full rounded-xl border border-slate-200 px-2 py-1"
                    @input="updateNumericField(item, 'quantity', $event.target.value)"
                  />
                </td>
                <td class="py-2 px-3">
                  <input
                    :value="item.price"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full rounded-xl border border-slate-200 px-2 py-1"
                    @input="updateNumericField(item, 'price', $event.target.value)"
                  />
                </td>
                <td class="py-2 px-3">
                  ETB {{ lineSubtotal(item).toFixed(2) }}
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
            :disabled="status.loading || warehouses.length < 2 || invalidWarehouseSelection"
            @click="submit"
          >
            {{ status.loading ? 'Saving...' : 'Save Transfer' }}
          </button>
          <button type="button" class="px-4 py-2 rounded-2xl border border-slate-200 text-sm" @click="resetForm">Reset</button>
        </div>

        <p v-if="status.error" class="text-sm text-rose-500">{{ status.error }}</p>
        <p v-if="status.success" class="text-sm text-emerald-600">{{ status.success }}</p>
      </div>

      <div class="card p-6 space-y-3">
        <h2 class="text-lg font-semibold">Recent Transfers</h2>
        <p v-if="!records.length" class="text-sm text-slate-500">No transfers recorded yet.</p>
        <table v-else class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="py-2 px-3 text-left">Reference</th>
              <th class="py-2 px-3 text-left">From</th>
              <th class="py-2 px-3 text-left">To</th>
              <th class="py-2 px-3 text-left">Lines</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="transfer in records" :key="transfer.id" class="border-b">
              <td class="py-2 px-3">
                <p class="font-semibold">{{ transfer.reference }}</p>
                <p class="text-xs text-slate-500">{{ new Date(transfer.date).toLocaleDateString() }}</p>
              </td>
              <td class="py-2 px-3">{{ transfer.fromWarehouse?.name || '—' }}</td>
              <td class="py-2 px-3">{{ transfer.toWarehouse?.name || '—' }}</td>
              <td class="py-2 px-3">{{ transfer.items?.length || 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
