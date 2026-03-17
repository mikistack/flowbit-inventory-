<script setup>
import { computed, reactive, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import Papa from 'papaparse';
import api from '@/utils/api';

const fileName = ref('');
const rows = ref([]);
const status = reactive({ parsing: false, submitting: false, error: '', summary: null });

const worthMapping = ref('both'); // maps worth to both cost & price
const rowSearch = ref('');

const STORAGE_KEY = 'bulk-products-draft';
const storageEnabled = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const generateRowId = () => `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createRow = (data = {}) => ({
  id: data.id || generateRowId(),
  name: data.name || '',
  brandName: data.brandName || '',
  categoryName: data.categoryName || '',
  worth: data.worth ?? '',
  barcode: data.barcode || '',
  serverErrors: data.serverErrors || [],
  status: data.status || 'pending',
  photoData: data.photoData || '',
  photoPreview: data.photoPreview || '',
  photoName: data.photoName || '',
});

const resetState = () => {
  rows.value = [];
  status.summary = null;
  status.error = '';
  fileName.value = '';
  if (storageEnabled) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
};

const normalizeValue = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const mapRowFromExcel = (header, rawRow) => {
  const findValue = (keywords) => {
    const index = header.findIndex((column) => keywords.some((keyword) => column.includes(keyword)));
    if (index === -1) return '';
    return normalizeValue(rawRow[index]);
  };

  const worthCandidate = findValue(['purchase price', 'unit price', 'price', 'worth']);

  return {
    name: findValue(['item name', 'product name', 'name']),
    brandName: findValue(['brand']),
    categoryName: findValue(['category', 'catagory']),
    worth: worthCandidate ? Number(worthCandidate) : '',
    barcode: '',
    serverErrors: [],
  };
};

const parseCsv = async (file) => {
  status.error = '';
  status.summary = null;
  status.parsing = true;
  try {
    const text = await file.text();
    const parsedCsv = Papa.parse(text, { skipEmptyLines: true });
    const matrix = Array.isArray(parsedCsv.data) ? parsedCsv.data : [];
    if (!matrix.length) {
      status.error = 'The uploaded file is empty.';
      return;
    }
    const header = matrix[0].map((value) => normalizeValue(value).toLowerCase());
    const parsed = matrix
      .slice(1)
      .map((line) => mapRowFromExcel(header, line))
      .filter((row) => row.name || row.brandName || row.categoryName);
    if (!parsed.length) {
      status.error =
        'No recognizable rows found. Ensure the CSV has headers like "Item Name", "Brand", "Category".';
      return;
    }
    rows.value = parsed.map((row) => createRow(row));
  } catch (error) {
    status.error = 'Failed to parse CSV file.';
    console.error(error);
  } finally {
    status.parsing = false;
  }
};

const handleFileChange = async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  fileName.value = file.name;
  await parseCsv(file);
};

const addBlankRow = () => {
  rows.value.push({
    ...createRow(),
  });
};

const removeRow = (index) => {
  rows.value.splice(index, 1);
};

const rowErrors = (row) => {
  const errors = [];
  if (!row.name?.trim()) errors.push('Name required');
  if (!row.brandName?.trim()) errors.push('Brand required');
  if (!row.categoryName?.trim()) errors.push('Category required');
  if (row.worth === '' || row.worth === null || Number.isNaN(Number(row.worth))) errors.push('Worth required');
  if (!row.barcode?.trim()) errors.push('Barcode required');
  if (row.photoData && !row.photoData.startsWith('data:image')) errors.push('Invalid image');
  return errors;
};

const hasValidationErrors = computed(() => rows.value.some((row) => rowErrors(row).length));

const filteredRows = computed(() => {
  if (!rowSearch.value.trim()) return rows.value;
  const term = rowSearch.value.toLowerCase();
  return rows.value.filter((row) => {
    const name = row.name?.toLowerCase() || '';
    const brand = row.brandName?.toLowerCase() || '';
    const category = row.categoryName?.toLowerCase() || '';
    const barcode = row.barcode?.toLowerCase() || '';
    return name.includes(term) || brand.includes(term) || category.includes(term) || barcode.includes(term);
  });
});

const generateBarcodeForRow = async (row) => {
  row.serverErrors = [];
  row.generating = true;
  try {
    const { data } = await api.post('/products/generate-code');
    row.barcode = data.code;
  } catch (error) {
    status.error = error.response?.data?.message || 'Failed to generate barcode.';
  } finally {
    row.generating = false;
  }
};

const submitImport = async () => {
  status.error = '';
  status.summary = null;
  rows.value.forEach((row) => {
    row.serverErrors = [];
  });
  status.submitting = true;
  try {
    const payload = {
      items: rows.value.map((row) => buildRowPayload(row)),
      mapWorthTo: worthMapping.value,
    };
    const { data } = await api.post('/products/import-excel', payload);
    status.summary = data;

    if (data.failed?.length) {
      const failedIndexes = new Set(data.failed.map((item) => item.index));
      rows.value = rows.value.map((row, index) => {
        const failure = data.failed.find((item) => item.index === index);
        return {
          ...row,
          serverErrors: failure?.errors || [],
          failed: failedIndexes.has(index),
        };
      }).filter((row) => row.failed);
    } else {
      rows.value = [];
      fileName.value = '';
    }
  } catch (error) {
    status.error = error.response?.data?.message || 'Failed to import products.';
  } finally {
    status.submitting = false;
  }
};

const importSingleRow = async (row) => {
  row.serverErrors = [];
  row.status = 'importing';
  try {
    const { data } = await api.post('/products/import-excel', {
      items: [buildRowPayload(row)],
      mapWorthTo: worthMapping.value,
    });
    if (data.failed?.length) {
      row.status = 'error';
      row.serverErrors = data.failed[0].errors || ['Failed to import row.'];
      return;
    }
    row.status = 'imported';
    rows.value = rows.value.filter((existing) => existing.id !== row.id);
  } catch (error) {
    row.status = 'error';
    row.serverErrors = [error.response?.data?.message || 'Failed to import row.'];
  }
};

const persistDraft = () => {
  if (!storageEnabled) return;
  if (!rows.value.length && !fileName.value) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const payload = {
    fileName: fileName.value,
    worthMapping: worthMapping.value,
    rows: rows.value.map((row) => ({
      id: row.id,
      name: row.name,
      brandName: row.brandName,
      categoryName: row.categoryName,
      worth: row.worth,
      barcode: row.barcode,
      serverErrors: row.serverErrors,
      status: row.status,
      photoData: row.photoData,
      photoPreview: row.photoPreview,
      photoName: row.photoName,
    })),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist bulk import draft', error);
  }
};

const loadDraft = () => {
  if (!storageEnabled) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.rows) && parsed.rows.length) {
      rows.value = parsed.rows.map((row) => createRow(row));
      fileName.value = parsed.fileName || '';
      worthMapping.value = parsed.worthMapping || 'both';
    }
  } catch (error) {
    console.warn('Failed to load bulk import draft', error);
  }
};

onMounted(() => {
  loadDraft();
});

watch([rows, fileName, worthMapping], persistDraft, { deep: true });

const buildRowPayload = (rowLike) => ({
  name: rowLike.name?.trim() || '',
  brandName: rowLike.brandName?.trim() || '',
  categoryName: rowLike.categoryName?.trim() || '',
  worth: Number(rowLike.worth),
  barcode: rowLike.barcode?.trim() || '',
  photoData: rowLike.photoData || '',
});

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result?.toString() || '');
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });

const downscaleDataUrl = (dataUrl, maxSize = 1024) =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      let { width, height } = image;
      const largest = Math.max(width, height);
      if (largest > maxSize) {
        const scale = maxSize / largest;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });

const handleRowImageChange = async (row, event) => {
  try {
    const [file] = event.target.files || [];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    const optimized = await downscaleDataUrl(dataUrl);
    row.photoData = optimized;
    row.photoPreview = optimized;
    row.photoName = file.name;
  } catch (error) {
    row.serverErrors = ['Failed to attach image'];
  } finally {
    // reset input so selecting the same file again works
    if (event.target) {
      event.target.value = '';
    }
  }
};

const cameraSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
const rowCamera = reactive({
  active: false,
  loading: false,
  error: '',
  stream: null,
  rowId: null,
});
const rowCameraVideo = ref(null);

const stopRowCamera = () => {
  if (rowCamera.stream) {
    rowCamera.stream.getTracks().forEach((track) => track.stop());
  }
  rowCamera.stream = null;
  rowCamera.active = false;
  rowCamera.rowId = null;
};

const startRowCamera = async (row) => {
  if (!cameraSupported) {
    rowCamera.error = 'Camera not supported on this device.';
    return;
  }
  rowCamera.error = '';
  rowCamera.loading = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    rowCamera.stream = stream;
    rowCamera.rowId = row.id;
    if (rowCameraVideo.value) {
      rowCameraVideo.value.srcObject = stream;
      await rowCameraVideo.value.play();
    }
    rowCamera.active = true;
  } catch (error) {
    rowCamera.error = 'Unable to access camera.';
    stopRowCamera();
  } finally {
    rowCamera.loading = false;
  }
};

const captureRowCamera = async () => {
  if (!rowCamera.active || !rowCamera.rowId || !rowCameraVideo.value) return;
  const row = rows.value.find((item) => item.id === rowCamera.rowId);
  if (!row) {
    stopRowCamera();
    return;
  }
  const canvas = document.createElement('canvas');
  const video = rowCameraVideo.value;
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  const optimized = await downscaleDataUrl(dataUrl);
  row.photoData = optimized;
  row.photoPreview = optimized;
  row.photoName = 'camera-capture.jpg';
  stopRowCamera();
};

onBeforeUnmount(() => {
  stopRowCamera();
});

const removeRowImage = (row) => {
  row.photoData = '';
  row.photoPreview = '';
  row.photoName = '';
};
</script>

<template>
  <section class="space-y-6">
    <header>
      <p class="text-sm uppercase tracking-[0.3em] text-brand-500">Products</p>
      <h1 class="text-2xl font-semibold">Bulk Products (CSV)</h1>
      <p class="text-slate-500 text-sm">
        Upload a CSV file to add products in bulk. The system auto-detects product name, brand, category, and worth.
        Provide or generate barcodes before committing the import.
      </p>
    </header>

    <div class="card p-6 space-y-4">
      <div>
        <p class="text-sm font-semibold text-slate-700">1. Upload CSV file</p>
        <p class="text-xs text-slate-500">Supported format: .csv. Columns we look for: Item Name, Brand, Category, Worth (Unit/Purchase Price).</p>
      </div>
      <label class="flex flex-col gap-2">
        <span class="text-sm text-slate-600">Choose file</span>
        <input
          type="file"
          accept=".csv,text/csv"
          class="rounded-2xl border border-dashed border-slate-300 px-3 py-2 text-sm bg-white"
          @change="handleFileChange"
        />
      </label>
      <p v-if="fileName" class="text-xs text-slate-500">Selected: {{ fileName }}</p>
      <p v-if="status.parsing" class="text-xs text-brand-600">Parsing file...</p>
      <p v-if="status.error" class="text-sm text-rose-500">{{ status.error }}</p>
    </div>

    <div v-if="rows.length" class="card p-6 space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <div>
          <p class="text-sm font-semibold text-slate-700">2. Review & complete data</p>
          <p class="text-xs text-slate-500">
            Fill any missing fields. Draft rows auto-save locally so you can pick up later, and you can import rows individually.
          </p>
        </div>
        <div class="ml-auto flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center">
          <label class="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-slate-500 w-full sm:w-auto">
            <span class="uppercase text-[10px] tracking-wide text-slate-400 sm:text-xs sm:normal-case sm:text-slate-500">
              Search rows
            </span>
            <input
              v-model="rowSearch"
              type="search"
              placeholder="Name, brand, barcode..."
              class="rounded-xl border border-slate-200 px-2 py-2 text-sm w-full sm:w-56"
            />
          </label>
          <div class="flex gap-2 sm:flex-none">
            <button
              type="button"
              class="flex-1 sm:flex-none px-3 py-2 rounded-2xl border border-slate-200 text-sm"
              @click="addBlankRow"
            >
              Add Blank Row
            </button>
            <button
              type="button"
              class="flex-1 sm:flex-none px-3 py-2 rounded-2xl border border-slate-200 text-sm"
              @click="resetState"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto hidden lg:block">
        <table class="min-w-[1024px] w-full text-sm border border-slate-100 rounded-2xl">
          <thead class="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th class="px-3 py-2 text-left">Image</th>
              <th class="px-3 py-2 text-left">Name</th>
              <th class="px-3 py-2 text-left">Brand</th>
              <th class="px-3 py-2 text-left">Category</th>
              <th class="px-3 py-2 text-left">Worth</th>
              <th class="px-3 py-2 text-left">Barcode</th>
              <th class="px-3 py-2 text-left">Status</th>
              <th class="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in filteredRows"
              :key="row.id"
              :class="[
                'border-t border-slate-100',
                (rowErrors(row).length || row.serverErrors.length) ? 'bg-rose-50/40' : ''
              ]"
            >
              <td class="px-3 py-2">
                <div class="flex items-center gap-3">
                  <div
                    class="h-12 w-12 rounded-xl border border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-white"
                  >
                    <img
                      v-if="row.photoPreview"
                      :src="row.photoPreview"
                      alt="Product"
                      class="h-full w-full object-cover"
                    />
                    <span v-else class="text-[10px] text-slate-400 text-center px-1">No image</span>
                  </div>
                  <div class="space-y-1 text-xs">
                    <label class="inline-flex items-center gap-2 text-brand-600 font-semibold cursor-pointer">
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        class="hidden"
                        @change="(event) => handleRowImageChange(row, event)"
                      />
                    </label>
                    <button
                      v-if="cameraSupported"
                      type="button"
                      class="text-[11px] text-brand-600 font-semibold"
                      :disabled="rowCamera.loading"
                      @click="startRowCamera(row)"
                    >
                      {{ rowCamera.loading && rowCamera.rowId === row.id ? 'Opening camera...' : 'Use camera' }}
                    </button>
                    <button
                      v-if="row.photoPreview"
                      type="button"
                      class="text-rose-500"
                      @click="removeRowImage(row)"
                    >
                      Remove
                    </button>
                    <p v-if="row.photoName" class="text-[10px] text-slate-500 truncate max-w-[120px]">
                      {{ row.photoName }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="px-3 py-2">
                <input v-model="row.name" type="text" class="w-full rounded-xl border border-slate-200 px-2 py-1" />
              </td>
              <td class="px-3 py-2">
                <input v-model="row.brandName" type="text" class="w-full rounded-xl border border-slate-200 px-2 py-1" />
              </td>
              <td class="px-3 py-2">
                <input v-model="row.categoryName" type="text" class="w-full rounded-xl border border-slate-200 px-2 py-1" />
              </td>
              <td class="px-3 py-2">
                <input
                  v-model.number="row.worth"
                  type="number"
                  step="0.01"
                  min="0"
                  class="w-full rounded-xl border border-slate-200 px-2 py-1"
                />
              </td>
              <td class="px-3 py-2">
                <div class="flex gap-2">
                  <input
                    v-model="row.barcode"
                    type="text"
                    class="flex-1 rounded-xl border border-slate-200 px-2 py-1"
                    placeholder="Scan or type"
                  />
                  <button
                    type="button"
                    class="px-2 py-1 rounded-xl border border-slate-200 text-xs font-medium"
                    :disabled="row.generating"
                    @click="generateBarcodeForRow(row)"
                  >
                    {{ row.generating ? '...' : 'Generate' }}
                  </button>
                </div>
              </td>
              <td class="px-3 py-2">
                <span
                  class="text-xs font-semibold"
                  :class="{
                    'text-slate-500': row.status === 'pending',
                    'text-amber-600': row.status === 'importing',
                    'text-emerald-600': row.status === 'imported',
                    'text-rose-600': row.status === 'error',
                  }"
                >
                  {{
                    row.status === 'importing'
                      ? 'Syncing...'
                      : row.status === 'imported'
                        ? 'Imported'
                        : row.status === 'error'
                          ? 'Needs attention'
                          : 'Pending'
                  }}
                </span>
              </td>
              <td class="px-3 py-2 text-right">
                <div class="flex flex-col sm:flex-row gap-2 justify-end">
                  <button
                    type="button"
                    class="text-xs text-rose-500"
                    @click="removeRow(rows.indexOf(row))"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1 rounded-xl border border-slate-200 text-xs font-semibold disabled:opacity-50"
                    :disabled="row.status === 'importing' || rowErrors(row).length"
                    @click="importSingleRow(row)"
                  >
                    {{ row.status === 'importing' ? 'Syncing...' : 'Import row' }}
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredRows.length === 0">
              <td colspan="7" class="px-3 py-4 text-center text-slate-500 text-sm">
                <span v-if="rowSearch">No rows match “{{ rowSearch }}”.</span>
                <span v-else>No rows loaded.</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="space-y-3 lg:hidden">
        <div
          v-for="row in filteredRows"
          :key="row.id"
          :class="[
            'rounded-2xl border border-slate-200 p-3 space-y-3',
            (rowErrors(row).length || row.serverErrors.length) ? 'bg-rose-50/40' : 'bg-white'
          ]"
        >
          <div class="flex items-center gap-3">
            <div class="h-16 w-16 rounded-2xl border border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
              <img
                v-if="row.photoPreview"
                :src="row.photoPreview"
                alt="Product"
                class="h-full w-full object-cover"
              />
              <span v-else class="text-[10px] text-slate-400 text-center px-1">No image</span>
            </div>
            <div class="text-xs space-y-1">
              <div class="flex flex-wrap gap-2">
                <label class="inline-flex items-center gap-2 text-brand-600 font-semibold cursor-pointer px-2 py-1 rounded-xl border border-brand-100 bg-brand-50/40">
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    class="hidden"
                    @change="(event) => handleRowImageChange(row, event)"
                  />
                </label>
                <button
                  v-if="cameraSupported"
                  type="button"
                  class="px-2 py-1 rounded-xl border border-brand-100 text-brand-600 font-semibold bg-white"
                  :disabled="rowCamera.loading"
                  @click="startRowCamera(row)"
                >
                  {{ rowCamera.loading && rowCamera.rowId === row.id ? 'Opening camera...' : 'Use camera' }}
                </button>
              </div>
              <button
                v-if="row.photoPreview"
                type="button"
                class="text-rose-500"
                @click="removeRowImage(row)"
              >
                Remove image
              </button>
              <p v-if="row.photoName" class="text-[10px] text-slate-500 truncate max-w-[160px]">{{ row.photoName }}</p>
            </div>
          </div>
          <div class="space-y-2">
            <label class="text-xs text-slate-500 block">
              Name
              <input v-model="row.name" type="text" class="mt-1 w-full rounded-xl border border-slate-200 px-2 py-1" />
            </label>
            <label class="text-xs text-slate-500 block">
              Brand
              <input v-model="row.brandName" type="text" class="mt-1 w-full rounded-xl border border-slate-200 px-2 py-1" />
            </label>
            <label class="text-xs text-slate-500 block">
              Category
              <input v-model="row.categoryName" type="text" class="mt-1 w-full rounded-xl border border-slate-200 px-2 py-1" />
            </label>
            <label class="text-xs text-slate-500 block">
              Worth
              <input
                v-model.number="row.worth"
                type="number"
                step="0.01"
                min="0"
                class="mt-1 w-full rounded-xl border border-slate-200 px-2 py-1"
              />
            </label>
            <label class="text-xs text-slate-500 block">
              Barcode
              <div class="mt-1 flex gap-2">
                <input
                  v-model="row.barcode"
                  type="text"
                  class="flex-1 rounded-xl border border-slate-200 px-2 py-1"
                  placeholder="Scan or type"
                />
                <button
                  type="button"
                  class="px-2 py-1 rounded-xl border border-slate-200 text-xs font-medium"
                  :disabled="row.generating"
                  @click="generateBarcodeForRow(row)"
                >
                  {{ row.generating ? '...' : 'Generate' }}
                </button>
              </div>
            </label>
          </div>
          <div class="flex flex-wrap items-center justify-between text-xs">
            <span
              :class="{
                'text-slate-500': row.status === 'pending',
                'text-amber-600': row.status === 'importing',
                'text-emerald-600': row.status === 'imported',
                'text-rose-600': row.status === 'error',
              }"
            >
              {{
                row.status === 'importing'
                  ? 'Syncing...'
                  : row.status === 'imported'
                    ? 'Imported'
                    : row.status === 'error'
                      ? 'Needs attention'
                      : 'Pending'
              }}
            </span>
            <div class="flex gap-3">
              <button type="button" class="text-rose-500" @click="removeRow(rows.indexOf(row))">Remove</button>
              <button
                type="button"
                class="px-3 py-1 rounded-xl border border-slate-200 text-xs font-semibold disabled:opacity-50"
                :disabled="row.status === 'importing' || rowErrors(row).length"
                @click="importSingleRow(row)"
              >
                {{ row.status === 'importing' ? 'Syncing...' : 'Import' }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="filteredRows.length === 0" class="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
          <span v-if="rowSearch">No rows match “{{ rowSearch }}”.</span>
          <span v-else>No rows loaded.</span>
        </div>
      </div>
      <div v-if="rowCamera.active" class="rounded-2xl border border-slate-200 p-4 space-y-3">
        <p class="text-sm font-semibold text-slate-700">Camera capture</p>
        <video
          ref="rowCameraVideo"
          autoplay
          muted
          playsinline
          class="w-full rounded-2xl border border-slate-200"
        ></video>
        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            class="px-4 py-2 rounded-2xl bg-brand-600 text-white text-sm font-semibold"
            @click="captureRowCamera"
          >
            Capture photo
          </button>
          <button type="button" class="px-4 py-2 rounded-2xl border border-slate-200 text-sm" @click="stopRowCamera">
            Cancel
          </button>
        </div>
        <p v-if="rowCamera.error" class="text-xs text-rose-500">{{ rowCamera.error }}</p>
      </div>
      <p v-if="rows.length && filteredRows.length === 0 && rowSearch" class="text-xs text-slate-500">
        Adjust or clear the search to see the remaining draft rows.
      </p>
      <p v-if="hasValidationErrors" class="text-xs text-amber-600">
        Fill required fields (name, brand, category, worth, barcode) before importing.
      </p>
      <div v-if="rows.some((row) => row.serverErrors.length)" class="text-xs text-rose-600">
        <p>Rows highlighted in red failed to import:</p>
        <ul class="list-disc ml-5">
          <li
            v-for="(row, index) in rows.filter((r) => r.serverErrors.length)"
            :key="`row-error-${index}`"
          >
            {{ row.serverErrors.join(', ') }}
          </li>
        </ul>
      </div>
      <div class="flex justify-end gap-3">
        <button
          type="button"
          class="px-4 py-2 rounded-2xl border border-slate-200 text-sm"
          :disabled="status.submitting"
          @click="resetState"
        >
          Reset
        </button>
        <button
          type="button"
          class="px-4 py-2 rounded-2xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
          :disabled="status.submitting || hasValidationErrors"
          @click="submitImport"
        >
          {{ status.submitting ? 'Importing...' : 'Import Products' }}
        </button>
      </div>
    </div>

    <div v-if="status.summary" class="card p-6 space-y-2">
      <p class="text-sm font-semibold text-slate-700">Import summary</p>
      <p class="text-sm text-slate-600">Imported: {{ status.summary.imported }}</p>
      <p class="text-sm text-slate-600">Failed: {{ status.summary.failed?.length || 0 }}</p>
      <p v-if="status.summary.failed?.length" class="text-xs text-slate-500">
        Rows listed above require attention. Fix the errors and re-import.
      </p>
    </div>
  </section>
</template>
