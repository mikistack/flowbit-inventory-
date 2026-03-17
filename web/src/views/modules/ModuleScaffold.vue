<script setup>
import { computed, reactive, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import api from '@/utils/api';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';
import ActionModal from '@/components/common/ActionModal.vue';
import { resolveActionConfig } from '@/utils/actions';
import RolePermissionModal from '@/components/modals/RolePermissionModal.vue';
import { useLookupStore } from '@/stores/lookups';
import ProductCard from '@/components/products/ProductCard.vue';

const route = useRoute();

const emit = defineEmits(['edit-record']);

const config = computed(() => route.meta || {});
const filters = reactive({
  search: '',
  branch: 'all',
  status: 'all',
  count: 0,
});

const state = reactive({
  loading: false,
  error: null,
  rows: [],
  meta: null,
});

const warehouseOptions = ref([{ label: 'All warehouses', value: 'all' }]);

const actionModal = reactive({
  open: false,
  config: {},
});

const showRoleModal = ref(false);
const roleModalRecord = ref(null);
const excelExporting = ref(false);
const excelError = ref('');
const advancedFiltersConfig = computed(() => config.value.advancedFilters || []);
const resolvedAdvancedFilters = computed(() =>
  (advancedFiltersConfig.value || []).map((filter) => {
    if (!filter.optionSource) return filter;
    const source = lookupStore[filter.optionSource] || [];
    const labelKey = filter.optionLabelKey || 'name';
    const valueKey = filter.optionValueKey || 'id';
    const options = source.map((item) => ({
      label: item[labelKey] ?? item.name ?? item.label ?? item.code,
      value: item[valueKey] ?? item.id,
    }));
    return { ...filter, options };
  }),
);
const advancedFilterState = reactive({});
const lookupStore = useLookupStore();
const isBarcodeModule = computed(() => config.value.resource === 'label-templates');
const inlinePrintState = reactive({
  templateId: '',
  productId: '',
  quantity: 1,
  loading: false,
  error: '',
  labelSize: 'A4',
});
const inlineTemplates = computed(() => lookupStore.labelTemplates || []);
const inlineProducts = computed(() => lookupStore.products || []);
const labelSizeOptions = [
  { value: 'A1', label: 'A1 (594 x 841 mm)', recommended: 'Pallets / bulk inventory, max 48 labels', maxLabels: 48 },
  { value: 'A2', label: 'A2 (420 x 594 mm)', recommended: 'Large cartons, max 32 labels', maxLabels: 32 },
  { value: 'A3', label: 'A3 (297 x 420 mm)', recommended: 'Medium cartons, max 24 labels', maxLabels: 24 },
  { value: 'A4', label: 'A4 (210 x 297 mm)', recommended: 'Standard sheet, max 16 labels', maxLabels: 16 },
  { value: 'A5', label: 'A5 (148 x 210 mm)', recommended: 'Half sheet, max 8 labels', maxLabels: 8 },
  { value: 'A6', label: 'A6 (105 x 148 mm)', recommended: 'Small cards, max 4 labels', maxLabels: 4 },
  { value: 'A7', label: 'A7 (74 x 105 mm)', recommended: 'Single label badge, max 2 labels', maxLabels: 2 },
];
const barcodeSearch = ref('');
const filteredInlineProducts = computed(() => {
  const term = barcodeSearch.value.trim().toLowerCase();
  if (!term) return inlineProducts.value;
  return inlineProducts.value.filter(
    (product) =>
      product.name?.toLowerCase().includes(term) || product.code?.toLowerCase().includes(term),
  );
});
const selectedInlineTemplate = computed(() =>
  inlineTemplates.value.find((tpl) => tpl.id === inlinePrintState.templateId),
);
const selectedInlineProduct = computed(() =>
  inlineProducts.value.find((prod) => prod.id === inlinePrintState.productId),
);
const selectedLabelSizeOption = computed(
  () => labelSizeOptions.find((option) => option.value === inlinePrintState.labelSize) || labelSizeOptions[0],
);
const maxInlineQuantity = computed(() => selectedLabelSizeOption.value?.maxLabels || Infinity);
const compactFilters = ref(false);
const showFilterPanel = ref(true);
const handleResize = () => {
  const compact = window.innerWidth < 640;
  compactFilters.value = compact;
  if (compact) {
    showFilterPanel.value = false;
  } else {
    showFilterPanel.value = true;
  }
};

onMounted(() => {
  handleResize();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});

const ensureFilterLookups = () => {
  advancedFiltersConfig.value.forEach((filter) => {
    if (!filter.optionSource) return;
    const sourceKey = filter.optionSource;
    const loaderName = `load${sourceKey.charAt(0).toUpperCase()}${sourceKey.slice(1)}`;
    if (typeof lookupStore[loaderName] === 'function') {
      lookupStore[loaderName]();
    }
  });
};
const syncTemplateWithSize = () => {
  const currentSize = inlinePrintState.labelSize;
  if (!inlineTemplates.value.length) return;
  const match = inlineTemplates.value.find((tpl) => tpl.size === currentSize);
  if (match) {
    inlinePrintState.templateId = match.id;
    return;
  }
  if (!inlinePrintState.templateId) {
    inlinePrintState.templateId = inlineTemplates.value[0].id;
  }
};
const enforceLabelQuantityBounds = () => {
  const maxAllowed = selectedLabelSizeOption.value?.maxLabels;
  if (maxAllowed && inlinePrintState.quantity > maxAllowed) {
    inlinePrintState.quantity = maxAllowed;
  }
  if (!inlinePrintState.quantity || inlinePrintState.quantity < 1) {
    inlinePrintState.quantity = 1;
  }
};

const normaliseKey = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
const toCamelCase = (key) => key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());

const formatObjectValue = (value) => {
  if (!value || typeof value !== 'object') return value;
  const fullName = [value.firstName, value.lastName].filter(Boolean).join(' ').trim();
  return (
    value.name ||
    fullName ||
    value.username ||
    value.email ||
    value.code ||
    value.id ||
    ''
  );
};

const resolveValue = (row, column) => {
  if (!row) return '';
  if (row[column] !== undefined) {
    const value = row[column];
    return formatObjectValue(value);
  }
  const key = normaliseKey(column);
  if (row[key] !== undefined) {
    const value = row[key];
    return formatObjectValue(value);
  }
  const camelKey = toCamelCase(key);
  if (row[camelKey] !== undefined) {
    const value = row[camelKey];
    return formatObjectValue(value);
  }
  if (row[column.toLowerCase()]) return row[column.toLowerCase()];
  if (key.endsWith('s') && row[key.slice(0, -1)]) return row[key.slice(0, -1)];
  return '';
};

const statusOptions = computed(() => config.value.statusOptions || ['active', 'archived']);
const getNestedValue = (row, path) =>
  path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), row);

const resetFilters = () => {
  filters.search = '';
  filters.branch = 'all';
  filters.status = 'all';
  initializeAdvancedFilters();
  fetchData();
};

const initializeAdvancedFilters = () => {
  Object.keys(advancedFilterState).forEach((key) => {
    delete advancedFilterState[key];
  });
  advancedFiltersConfig.value.forEach((filter) => {
    advancedFilterState[filter.key] = filter.default ?? '';
  });
};

watch(
  () => advancedFiltersConfig.value,
  () => {
    initializeAdvancedFilters();
    ensureFilterLookups();
  },
  { immediate: true },
);

watch(
  () => inlinePrintState.labelSize,
  () => {
    if (isBarcodeModule.value) {
      enforceLabelQuantityBounds();
      syncTemplateWithSize();
    }
  },
);

watch(
  () => inlineTemplates.value,
  () => {
    if (isBarcodeModule.value) {
      syncTemplateWithSize();
    }
  },
);

watch(
  () => inlinePrintState.quantity,
  () => {
    if (isBarcodeModule.value) {
      enforceLabelQuantityBounds();
    }
  },
);

const loadWarehouses = async () => {
  if (!config.value.filters?.warehouse) return;
  try {
    const { data } = await api.get('/warehouses', { params: { limit: 100 } });
    const payload = data.data || data;
    warehouseOptions.value = [
      { label: 'All warehouses', value: 'all' },
      ...payload.map((warehouse) => ({ label: warehouse.name, value: warehouse.id })),
    ];
  } catch (error) {
    console.error('Failed to load warehouses', error);
  }
};

const loadBarcodeLookups = async () => {
  if (!isBarcodeModule.value) return;
  try {
    await Promise.all([lookupStore.loadProducts(true), lookupStore.loadLabelTemplates(true)]);
    if (!inlinePrintState.productId && inlineProducts.value.length) {
      inlinePrintState.productId = inlineProducts.value[0].id;
    }
    syncTemplateWithSize();
  } catch (error) {
    console.error('Failed to load barcode references', error);
  }
};

const resetInlinePrint = () => {
  inlinePrintState.templateId = '';
  inlinePrintState.productId = '';
  inlinePrintState.quantity = 1;
  inlinePrintState.error = '';
  inlinePrintState.loading = false;
};

const fetchData = async () => {
  if (!config.value.resource && !config.value.reportEndpoint) {
    state.rows = [];
    state.meta = null;
    state.loading = false;
    return;
  }
  state.loading = true;
  state.error = null;
  try {
    const endpoint = config.value.reportEndpoint || `/${config.value.resource}`;
    const params = {
      ...config.value.resourceParams,
      search: filters.search || undefined,
      status:
        config.value.filters?.status && filters.status !== 'all' ? filters.status : undefined,
      warehouseId:
        config.value.filters?.warehouse && filters.branch !== 'all' ? filters.branch : undefined,
    };
    const { data } = await api.get(endpoint, { params });
    if (Array.isArray(data)) {
      state.rows = data;
      state.meta = null;
    } else if (data?.data && data?.meta) {
      state.rows = data.data;
      state.meta = data.meta;
    } else {
      state.rows = [data];
      state.meta = null;
    }
  } catch (error) {
    state.error = error?.response?.data?.message || 'Unable to load data';
  } finally {
    state.loading = false;
  }
};

watch(
  () => [route.fullPath, config.value.resource],
  () => {
    filters.search = '';
    filters.branch = 'all';
    filters.status = 'all';
    actionModal.open = false;
    actionModal.config = {};
    showRoleModal.value = false;
    initializeAdvancedFilters();
    fetchData();
    loadWarehouses();
    resetInlinePrint();
    loadBarcodeLookups();
  },
  { immediate: true },
);

const applyFilters = () => {
  fetchData();
};

const selectInlineProduct = (product) => {
  if (!product) return;
  inlinePrintState.productId = product.id;
  inlinePrintState.error = '';
};

const openAction = (actionLabel, extraContext = {}) => {
  if (config.value.resource === 'roles' && actionLabel === 'Add Role') {
    roleModalRecord.value = extraContext.record || null;
    showRoleModal.value = true;
    return;
  }
  actionModal.config = resolveActionConfig(actionLabel, {
    resource: config.value.resource,
    resourceParams: config.value.resourceParams,
    exportType: config.value.exportType,
    ...extraContext,
  });
  actionModal.open = true;
};

const openEdit = (row) => {
  if (config.value.customEdit) {
    emit('edit-record', row);
    return;
  }
  if (!config.value.editAction) return;
  openAction(config.value.editAction, { mode: 'edit', record: row });
};

const deleteRecord = async (row) => {
  if (!config.value.resource || !row?.id) return;
  if (!window.confirm('Delete this record?')) return;
  await api.delete(`/${config.value.resource}/${row.id}`);
  fetchData();
};

const matchesAdvancedFilters = (row) => {
  if (!advancedFiltersConfig.value.length) return true;
  return advancedFiltersConfig.value.every((filter) => {
    const filterValue = advancedFilterState[filter.key];
    if (filterValue === '' || filterValue === null || filterValue === undefined) return true;
    if (typeof filter.match === 'function') {
      return filter.match(row, filterValue);
    }
    const target =
      filter.valueKey !== undefined
        ? getNestedValue(row, filter.valueKey)
        : resolveValue(row, filter.label || filter.key);
    switch (filter.type) {
      case 'text':
        return String(target || '')
          .toLowerCase()
          .includes(String(filterValue).toLowerCase());
      case 'number-min':
        return Number(target || 0) >= Number(filterValue);
      case 'number-max':
        return Number(target || 0) <= Number(filterValue);
      case 'select':
        return String(target || '') === String(filterValue);
      default:
        return true;
    }
  });
};

const displayRows = computed(() => state.rows.filter(matchesAdvancedFilters));
const canInlinePrint = computed(() => {
  const qty = Number(inlinePrintState.quantity);
  return (
    Boolean(inlinePrintState.productId && inlinePrintState.templateId && qty >= 1) &&
    qty <= maxInlineQuantity.value &&
    !inlinePrintState.loading
  );
});

const triggerInlinePrint = async () => {
  if (!inlinePrintState.productId || !inlinePrintState.templateId) {
    inlinePrintState.error = 'Select a template and a product first.';
    return;
  }
  inlinePrintState.loading = true;
  inlinePrintState.error = '';
  try {
    const response = await api.post(
      '/label-templates/print',
      {
        productId: inlinePrintState.productId,
        templateId: inlinePrintState.templateId,
        quantity: inlinePrintState.quantity || 1,
      },
      { responseType: 'blob' },
    );
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
  } catch (error) {
    inlinePrintState.error = error?.response?.data?.message || 'Unable to print label.';
  } finally {
    inlinePrintState.loading = false;
  }
};

const placeholderRows = computed(() => {
  const baseColumns = config.value.columns || [];
  return Array.from({ length: 5 }).map((_, index) => {
    const row = {};
    baseColumns.forEach((col) => {
      row[normaliseKey(col)] = `${col} ${index + 1}`;
    });
    return row;
  });
});

watch(
  () => showRoleModal.value,
  (visible) => {
    if (!visible) {
      roleModalRecord.value = null;
    }
  },
);

const supportsExcelExport = computed(() => config.value.allowExcelExport !== false);

const buildExportRows = () => {
  filters.count = state.rows.length;
  if (!state.rows.length) return [];
  if (config.value.columns?.length) {
    return state.rows.map((row) => {
      const output = {};
      config.value.columns.forEach((column) => {
        output[column] = resolveValue(row, column);
      });
      return output;
    });
  }
  return state.rows.map((row) => ({ ...row }));
};

const exportToCsv = async () => {
  if (!state.rows.length) {
    excelError.value = 'No data to export.';
    setTimeout(() => (excelError.value = ''), 2000);
    return;
  }
  try {
    excelExporting.value = true;
    const rows = buildExportRows();
    const csv = Papa.unparse(rows, { skipEmptyLines: true });
    const filename = `${config.value.title || 'export'}-${new Date().toISOString().slice(0, 10)}.csv`;
    saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
  } catch (error) {
    console.error('CSV export failed', error);
    excelError.value = 'Failed to export CSV file.';
    setTimeout(() => (excelError.value = ''), 2000);
  } finally {
    excelExporting.value = false;
  }
};

defineExpose({
  refresh: fetchData,
});
</script>

<template>
  <section class="space-y-5">
    <header class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-brand-500">Module</p>
        <h1 class="text-2xl font-semibold">{{ config.title }}</h1>
        <p class="text-slate-500 text-sm" v-if="config.description">{{ config.description }}</p>
      </div>
      <div v-if="!isBarcodeModule" class="flex flex-wrap gap-2 items-center">
        <button
          v-for="action in config.actions || []"
          :key="action"
          type="button"
          class="px-4 py-2 rounded-2xl border border-slate-200 text-sm font-medium hover:bg-slate-50"
          @click="openAction(action)"
        >
          {{ action }}
        </button>
        <button
          v-if="supportsExcelExport"
          type="button"
          class="px-4 py-2 rounded-2xl border border-slate-200 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          :disabled="excelExporting"
          @click="exportToCsv"
        >
          {{ excelExporting ? 'Preparing...' : 'Export CSV' }}
        </button>
      </div>
      <p v-if="excelError && !isBarcodeModule" class="text-xs text-rose-500 mt-1">{{ excelError }}</p>
    </header>

    <div v-if="resolvedAdvancedFilters.length" class="card p-4">
      <div class="grid gap-3 md:grid-cols-3">
        <div v-for="filter in resolvedAdvancedFilters" :key="filter.key" class="flex flex-col gap-1">
          <label class="text-xs font-semibold text-slate-500">{{ filter.label }}</label>
          <template v-if="filter.type === 'select'">
            <select
              v-model="advancedFilterState[filter.key]"
              class="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              <option v-for="option in filter.options || []" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </template>
          <template v-else>
            <input
              v-model="advancedFilterState[filter.key]"
              :type="filter.inputType || (filter.type?.includes('number') ? 'number' : 'text')"
              class="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              :placeholder="filter.placeholder"
            />
          </template>
        </div>
      </div>
    </div>

    <div v-if="isBarcodeModule" class="card p-4 space-y-4">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-brand-500">Barcodes</p>
        <h3 class="text-lg font-semibold text-slate-800">Select products to print labels</h3>
        <p class="text-sm text-slate-500">
          Tap a product below to highlight it, pick a label template/size, choose how many labels you need, and click print.
        </p>
      </div>
      <div class="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div class="space-y-3">
          <input
            v-model="barcodeSearch"
            type="search"
            placeholder="Search products..."
            class="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:ring-2 focus:ring-brand-200"
          />
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              v-for="product in filteredInlineProducts"
              :key="product.id"
              type="button"
              class="text-left"
              :class="[
                'rounded-2xl transition block',
                inlinePrintState.productId === product.id
                  ? 'ring-2 ring-brand-500 shadow-lg'
                  : 'hover:ring-1 hover:ring-brand-200',
              ]"
              @click="selectInlineProduct(product)"
            >
              <ProductCard :product="product" />
            </button>
          </div>
          <p v-if="!filteredInlineProducts.length" class="text-sm text-slate-500">
            No products match your search.
          </p>
        </div>
        <div class="space-y-3 border border-slate-200 rounded-2xl p-4 bg-slate-50">
          <label class="text-sm text-slate-600 flex flex-col gap-2">
            Paper Size
            <select v-model="inlinePrintState.labelSize" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm">
              <option v-for="option in labelSizeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
          <p class="text-xs text-slate-500">
            {{ selectedLabelSizeOption?.recommended }}
          </p>
          <p class="text-xs text-slate-500">
            Maximum labels per sheet: {{ selectedLabelSizeOption?.maxLabels }}
          </p>
          <label class="text-sm text-slate-600 flex flex-col gap-2">
            Quantity
            <input
              v-model.number="inlinePrintState.quantity"
              type="number"
              min="1"
              :max="selectedLabelSizeOption?.maxLabels || undefined"
              class="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            class="w-full rounded-2xl bg-slate-900 text-white text-sm font-semibold px-4 py-3 disabled:opacity-50"
            :disabled="!canInlinePrint"
            @click="triggerInlinePrint"
          >
            {{ inlinePrintState.loading ? 'Printing...' : 'Print Barcode Labels' }}
          </button>
          <p v-if="inlinePrintState.error" class="text-xs text-rose-500">{{ inlinePrintState.error }}</p>
          <div v-if="selectedInlineProduct" class="text-xs text-slate-500 bg-white rounded-2xl p-3 border border-slate-200">
            <p class="font-semibold text-slate-800">{{ selectedInlineProduct.name }}</p>
            <p>SKU: {{ selectedInlineProduct.code }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!isBarcodeModule" class="card p-4">
      <div class="flex items-center justify-between mb-3" v-if="compactFilters">
        <p class="text-sm font-semibold text-slate-700">Filters</p>
        <button type="button" class="text-xs text-brand-600 font-semibold" @click="showFilterPanel = !showFilterPanel">
          {{ showFilterPanel ? 'Hide' : 'Show' }}
        </button>
      </div>
      <div v-show="!compactFilters || showFilterPanel" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          v-model="filters.search"
          type="search"
          placeholder="Search name..."
          class="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:ring-2 focus:ring-brand-200"
        />
        <select
          v-if="config.filters?.warehouse"
          v-model="filters.branch"
          class="rounded-2xl border border-slate-200 px-3 py-3 text-sm"
        >
          <option v-for="option in warehouseOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <select
          v-if="config.filters?.status"
          v-model="filters.status"
          class="rounded-2xl border border-slate-200 px-3 py-3 text-sm capitalize"
        >
          <option value="all">Any status</option>
          <option v-for="option in statusOptions" :key="option" :value="option">
            {{ option.replace(/-/g, ' ') }}
          </option>
        </select>
        <button
          type="button"
          class="px-4 py-3 rounded-2xl bg-slate-900 text-white text-sm font-semibold w-full sm:w-auto"
          @click="applyFilters"
        >
          Filter
        </button>
      </div>
    </div>

    <div v-if="!isBarcodeModule" class="card overflow-hidden">
      <div v-if="state.loading" class="p-6 text-center text-slate-500 text-sm">Loading records...</div>
      <div v-else-if="state.error" class="p-6 text-center text-rose-500 text-sm">{{ state.error }}</div>
      <div v-else-if="displayRows.length" class="overflow-x-auto">
        <table class="w-full text-sm min-w-[640px]">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th v-for="column in config.columns || []" :key="column" class="py-3 px-4 text-left font-semibold">
                {{ column }}
              </th>
              <th class="py-3 px-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody v-if="displayRows.length">
            <tr
              v-for="(row, rowIndex) in displayRows"
              :key="row.id || rowIndex"
              class="border-b last:border-0 text-slate-700"
            >
              <td v-for="column in config.columns || []" :key="column" class="py-3 px-4">
                {{ resolveValue(row, column) }}
              </td>
              <td class="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                <button
                  v-if="config.editAction || config.customEdit"
                  type="button"
                  class="text-brand-600 text-xs font-semibold"
                  @click="openEdit(row)"
                >
                  Edit
                </button>
                <button
                  v-if="config.resource"
                  type="button"
                  class="text-rose-500 text-xs font-semibold"
                  @click="deleteRecord(row)"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <template v-else>
        <div class="p-8 text-center text-slate-500 text-sm space-y-3">
          <p>No records found for the selected filters.</p>
          <div class="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              class="px-4 py-2 rounded-2xl border border-slate-200 text-xs font-semibold"
              @click="resetFilters"
            >
              Reset Filters
            </button>
            <button
              v-if="config.actions?.length"
              type="button"
              class="px-4 py-2 rounded-2xl bg-brand-50 text-brand-600 text-xs font-semibold"
              @click="openAction(config.actions[0])"
            >
              {{ config.actions[0] }}
            </button>
          </div>
        </div>
      </template>
    </div>
  </section>
  <ActionModal v-model="actionModal.open" :config="actionModal.config" @submitted="fetchData" />
  <RolePermissionModal v-model="showRoleModal" :record="roleModalRecord" @saved="fetchData" />
</template>
