<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/utils/api';
import { useLookupStore } from '@/stores/lookups';
import ProductScanner from '@/components/products/ProductScanner.vue';
import ProductCard from '@/components/products/ProductCard.vue';
import ProductSearchSelect from '@/components/products/ProductSearchSelect.vue';

const lookupStore = useLookupStore();
const route = useRoute();
const router = useRouter();

const status = reactive({ loading: false, error: '', success: '' });
const receiptPrompt = reactive({ visible: false });
const lastReceipt = ref(null);
const paymentStatusOptions = [
  { value: 'pending', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid in Full' },
];

const form = reactive({
  reference: '',
  customerId: '',
  warehouseId: '',
  shipping: 0,
  orderDiscount: 0,
  orderTax: 0,
  paid: 0,
  paymentStatus: 'pending',
  note: '',
});

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

const customers = computed(() => lookupStore.customers);
const warehouses = computed(() => lookupStore.warehouses);
const products = computed(() => lookupStore.products);

const removeLine = (index) => {
  lineItems.value.splice(index, 1);
};

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

const handleProductPicked = (item, product) => {
  if (!product) return;
  item.productId = product.id;
  item.price = ensureNumeric(product.price || product.cost);
  item.productSnapshot = product;
};

const totals = computed(() => {
  let subtotal = 0;
  lineItems.value.forEach((item) => {
    const qty = ensureNumeric(item.quantity);
    const price = ensureNumeric(item.price);
    subtotal += qty * price;
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
  form.reference = `SAL-${Date.now()}`;
  form.customerId = customers.value[0]?.id || '';
  form.warehouseId = warehouses.value[0]?.id || '';
  form.shipping = 0;
  form.orderDiscount = 0;
  form.orderTax = 0;
  form.paid = 0;
  form.paymentStatus = 'pending';
  form.note = '';
  lineItems.value = [];
};

const buildPayload = () => ({
  reference: form.reference || `SAL-${Date.now()}`,
  customerId: form.customerId,
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
    const { data } = await api.post('/sales', payload);
    const receiptPayload = {
      ...payload,
      totals: totals.value,
      generatedAt: new Date().toISOString(),
      response: data,
    };
    lastReceipt.value = receiptPayload;
    receiptPrompt.visible = true;
    status.success = 'Sale recorded.';
    await lookupStore.loadProducts(true);
    resetForm();
    setTimeout(() => {
      status.success = '';
    }, 2000);
  } catch (error) {
    status.error = error.response?.data?.message || 'Failed to save sale.';
  } finally {
    status.loading = false;
  }
};

const downloadReceipt = (receiptData = null) => {
  const receipt =
    receiptData ||
    {
      ...buildPayload(),
      totals: totals.value,
      generatedAt: new Date().toISOString(),
    };
  const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${receipt.reference || 'sale'}-receipt.json`;
  link.click();
  URL.revokeObjectURL(url);
};

const closeReceiptPrompt = () => {
  receiptPrompt.visible = false;
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

const applyRouteSeed = () => {
  const { productId, warehouseId } = route.query;
  if (productId) {
    const product = products.value.find((prod) => String(prod.id) === String(productId));
    if (product) {
      lineItems.value[0] = createLine({
        productId: product.id,
        price: ensureNumeric(product.price || product.cost),
        productSnapshot: product,
      });
    }
  }
  if (warehouseId) {
    form.warehouseId = String(warehouseId);
  }
  if (productId || warehouseId) {
    router.replace({ query: {} });
  }
};

const loadLookups = async () => {
  await Promise.all([
    lookupStore.loadProducts(),
    lookupStore.loadCustomers(),
    lookupStore.loadWarehouses(),
  ]);
  if (!form.reference) {
    resetForm();
  }
  applyRouteSeed();
};

onMounted(async () => {
  await loadLookups();
});

const lastScannedProduct = ref(null);
const scannerStatus = reactive({ message: '' });
const productSearchSelection = ref(null);

const insertLineFromProduct = (product) => {
  lastScannedProduct.value = product;
  const existing = lineItems.value.find((line) => line.productId === product.id);
  if (existing) {
    existing.quantity = ensureNumeric(existing.quantity) + 1;
    existing.productSnapshot = product;
    return;
  }
  lineItems.value.push(
    createLine({
      productId: product.id,
      price: ensureNumeric(product.price || product.cost),
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

const changeQuantity = (item, value) => {
  updateNumericField(item, 'quantity', value);
};

const changePrice = (item, value) => {
  updateNumericField(item, 'price', value);
};

const clearLines = () => {
  lineItems.value = [];
};
</script>

<template>
  <section class="space-y-6">
    <header>
      <p class="text-sm uppercase tracking-[0.3em] text-brand-500">Transactions</p>
      <h1 class="text-2xl font-semibold">Sales</h1>
      <p class="text-slate-500 text-sm">
        Scan or search products, review totals, then finalize the sale in a mobile-friendly flow.
      </p>
    </header>

    <div class="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div class="space-y-4">
        <div class="card p-6 space-y-4">
          <div>
            <h2 class="text-lg font-semibold">Scan or Search</h2>
            <p class="text-sm text-slate-500">Use the barcode scanner or search box to add products. Each scan adds the product to this sale.</p>
          </div>
          <ProductScanner @detected="handleScannerDetected" />
          <p v-if="scannerStatus.message" class="text-xs text-rose-600">{{ scannerStatus.message }}</p>
          <ProductCard v-if="lastScannedProduct" :product="lastScannedProduct" />
          <div class="space-y-2">
            <ProductSearchSelect
              v-model="productSearchSelection"
              :products="products"
              placeholder="Search product name or SKU"
              @selected="handleSearchSelected"
            />
            <p class="text-xs text-slate-500">Search results include product image, name, and SKU for quick verification.</p>
          </div>
        </div>

        <div class="card p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">Order Items</h2>
            <button type="button" class="text-sm text-rose-500 disabled:opacity-40" :disabled="!lineItems.length" @click="clearLines">
              Clear All
            </button>
          </div>
          <p v-if="!lineItems.length" class="text-sm text-slate-500">Scan or search to begin building this sale.</p>
          <div v-else class="space-y-3">
            <div
              v-for="(item, index) in lineItems"
              :key="item.uid"
              class="border border-slate-100 rounded-2xl p-4 space-y-3"
            >
              <div class="flex items-start gap-3">
                <img
                  v-if="item.productSnapshot?.images?.length"
                  :src="item.productSnapshot.images[0].url"
                  alt=""
                  class="h-14 w-14 rounded-xl object-cover border border-slate-200"
                />
                <div class="flex-1">
                  <p class="font-semibold text-slate-800">
                    {{ item.productSnapshot?.name || 'Product' }}
                  </p>
                  <p class="text-xs text-slate-500">SKU: {{ item.productSnapshot?.code || '—' }}</p>
                  <p class="text-xs text-slate-500 mt-1">Unit Price: ETB {{ ensureNumeric(item.price).toFixed(2) }}</p>
                </div>
                <button type="button" class="text-xs text-rose-500" @click="removeLine(index)">Remove</button>
              </div>
              <div class="grid gap-3 md:grid-cols-3">
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
                  Unit Price
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
                <div class="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-500 flex flex-col justify-between">
                  <span>Line Total</span>
                  <span class="text-base font-semibold text-slate-900">ETB {{ lineSubtotal(item).toFixed(2) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <div class="card p-6 space-y-4">
          <h2 class="text-lg font-semibold">Order Totals</h2>
          <div class="grid gap-3">
            <label class="text-sm text-slate-600">
              Shipping
              <input v-model.number="form.shipping" type="number" min="0" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" />
            </label>
            <label class="text-sm text-slate-600">
              Order Discount
              <input v-model.number="form.orderDiscount" type="number" min="0" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" />
            </label>
            <label class="text-sm text-slate-600">
              Order Tax
              <input v-model.number="form.orderTax" type="number" min="0" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" />
            </label>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 space-y-1">
            <div class="flex justify-between"><span>Subtotal</span><span>{{ totals.subtotal.toFixed(2) }}</span></div>
            <div class="flex justify-between"><span>Discount</span><span>-{{ totals.discount.toFixed(2) }}</span></div>
            <div class="flex justify-between"><span>Tax</span><span>{{ totals.tax.toFixed(2) }}</span></div>
            <div class="flex justify-between"><span>Shipping</span><span>{{ totals.shipping.toFixed(2) }}</span></div>
            <div class="flex justify-between font-semibold text-base"><span>Grand Total</span><span>{{ totals.grandTotal.toFixed(2) }}</span></div>
            <div class="flex justify-between text-xs text-slate-500"><span>Due (after payment)</span><span>{{ totals.due.toFixed(2) }}</span></div>
          </div>
          <div
            class="rounded-2xl border border-slate-200 px-4 py-3 text-sm flex flex-col gap-1"
            :class="totals.due > 0 ? 'bg-amber-50/80 border-amber-200' : 'bg-emerald-50/70 border-emerald-200'"
          >
            <div class="flex justify-between">
              <span>Paid so far</span>
              <span class="font-semibold">{{ ensureNumeric(form.paid).toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-base font-semibold">
              <span>{{ totals.due > 0 ? 'Amount still due' : 'Fully paid' }}</span>
              <span>{{ totals.due.toFixed(2) }}</span>
            </div>
            <p class="text-xs text-slate-500">Set the paid amount below. Partial payments are supported.</p>
          </div>
        </div>

        <div class="card p-6 space-y-4">
          <div>
            <h2 class="text-lg font-semibold">Finalize Sale</h2>
            <p class="text-sm text-slate-500">Confirm destination, payment, and notes before proceeding.</p>
          </div>
          <div class="space-y-3">
            <label class="text-sm text-slate-600">
              Customer
              <select v-model="form.customerId" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2">
                <option value="">Unassigned</option>
                <option v-for="customer in customers" :key="customer.id" :value="customer.id">
                  {{ customer.name }}
                </option>
              </select>
            </label>
            <label class="text-sm text-slate-600">
              Warehouse
              <select v-model="form.warehouseId" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2">
                <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                  {{ warehouse.name }}
                </option>
              </select>
            </label>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="text-sm text-slate-600">
                Paid Amount
                <input v-model.number="form.paid" type="number" min="0" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" />
              </label>
              <label class="text-sm text-slate-600">
                Payment Status
                <select v-model="form.paymentStatus" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 capitalize">
                  <option v-for="option in paymentStatusOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>
            </div>
            <div class="flex flex-wrap gap-2 text-xs">
              <button type="button" class="px-3 py-1 rounded-2xl border border-slate-200" @click="markPaidAmount('none')">Mark Unpaid</button>
              <button type="button" class="px-3 py-1 rounded-2xl border border-slate-200" @click="markPaidAmount('half')">Half Paid</button>
              <button type="button" class="px-3 py-1 rounded-2xl border border-slate-200" @click="markPaidAmount('full')">Paid in Full</button>
            </div>
            <p class="text-xs text-slate-500">
              Choose <strong>Partial</strong> when the customer pays part of the order now and owes the rest later. Pending keeps the entire balance open.
            </p>
            <label class="text-sm text-slate-600">
              Note
              <textarea v-model="form.note" rows="2" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" placeholder="Optional notes for the receipt"></textarea>
            </label>
          </div>
          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="px-4 py-2 rounded-2xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
              :disabled="status.loading || !lineItems.length"
              @click="submit"
            >
              {{ status.loading ? 'Saving...' : 'Proceed' }}
            </button>
            <button type="button" class="px-4 py-2 rounded-2xl border border-slate-200 text-sm" @click="resetForm">Reset</button>
          </div>
          <p v-if="status.error" class="text-sm text-rose-500">{{ status.error }}</p>
        </div>

        <div v-if="receiptPrompt.visible && lastReceipt" class="card p-6 space-y-4">
          <div>
            <h2 class="text-lg font-semibold">Receipt Ready</h2>
            <p class="text-sm text-slate-500">Sale {{ lastReceipt.reference }} was recorded. Download the receipt for your records.</p>
          </div>
          <div class="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-700 space-y-1">
            <div class="flex justify-between"><span>Reference</span><span>{{ lastReceipt.reference }}</span></div>
            <div class="flex justify-between"><span>Grand Total</span><span>{{ lastReceipt.totals.grandTotal.toFixed(2) }}</span></div>
            <div class="flex justify-between"><span>Paid</span><span>{{ lastReceipt.paid?.toFixed ? lastReceipt.paid.toFixed(2) : ensureNumeric(lastReceipt.paid).toFixed(2) }}</span></div>
            <div class="flex justify-between"><span>Balance Due</span><span>{{ (lastReceipt.totals.grandTotal - ensureNumeric(lastReceipt.paid)).toFixed(2) }}</span></div>
            <div class="flex justify-between"><span>Items</span><span>{{ lastReceipt.items.length }}</span></div>
            <div class="flex justify-between"><span>Generated At</span><span>{{ new Date(lastReceipt.generatedAt).toLocaleString() }}</span></div>
          </div>
          <div class="flex flex-wrap gap-3">
            <button type="button" class="px-4 py-2 rounded-2xl bg-brand-600 text-white text-sm font-semibold" @click="downloadReceipt(lastReceipt)">
              Download Receipt
            </button>
            <button type="button" class="px-4 py-2 rounded-2xl border border-slate-200 text-sm" @click="closeReceiptPrompt">Dismiss</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
