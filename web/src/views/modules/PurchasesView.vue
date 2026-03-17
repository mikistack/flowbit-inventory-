<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import api from '@/utils/api';
import { useLookupStore } from '@/stores/lookups';
import ProductScanner from '@/components/products/ProductScanner.vue';
import ProductCard from '@/components/products/ProductCard.vue';
import ProductSearchSelect from '@/components/products/ProductSearchSelect.vue';

const lookupStore = useLookupStore();
const status = reactive({ loading: false, error: '', success: '' });

const form = reactive({
  supplierId: '',
  warehouseId: '',
  shipping: 0,
  orderDiscount: 0,
  orderTax: 0,
  paid: 0,
  paymentStatus: 'pending',
  note: '',
});
const paymentStatusOptions = [
  { value: 'pending', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid in Full' },
];

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const createLine = (overrides = {}) => ({
  uid: uid(),
  productId: '',
  quantity: 1,
  price: 0,
  productSnapshot: null,
  ...overrides,
});

const lineItems = ref([]);
const productOptions = computed(() => lookupStore.products);
const supplierOptions = computed(() => lookupStore.suppliers);
const warehouseOptions = computed(() => lookupStore.warehouses);

const focusAndSelect = (event) => event?.target?.select?.();
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

const totals = computed(() => {
  let subtotal = 0;
  lineItems.value.forEach((item) => {
    subtotal += ensureNumeric(item.quantity) * ensureNumeric(item.price);
  });
  const shipping = ensureNumeric(form.shipping);
  const discount = ensureNumeric(form.orderDiscount);
  const tax = ensureNumeric(form.orderTax);
  const paid = ensureNumeric(form.paid);
  const grandTotal = subtotal + tax - discount + shipping;
  return {
    subtotal,
    discount,
    tax,
    shipping,
    grandTotal,
    paid,
    due: grandTotal - paid,
  };
});

const resetForm = () => {
  form.supplierId = supplierOptions.value[0]?.id || '';
  form.warehouseId = warehouseOptions.value[0]?.id || '';
  form.shipping = 0;
  form.orderDiscount = 0;
  form.orderTax = 0;
  form.paid = 0;
  form.paymentStatus = 'pending';
  form.note = '';
  lineItems.value = [];
};

const buildPayload = () => ({
  supplierId: form.supplierId,
  warehouseId: form.warehouseId,
  shipping: ensureNumeric(form.shipping),
  orderDiscount: ensureNumeric(form.orderDiscount),
  orderTax: ensureNumeric(form.orderTax),
  paid: ensureNumeric(form.paid),
  paymentStatus: form.paymentStatus,
  note: form.note,
  items: lineItems.value
    .filter((item) => item.productId && ensureNumeric(item.quantity) > 0)
    .map((item) => ({
      productId: item.productId,
      quantity: ensureNumeric(item.quantity),
      price: ensureNumeric(item.price),
    })),
});

const ensureHasItems = () => {
  if (!lineItems.value.length) {
    status.error = 'Add at least one product.';
    return false;
  }
  return true;
};

const submit = async () => {
  status.loading = true;
  status.error = '';
  try {
    if (!ensureHasItems()) {
      status.loading = false;
      return;
    }
    const payload = buildPayload();
    await api.post('/purchases', payload);
    status.success = 'Purchase recorded.';
    await lookupStore.loadProducts(true);
    resetForm();
    setTimeout(() => {
      status.success = '';
    }, 2000);
  } catch (error) {
    status.error = error.response?.data?.message || 'Failed to save purchase.';
  } finally {
    status.loading = false;
  }
};

const downloadReceipt = () => {
  if (!ensureHasItems()) return;
  const receipt = {
    ...buildPayload(),
    totals: totals.value,
    generatedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `purchase-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

const lineItemsClear = () => {
  lineItems.value = [];
};

const changeQuantity = (item, value) => {
  updateNumericField(item, 'quantity', value);
};

const changePrice = (item, value) => {
  updateNumericField(item, 'price', value);
};

const lastScannedProduct = ref(null);
const scannerStatus = reactive({ message: '' });
const productSearchSelection = ref(null);

const insertLineFromProduct = (product) => {
  lastScannedProduct.value = product;
  const existing = lineItems.value.find((line) => line.productId === product.id);
  if (existing) {
    existing.quantity = ensureNumeric(existing.quantity) + 1;
    existing.productSnapshot = product;
    existing.price = ensureNumeric(product.cost || product.price || existing.price);
    return;
  }
  lineItems.value.push(
    createLine({
      productId: product.id,
      quantity: 1,
      price: ensureNumeric(product.cost || product.price),
      productSnapshot: product,
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

const handleSearchSelected = (product) => {
  if (!product) return;
  insertLineFromProduct(product);
  productSearchSelection.value = null;
};

const removeLine = (index) => {
  lineItems.value.splice(index, 1);
};

const markPaidAmount = (type) => {
  const total = totals.value.grandTotal;
  if (type === 'full') {
    form.paid = total;
    form.paymentStatus = 'paid';
    return;
  }
  if (type === 'half') {
    form.paid = total > 0 ? Number((total / 2).toFixed(2)) : 0;
    form.paymentStatus = form.paid > 0 ? 'partial' : 'pending';
    return;
  }
  form.paid = 0;
  form.paymentStatus = 'pending';
};

const loadLookups = async () => {
  await Promise.all([
    lookupStore.loadProducts(),
    lookupStore.loadSuppliers(),
    lookupStore.loadWarehouses(),
  ]);
  resetForm();
};

onMounted(async () => {
  await loadLookups();
});
</script>

<template>
  <section class="space-y-6">
    <header>
      <p class="text-sm uppercase tracking-[0.3em] text-brand-500">Transactions</p>
      <h1 class="text-2xl font-semibold">Purchases</h1>
      <p class="text-slate-500 text-sm">Record supplier receipts and keep warehouse stock aligned.</p>
    </header>

    <div class="space-y-4">
      <ProductScanner @detected="handleScannerDetected" />
      <p v-if="scannerStatus.message" class="text-xs text-rose-600">{{ scannerStatus.message }}</p>
      <ProductCard v-if="lastScannedProduct" :product="lastScannedProduct" />
      <div class="card p-4 space-y-3">
        <h2 class="text-base font-semibold">Search Products</h2>
        <ProductSearchSelect
          v-model="productSearchSelection"
          :products="productOptions"
          placeholder="Search or scan supplier items"
          @selected="handleSearchSelected"
        />
        <p class="text-xs text-slate-500">Scan barcodes or search to list every product in this purchase.</p>
      </div>
    </div>

    <div class="space-y-6">
      <div class="card p-6 space-y-4">
        <h2 class="text-lg font-semibold">Supplier & Payment</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="text-sm text-slate-600">
            Supplier
            <select v-model="form.supplierId" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2">
              <option v-for="supplier in supplierOptions" :key="supplier.id" :value="supplier.id">
                {{ supplier.name }}
              </option>
            </select>
          </label>
          <label class="text-sm text-slate-600">
            Warehouse
            <select v-model="form.warehouseId" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2">
              <option v-for="warehouse in warehouseOptions" :key="warehouse.id" :value="warehouse.id">
                {{ warehouse.name }}
              </option>
            </select>
          </label>
          <label class="text-sm text-slate-600">
            Shipping
            <input v-model.number="form.shipping" type="number" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" />
          </label>
          <label class="text-sm text-slate-600">
            Paid
            <input v-model.number="form.paid" type="number" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" />
          </label>
          <label class="text-sm text-slate-600">
            Payment Status
            <select v-model="form.paymentStatus" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 capitalize">
              <option v-for="option in paymentStatusOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
          <div class="col-span-full flex flex-wrap gap-2 text-xs">
            <button type="button" class="px-3 py-1 rounded-2xl border border-slate-200" @click="markPaidAmount('none')">Mark unpaid</button>
            <button type="button" class="px-3 py-1 rounded-2xl border border-slate-200" @click="markPaidAmount('half')">Half paid</button>
            <button type="button" class="px-3 py-1 rounded-2xl border border-slate-200" @click="markPaidAmount('full')">Paid fully</button>
          </div>
          <label class="text-sm text-slate-600 col-span-full">
            Note
            <textarea v-model="form.note" rows="2" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"></textarea>
          </label>
          <p class="text-xs text-slate-500 col-span-full">
            Use <strong>Partial</strong> when only some of the bill was paid; we'll track the remaining balance in reports and the dashboard.
          </p>
        </div>
      </div>

      <div class="card p-6 space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Items from Supplier</h2>
          <button type="button" class="text-sm text-rose-500" @click="lineItemsClear" :disabled="!lineItems.length">Clear All</button>
        </div>
        <p v-if="!lineItems.length" class="text-sm text-slate-500">No products yet. Scan or search to add them.</p>
        <div v-else class="space-y-3">
          <div
            v-for="(item, index) in lineItems"
            :key="item.uid"
            class="border border-slate-100 rounded-2xl p-4 space-y-3"
          >
            <div class="flex items-center gap-3">
              <img
                v-if="item.productSnapshot?.images?.length"
                :src="item.productSnapshot.images[0].url"
                alt=""
                class="h-12 w-12 rounded-xl object-cover border border-slate-200"
              />
              <div class="flex-1">
                <p class="font-semibold text-slate-800">{{ item.productSnapshot?.name || 'Product' }}</p>
                <p class="text-xs text-slate-500">SKU: {{ item.productSnapshot?.code || '—' }}</p>
              </div>
              <button type="button" class="text-xs text-rose-500" @click="removeLine(index)">Remove</button>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="text-xs text-slate-500">
                Quantity
                <input
                  :value="item.quantity"
                  type="number"
                  min="0"
                  step="1"
                  class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  @focus="focusAndSelect"
                  @input="changeQuantity(item, $event.target.value)"
                />
              </label>
              <label class="text-xs text-slate-500">
                Cost
                <input
                  :value="item.price"
                  type="number"
                  min="0"
                  step="0.01"
                  class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  @focus="focusAndSelect"
                  @input="changePrice(item, $event.target.value)"
                />
              </label>
            </div>
            <div class="text-sm text-slate-600 flex justify-between">
              <span>Line Total</span>
              <span class="font-semibold">ETB {{ lineSubtotal(item).toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card p-6 space-y-4">
        <h2 class="text-lg font-semibold">Summary</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="text-sm text-slate-600">
            Order Discount
            <input v-model.number="form.orderDiscount" type="number" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" />
          </label>
          <label class="text-sm text-slate-600">
            Order Tax
            <input v-model.number="form.orderTax" type="number" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" />
          </label>
        </div>
        <div class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 space-y-1">
          <div class="flex justify-between"><span>Subtotal</span><span>{{ totals.subtotal.toFixed(2) }}</span></div>
          <div class="flex justify-between"><span>Discount</span><span>-{{ totals.discount.toFixed(2) }}</span></div>
          <div class="flex justify-between"><span>Tax</span><span>{{ totals.tax.toFixed(2) }}</span></div>
          <div class="flex justify-between"><span>Shipping</span><span>{{ totals.shipping.toFixed(2) }}</span></div>
          <div class="flex justify-between font-semibold text-lg"><span>Grand Total</span><span>{{ totals.grandTotal.toFixed(2) }}</span></div>
          <div class="flex justify-between text-xs text-slate-500"><span>Due</span><span>{{ totals.due.toFixed(2) }}</span></div>
        </div>
        <div
          class="rounded-2xl border px-4 py-3 text-sm flex flex-col gap-1"
          :class="totals.due > 0 ? 'border-amber-200 bg-amber-50/70' : 'border-emerald-200 bg-emerald-50/70'"
        >
          <div class="flex justify-between">
            <span>Paid so far</span>
            <span class="font-semibold">{{ ensureNumeric(form.paid).toFixed(2) }}</span>
          </div>
          <div class="flex justify-between text-base font-semibold">
            <span>{{ totals.due > 0 ? 'Still payable' : 'Paid completely' }}</span>
            <span>{{ totals.due.toFixed(2) }}</span>
          </div>
        </div>

        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            class="px-4 py-2 rounded-2xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
            :disabled="status.loading"
            @click="submit"
          >
            {{ status.loading ? 'Saving...' : 'Proceed' }}
          </button>
          <button type="button" class="px-4 py-2 rounded-2xl border border-slate-200 text-sm" @click="downloadReceipt">Download Receipt</button>
          <button type="button" class="px-4 py-2 rounded-2xl border border-slate-200 text-sm" @click="resetForm">Reset</button>
        </div>

        <p v-if="status.error" class="text-sm text-rose-500">{{ status.error }}</p>
        <p v-if="status.success" class="text-sm text-emerald-600">{{ status.success }}</p>
      </div>
    </div>
  </section>
</template>
