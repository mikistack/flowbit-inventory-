<script setup>
import { computed, reactive, ref, onBeforeUnmount, onMounted } from 'vue';
import api from '@/utils/api';
import ModuleScaffold from '@/views/modules/ModuleScaffold.vue';
import { useLookupStore } from '@/stores/lookups';

const quickForm = reactive({
  name: '',
  brandName: '',
  categoryName: '',
  worth: '',
  barcode: '',
  photoData: '',
  photoPreview: '',
  photoName: '',
});

const quickStatus = reactive({
  submitting: false,
  error: '',
  success: '',
});

const scaffoldRef = ref(null);
const lookupStore = useLookupStore();

const cameraState = reactive({
  active: false,
  loading: false,
  error: '',
  stream: null,
});

const videoRef = ref(null);
const cameraSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

const brandOptions = computed(() =>
  (lookupStore.brands || []).map((brand) => ({ value: brand.id, label: brand.name })),
);
const categoryOptions = computed(() =>
  (lookupStore.categories || []).map((category) => ({ value: category.id, label: category.name })),
);

const numericOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
};

const refreshCatalog = () => {
  scaffoldRef.value?.refresh?.();
};

const fieldErrors = computed(() => {
  const errors = [];
  if (!quickForm.name?.trim()) errors.push('Name required');
  if (!quickForm.brandName?.trim()) errors.push('Brand required');
  if (!quickForm.categoryName?.trim()) errors.push('Category required');
  if (quickForm.worth === '' || quickForm.worth === null || Number.isNaN(Number(quickForm.worth))) {
    errors.push('Worth required');
  }
  if (!quickForm.barcode?.trim()) errors.push('Barcode required');
  return errors;
});

const hasErrors = computed(() => fieldErrors.value.length > 0);

const resetQuickForm = () => {
  quickForm.name = '';
  quickForm.brandName = '';
  quickForm.categoryName = '';
  quickForm.worth = '';
  quickForm.barcode = '';
  quickForm.photoData = '';
  quickForm.photoPreview = '';
  quickForm.photoName = '';
  stopCamera();
};

const handleImageChange = (event) => {
  const input = event.target;
  const [file] = input?.files || [];
  if (!file) {
    quickForm.photoData = '';
    quickForm.photoPreview = '';
    quickForm.photoName = '';
    return;
  }
  stopCamera();
  const reader = new FileReader();
  reader.onload = () => {
    quickForm.photoData = reader.result?.toString() || '';
    quickForm.photoPreview = reader.result?.toString() || '';
    quickForm.photoName = file.name;
  };
  reader.readAsDataURL(file);
  if (input) {
    input.value = '';
  }
};

const removeImage = () => {
  quickForm.photoData = '';
  quickForm.photoPreview = '';
  quickForm.photoName = '';
  stopCamera();
};

const generateBarcode = async () => {
  quickStatus.error = '';
  quickStatus.success = '';
  try {
    const { data } = await api.post('/products/generate-code');
    quickForm.barcode = data.code;
  } catch (error) {
    quickStatus.error = error.response?.data?.message || 'Failed to generate barcode.';
  }
};

const submitQuickAdd = async () => {
  quickStatus.error = '';
  quickStatus.success = '';
  if (hasErrors.value) {
    quickStatus.error = 'Complete the required fields first.';
    return;
  }
  quickStatus.submitting = true;
  try {
    await api.post('/products/import-excel', {
      items: [
        {
          name: quickForm.name,
          brandName: quickForm.brandName,
          categoryName: quickForm.categoryName,
          worth: quickForm.worth,
          barcode: quickForm.barcode,
          photoData: quickForm.photoData,
        },
      ],
      mapWorthTo: 'both',
    });
    quickStatus.success = 'Product saved to catalog.';
    resetQuickForm();
    refreshCatalog();
  } catch (error) {
    quickStatus.error = error.response?.data?.message || 'Failed to save product.';
  } finally {
    quickStatus.submitting = false;
  }
};

const startCamera = async () => {
  if (!cameraSupported) {
    cameraState.error = 'Camera not supported on this device.';
    return;
  }
  cameraState.error = '';
  cameraState.loading = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    cameraState.stream = stream;
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      await videoRef.value.play();
    }
    cameraState.active = true;
  } catch (error) {
    cameraState.error = 'Unable to access camera.';
    stopCamera();
  } finally {
    cameraState.loading = false;
  }
};

const stopCamera = () => {
  if (cameraState.stream) {
    cameraState.stream.getTracks().forEach((track) => track.stop());
  }
  cameraState.stream = null;
  cameraState.active = false;
};

const captureFromCamera = () => {
  if (!videoRef.value) return;
  const canvas = document.createElement('canvas');
  const width = videoRef.value.videoWidth || 640;
  const height = videoRef.value.videoHeight || 480;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoRef.value, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/png');
  quickForm.photoData = dataUrl;
  quickForm.photoPreview = dataUrl;
  quickForm.photoName = 'camera-capture.png';
  stopCamera();
};

onBeforeUnmount(() => {
  stopCamera();
});

onMounted(() => {
  lookupStore.loadBrands();
  lookupStore.loadCategories();
});

const editState = reactive({
  open: false,
  loading: false,
  saving: false,
  error: '',
  success: '',
});

const editForm = reactive({
  id: null,
  name: '',
  brandId: '',
  categoryId: '',
  barcode: '',
  cost: '',
  price: '',
  stockAlert: '',
  note: '',
  photoPreview: '',
  photoData: '',
});

const editFormErrors = computed(() => {
  const errors = [];
  if (!editForm.name?.trim()) errors.push('Name required');
  if (!editForm.brandId) errors.push('Brand required');
  if (!editForm.categoryId) errors.push('Category required');
  if (!editForm.barcode?.trim()) errors.push('Barcode required');
  return errors;
});

const openProductEditor = async (row) => {
  if (!row?.id) return;
  editState.open = true;
  editState.loading = true;
  editState.error = '';
  editState.success = '';
  try {
    const { data } = await api.get(`/products/${row.id}`);
    editForm.id = data.id;
    editForm.name = data.name || '';
    editForm.brandId = data.brandId || data.Brand?.id || '';
    editForm.categoryId = data.categoryId || data.Category?.id || '';
    editForm.barcode = data.code || '';
    editForm.cost = data.cost ?? '';
    editForm.price = data.price ?? '';
    editForm.stockAlert = data.stockAlert ?? '';
    editForm.note = data.note || '';
    editForm.photoPreview = data.images?.[0]?.url || '';
    editForm.photoData = '';
  } catch (error) {
    editState.error = error.response?.data?.message || 'Failed to load product.';
  } finally {
    editState.loading = false;
  }
};

const closeProductEditor = () => {
  editState.open = false;
  editState.loading = false;
  editState.saving = false;
  editState.error = '';
  editState.success = '';
};

const handleEditImageChange = (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    editForm.photoData = reader.result?.toString() || '';
    editForm.photoPreview = reader.result?.toString() || '';
  };
  reader.readAsDataURL(file);
  if (event.target) {
    event.target.value = '';
  }
};

const removeEditImage = () => {
  editForm.photoData = '';
  editForm.photoPreview = '';
};

const saveProductEdits = async () => {
  editState.error = '';
  editState.success = '';
  if (editFormErrors.value.length) {
    editState.error = 'Complete required fields.';
    return;
  }
  editState.saving = true;
  try {
    const payload = {
      name: editForm.name,
      brandId: editForm.brandId || null,
      categoryId: editForm.categoryId || null,
      code: editForm.barcode,
      cost: numericOrNull(editForm.cost),
      price: numericOrNull(editForm.price),
      stockAlert: numericOrNull(editForm.stockAlert),
      note: editForm.note || null,
    };
    if (editForm.photoData) {
      payload.photoData = editForm.photoData;
    }
    await api.put(`/products/${editForm.id}`, payload);
    editState.success = 'Product updated.';
    refreshCatalog();
  } catch (error) {
    editState.error = error.response?.data?.message || 'Failed to update product.';
  } finally {
    editState.saving = false;
  }
};
</script>

<template>
  <section class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-slate-700">Quick add product</p>
          <p class="text-xs text-slate-500">
            Scan or type in details to create a product instantly. Brands and categories are created automatically if
            they don’t exist yet, and you can attach a cover image for immediate syncing across the catalog.
          </p>
        </div>
        <button type="button" class="text-xs text-brand-600 font-semibold" @click="generateBarcode">
          Generate barcode
        </button>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label class="text-sm text-slate-600">
          Name
          <input v-model="quickForm.name" type="text" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" />
        </label>
        <label class="text-sm text-slate-600">
          Brand
          <input
            v-model="quickForm.brandName"
            type="text"
            class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
          />
        </label>
        <label class="text-sm text-slate-600">
          Category
          <input
            v-model="quickForm.categoryName"
            type="text"
            class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
          />
        </label>
        <label class="text-sm text-slate-600">
          Worth (cost & price)
          <input
            v-model.number="quickForm.worth"
            type="number"
            min="0"
            step="0.01"
            class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
          />
        </label>
        <label class="text-sm text-slate-600">
          Barcode
          <input
            v-model="quickForm.barcode"
            type="text"
            class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
            placeholder="Scan or type"
          />
        </label>
        <label class="text-sm text-slate-600 lg:col-span-3">
          Product image
          <input
            type="file"
            accept="image/*"
            capture="environment"
            class="mt-1 w-full rounded-2xl border border-dashed border-slate-300 px-3 py-2 text-sm bg-white"
            @change="handleImageChange"
          />
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-if="cameraSupported && !cameraState.active"
              type="button"
              class="px-3 py-2 rounded-2xl border border-slate-200 text-sm"
              :disabled="cameraState.loading"
              @click="startCamera"
            >
              {{ cameraState.loading ? 'Opening camera...' : 'Use camera' }}
            </button>
          </div>
          <div v-if="cameraState.active" class="mt-3 space-y-2">
            <video
              ref="videoRef"
              autoplay
              muted
              playsinline
              class="w-full rounded-2xl border border-slate-200"
            ></video>
            <div class="flex flex-wrap gap-3">
              <button
                type="button"
                class="px-4 py-2 rounded-2xl bg-brand-600 text-white text-sm font-semibold"
                @click="captureFromCamera"
              >
                Capture photo
              </button>
              <button type="button" class="px-4 py-2 rounded-2xl border border-slate-200 text-sm" @click="stopCamera">
                Cancel camera
              </button>
            </div>
          </div>
          <p v-if="cameraState.error" class="text-xs text-rose-500 mt-2">{{ cameraState.error }}</p>
          <div v-if="quickForm.photoPreview" class="mt-3 flex items-center gap-3">
            <img :src="quickForm.photoPreview" alt="Product preview" class="h-20 w-20 rounded-2xl object-cover" />
            <div class="text-xs text-slate-500">
              <p>{{ quickForm.photoName }}</p>
              <button
                type="button"
                class="text-rose-500 font-semibold mt-1"
                @click="removeImage"
              >
                Remove image
              </button>
            </div>
          </div>
        </label>
      </div>
      <div v-if="hasErrors" class="text-xs text-rose-600">
        Missing info:
        {{ fieldErrors.join(', ') }}
      </div>
      <p v-if="quickStatus.error" class="text-sm text-rose-500">{{ quickStatus.error }}</p>
      <p v-if="quickStatus.success" class="text-sm text-emerald-600">{{ quickStatus.success }}</p>
      <div class="flex flex-wrap gap-3">
        <button
          type="button"
          class="px-4 py-2 rounded-2xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
          :disabled="quickStatus.submitting"
          @click="submitQuickAdd"
        >
          {{ quickStatus.submitting ? 'Saving...' : 'Add to catalog' }}
        </button>
        <button type="button" class="px-4 py-2 rounded-2xl border border-slate-200 text-sm" @click="resetQuickForm">
          Clear form
        </button>
      </div>
    </div>

    <ModuleScaffold ref="scaffoldRef" @edit-record="openProductEditor" />

    <div
      v-if="editState.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
    >
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <header class="flex items-start justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-brand-500">Products</p>
            <h2 class="text-xl font-semibold">Edit product</h2>
            <p class="text-slate-500 text-xs">Update product details, cost, price, and image.</p>
          </div>
          <button type="button" class="text-slate-400 hover:text-slate-600" @click="closeProductEditor">
            ✕
          </button>
        </header>
        <div v-if="editState.loading" class="text-sm text-slate-500">Loading product...</div>
        <div v-else class="space-y-3">
          <div v-if="editFormErrors.length" class="text-xs text-amber-600">
            Fix: {{ editFormErrors.join(', ') }}
          </div>
          <p v-if="editState.error" class="text-sm text-rose-500">{{ editState.error }}</p>
          <p v-if="editState.success" class="text-sm text-emerald-600">{{ editState.success }}</p>
          <label class="text-sm text-slate-600 block">
            Name
            <input v-model="editForm.name" type="text" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" />
          </label>
          <label class="text-sm text-slate-600 block">
            Brand
            <select v-model="editForm.brandId" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Select brand</option>
              <option v-for="option in brandOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
          <label class="text-sm text-slate-600 block">
            Category
            <select v-model="editForm.categoryId" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Select category</option>
              <option v-for="option in categoryOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="text-sm text-slate-600">
              Cost
              <input
                v-model="editForm.cost"
                type="number"
                min="0"
                step="0.01"
                class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label class="text-sm text-slate-600">
              Price
              <input
                v-model="editForm.price"
                type="number"
                min="0"
                step="0.01"
                class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
          <label class="text-sm text-slate-600 block">
            Barcode
            <input
              v-model="editForm.barcode"
              type="text"
              class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label class="text-sm text-slate-600 block">
            Stock alert
            <input
              v-model="editForm.stockAlert"
              type="number"
              min="0"
              step="1"
              class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label class="text-sm text-slate-600 block">
            Notes
            <textarea
              v-model="editForm.note"
              rows="2"
              class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
            ></textarea>
          </label>
          <label class="text-sm text-slate-600 block">
            Product image
            <input
              type="file"
              accept="image/*"
              class="mt-1 w-full rounded-2xl border border-dashed border-slate-300 px-3 py-2 text-sm bg-white"
              @change="handleEditImageChange"
            />
            <div v-if="editForm.photoPreview" class="mt-3 flex items-center gap-3">
              <img :src="editForm.photoPreview" alt="Edit preview" class="h-16 w-16 rounded-xl object-cover" />
              <button type="button" class="text-xs text-rose-500" @click="removeEditImage">Remove</button>
            </div>
          </label>
          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="px-4 py-2 rounded-2xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
              :disabled="editState.saving"
              @click="saveProductEdits"
            >
              {{ editState.saving ? 'Saving...' : 'Save changes' }}
            </button>
            <button type="button" class="px-4 py-2 rounded-2xl border border-slate-200 text-sm" @click="closeProductEditor">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
