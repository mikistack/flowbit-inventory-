<script setup>
import { computed, reactive, watch, ref, nextTick } from 'vue';
import api from '@/utils/api';
import { useLookupStore } from '@/stores/lookups';
import ReturnPicker from '@/components/returns/ReturnPicker.vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  config: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['update:modelValue', 'submitted']);

const lookupStore = useLookupStore();

const formState = reactive({
  values: {},
  status: {
    loading: false,
    success: '',
    error: '',
  },
});

const fields = computed(() => props.config?.fields || []);
const autofocusIndex = computed(() => {
  const idx = fields.value.findIndex((field) => field.autofocus);
  return idx >= 0 ? idx : 0;
});

const title = computed(() => props.config?.label || 'Action');

const infoText = computed(() => props.config?.description || props.config?.infoMessage);

const showForm = computed(() => !props.config?.infoOnly);

const hasDownload = computed(() => Boolean(props.config?.download));
const firstFieldRef = ref(null);
const showReturnPicker = computed(() => Boolean(props.config?.returnSource));
const hasLinkedSource = computed(() => Boolean(formState.values.saleId || formState.values.purchaseId));
const selectedSource = ref(null);
const requireReturnReference = computed(() => showReturnPicker.value && props.config?.requireSource !== false);

const close = () => {
  emit('update:modelValue', false);
  formState.status.success = '';
  formState.status.error = '';
};

const initValues = () => {
  formState.values = {};
  fields.value.forEach((field) => {
    const defaultValue = (() => {
      const record = props.config?.record;
      if (record) {
        const sourceKey = field.sourceKey || field.name;
        let value = record[sourceKey];
        if (value === undefined && sourceKey.includes('.')) {
          value = sourceKey.split('.').reduce((acc, key) => acc?.[key], record);
        }
        if (field.type === 'select' && value && typeof value === 'object') {
          const valueKey = field.valueKey || 'id';
          return value[valueKey];
        }
        return value;
      }
      return typeof field.default === 'function' ? field.default() : field.default;
    })();

    if (field.type === 'checkbox') {
      formState.values[field.name] = Boolean(defaultValue);
    } else if (defaultValue !== undefined && defaultValue !== null) {
      formState.values[field.name] = defaultValue;
    } else {
      formState.values[field.name] = '';
    }
  });
  if (props.config?.returnSource === 'sale') {
    formState.values.saleId = props.config?.record?.saleId || null;
    formState.values.purchaseId = null;
  } else if (props.config?.returnSource === 'purchase') {
    formState.values.purchaseId = props.config?.record?.purchaseId || null;
    formState.values.saleId = null;
  }
  if (props.config?.returnSource) {
    formState.values.sourceReference = props.config?.record?.sourceReference || '';
    formState.values.sourceTotal = props.config?.record?.sourceTotal || '';
  }
};

const ensureLookupData = async () => {
  const loaders = {
    warehouses: lookupStore.loadWarehouses,
    customers: lookupStore.loadCustomers,
    suppliers: lookupStore.loadSuppliers,
    products: lookupStore.loadProducts,
    categories: lookupStore.loadCategories,
    expenseCategories: lookupStore.loadExpenseCategories,
    brands: lookupStore.loadBrands,
    units: lookupStore.loadUnits,
    currencies: lookupStore.loadCurrencies,
    labelTemplates: lookupStore.loadLabelTemplates,
    roles: lookupStore.loadRoles,
  };
  const tasks = fields.value
    .map((field) => loaders[field.optionsSource])
    .filter(Boolean)
    .map((fn) =>
      fn().catch((error) => {
        console.error('Lookup load failed', error);
        formState.status.error = 'Unable to load reference data. Please retry.';
      }),
    );
  await Promise.all(tasks);
};

const prepareForm = async () => {
  formState.status.error = '';
  formState.status.success = '';
  initValues();
  selectedSource.value = null;
  await ensureLookupData();
  await nextTick();
  firstFieldRef.value?.focus();
};

watch(
  () => props.modelValue,
  async (visible) => {
    if (visible) {
      await prepareForm();
    } else {
      formState.values = {};
      formState.status.loading = false;
      formState.status.error = '';
      formState.status.success = '';
    }
  },
);

watch(
  () => props.config,
  async (next, prev) => {
    if (!props.modelValue) return;
    if (next === prev) return;
    await prepareForm();
  },
);

const getOptionsForField = (field) => {
  if (field.options) return field.options;
  if (!field.optionsSource) return [];
  const collection = lookupStore[field.optionsSource] || [];
  const labelKey = field.labelKey || 'name';
  const valueKey = field.valueKey || 'id';
  return collection.map((item) => ({
    label: item[labelKey] || `${field.label} #${item[valueKey]}`,
    value: item[valueKey],
  }));
};

const handleFileInput = (field, event) => {
  const file = event.target.files?.[0];
  if (!file) {
    formState.values[field.name] = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    formState.values[field.name] = reader.result;
  };
  reader.readAsDataURL(file);
};

const handleSourceSelected = (source) => {
  if (!source) return;
  selectedSource.value = source;
  if (props.config?.returnSource === 'sale' && source.customerId) {
    formState.values.customerId = source.customerId;
    formState.values.saleId = source.id;
    formState.values.purchaseId = null;
  }
  if (props.config?.returnSource === 'purchase' && source.supplierId) {
    formState.values.supplierId = source.supplierId;
    formState.values.purchaseId = source.id;
    formState.values.saleId = null;
  }
  if (source.warehouseId) {
    formState.values.warehouseId = source.warehouseId;
  }
  if (!formState.values.reference && source.reference) {
    formState.values.reference = `${source.reference}-RTN`;
  }
  if (formState.values.note === '' || formState.values.note === undefined) {
    formState.values.note = `Return for ${source.reference}`;
  }
  formState.values.sourceReference = source.reference;
  formState.values.sourceTotal = source.total;
};

const clearSelectedSource = () => {
  selectedSource.value = null;
  formState.values.saleId = null;
  formState.values.purchaseId = null;
  formState.values.sourceReference = '';
  formState.values.sourceTotal = '';
};

const submit = async () => {
  if (!showForm.value) {
    if (hasDownload.value) {
      await handleDownload();
    } else {
      close();
    }
    return;
  }
  if (showReturnPicker.value && requireReturnReference.value && !hasLinkedSource.value) {
    formState.status.error = 'Select a sale or purchase to return before submitting.';
    return;
  }
  const { endpoint } = props.config || {};
  if (!endpoint) {
    formState.status.error = 'No endpoint configured for this action.';
    return;
  }
  formState.status.loading = true;
  formState.status.error = '';
  try {
    const payload = props.config?.transform
      ? props.config.transform({ ...formState.values }, props.config)
      : { ...formState.values };

    const method = (props.config?.method || 'post').toLowerCase();
    if (typeof api[method] !== 'function') {
      throw new Error(`Unsupported method: ${method}`);
    }
    const requestConfig = props.config?.responseType ? { responseType: props.config.responseType } : {};
    let response;
    if (method === 'get') {
      response = await api.get(endpoint, { ...requestConfig, params: payload });
    } else if (method === 'delete') {
      response = await api.delete(endpoint, { ...requestConfig, data: payload });
    } else {
      response = await api[method](endpoint, payload, requestConfig);
    }

    if (props.config?.handleBlob === 'openPdf' && response?.data) {
      const blob = new Blob([response.data], { type: props.config.blobMimeType || 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
    }
    formState.status.success = props.config?.successMessage || 'Saved successfully.';
    emit('submitted');
    setTimeout(() => {
      close();
    }, 1200);
  } catch (error) {
      formState.status.error = error.response?.data?.message || error.message || 'Request failed';
  } finally {
    formState.status.loading = false;
  }
};

const handleDownload = async () => {
  const { download } = props.config || {};
  if (!download?.endpoint) {
    formState.status.error = 'Download endpoint missing.';
    return;
  }
  formState.status.loading = true;
  formState.status.error = '';
  try {
    const response = await api.get(download.endpoint, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = download.filename || 'export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    formState.status.success = 'Download started.';
  } catch (error) {
    formState.status.error = error.response?.data?.message || error.message || 'Download failed';
  } finally {
    formState.status.loading = false;
  }
};
</script>

<template>
  <transition name="fade">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-lg rounded-3xl bg-white shadow-xl">
        <header class="px-6 pt-6 pb-2">
          <h2 class="text-xl font-semibold text-slate-900">{{ title }}</h2>
          <p v-if="infoText" class="text-sm text-slate-500 mt-1">
            {{ infoText }}
          </p>
        </header>

        <div class="px-6 pb-4 max-h-[70vh] overflow-y-auto">
          <form v-if="showForm" class="space-y-4" @submit.prevent="submit">
            <section v-if="showReturnPicker" class="space-y-3">
              <ReturnPicker :key="props.config?.returnSource" :type="props.config?.returnSource" @selected="handleSourceSelected" />
              <div
                v-if="selectedSource"
                class="rounded-2xl border border-brand-100 bg-brand-50/40 p-4 text-sm text-slate-700"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-xs uppercase tracking-wide text-slate-500">Returning</p>
                    <p class="text-base font-semibold text-slate-900">{{ selectedSource.reference }}</p>
                    <p class="text-xs text-slate-500">
                      {{ selectedSource.partnerName || 'Unassigned partner' }}
                    </p>
                  </div>
                  <button type="button" class="text-xs font-semibold text-brand-700" @click="clearSelectedSource">
                    Change
                  </button>
                </div>
                <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <dt class="text-slate-500">Total</dt>
                    <dd class="text-sm font-semibold text-slate-900">
                      ETB
                      {{ Number(selectedSource.total || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-slate-500">Status</dt>
                    <dd class="capitalize text-slate-800">{{ selectedSource.status || 'n/a' }}</dd>
                  </div>
                  <div>
                    <dt class="text-slate-500">Date</dt>
                    <dd class="text-slate-800">
                      {{ selectedSource.date ? new Date(selectedSource.date).toLocaleString() : 'n/a' }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-slate-500">Warehouse</dt>
                    <dd class="text-slate-800">
                      {{ lookupStore.warehouses.find((w) => w.id === formState.values.warehouseId)?.name || 'n/a' }}
                    </dd>
                  </div>
                </dl>
              </div>
              <p v-else class="text-xs text-slate-500">
                Use the search above to select a sale or purchase before filling the return details.
              </p>
            </section>
            <div v-for="(field, index) in fields" :key="field.name" class="space-y-1">
              <label class="text-sm font-medium text-slate-700">{{ field.label }}</label>

              <template v-if="field.type === 'textarea'">
                <textarea
                  v-model="formState.values[field.name]"
                  rows="3"
                  class="w-full rounded-2xl border border-slate-200 px-4 py-2 focus:border-brand-400 focus:ring-brand-200"
                  :placeholder="field.placeholder"
                  :required="field.required"
                :ref="index === autofocusIndex ? firstFieldRef : null"
                  :readonly="field.readonly"
                  :disabled="field.disabled"
                />
              </template>
              <template v-else-if="field.type === 'select'">
                <select
                  v-model="formState.values[field.name]"
                  class="w-full rounded-2xl border border-slate-200 px-4 py-2 focus:border-brand-400 focus:ring-brand-200"
                  :required="field.required"
                :ref="index === autofocusIndex ? firstFieldRef : null"
                  :disabled="field.disabled"
                >
                  <option value="">-- Select --</option>
                  <option v-for="option in getOptionsForField(field)" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </template>
              <template v-else-if="field.type === 'image'">
                <div class="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    :capture="field.capture ? 'environment' : null"
                    class="w-full rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm"
                    @change="handleFileInput(field, $event)"
                  />
                  <p class="text-xs text-slate-500">
                    {{ field.helper || 'Upload from files on desktop or use your camera/gallery on mobile.' }}
                  </p>
                  <div
                    v-if="formState.values[field.name]"
                    class="flex items-center justify-between rounded-2xl border border-slate-200 p-3"
                  >
                    <img
                      :src="formState.values[field.name]"
                      alt="Selected preview"
                      class="h-16 w-16 rounded-xl object-cover border border-slate-100"
                    />
                    <button
                      type="button"
                      class="text-xs font-semibold text-rose-500"
                      @click="formState.values[field.name] = ''"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </template>
              <template v-else-if="field.type === 'checkbox'">
                <label class="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    v-model="formState.values[field.name]"
                    type="checkbox"
                    class="rounded border-slate-300"
                    :disabled="field.disabled"
                  />
                  {{ field.placeholder || 'Enable' }}
                </label>
              </template>
              <template v-else-if="field.type === 'barcode'">
                <div class="space-y-2">
                  <input
                    v-model="formState.values[field.name]"
                    type="text"
                    class="w-full rounded-2xl border-2 border-dashed border-slate-300 px-4 py-4 text-xl font-semibold tracking-widest text-slate-900 focus:border-brand-500 focus:ring-brand-200"
                    :placeholder="field.placeholder"
                    autocomplete="off"
                    spellcheck="false"
                    :ref="index === autofocusIndex ? firstFieldRef : null"
                  />
                  <div class="text-xs text-slate-500 flex flex-wrap gap-2">
                    <span>Scan with a barcode gun (auto-submit) or camera input on mobile.</span>
                    <span v-if="field.helper" class="text-slate-400">{{ field.helper }}</span>
                  </div>
                </div>
              </template>
              <template v-else>
                <input
                  v-model="formState.values[field.name]"
                  :type="field.type || 'text'"
                  class="w-full rounded-2xl border border-slate-200 px-4 py-2 focus:border-brand-400 focus:ring-brand-200"
                  :placeholder="field.placeholder"
                  :required="field.required"
                :ref="index === autofocusIndex ? firstFieldRef : null"
                  :inputmode="field.inputmode || (field.type === 'number' ? 'decimal' : null)"
                  :step="field.step || (field.type === 'number' ? '0.01' : null)"
                  :min="field.min"
                  :max="field.max"
                  :readonly="field.readonly"
                  :disabled="field.disabled"
                />
              </template>
              <p v-if="field.helper" class="text-xs text-slate-500">{{ field.helper }}</p>
            </div>
          </form>

          <div v-else class="py-6 text-sm text-slate-600">
            This action is informational only at the moment.
          </div>

          <p v-if="formState.status.error" class="mt-4 text-sm text-rose-600">{{ formState.status.error }}</p>
          <p v-if="formState.status.success" class="mt-4 text-sm text-emerald-600">{{ formState.status.success }}</p>
        </div>

        <footer class="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button type="button" class="px-4 py-2 rounded-2xl border border-slate-200 text-sm font-medium" @click="close">
            Close
          </button>
          <button
            v-if="hasDownload && !showForm"
            type="button"
            class="px-4 py-2 rounded-2xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
            :disabled="formState.status.loading"
            @click="handleDownload"
          >
            {{ formState.status.loading ? 'Preparing...' : 'Download' }}
          </button>
          <button
            v-if="showForm"
            type="button"
            class="px-4 py-2 rounded-2xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
            :disabled="formState.status.loading"
            @click="submit"
          >
            {{ formState.status.loading ? 'Saving...' : 'Submit' }}
          </button>
        </footer>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
