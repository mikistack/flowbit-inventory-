<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  products: {
    type: Array,
    default: () => [],
  },
  modelValue: {
    type: [Number, String, null],
    default: null,
  },
  placeholder: {
    type: String,
    default: 'Search product…',
  },
  label: {
    type: String,
    default: 'Product',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'selected']);

const search = ref('');
const open = ref(false);
let lastSyncedId = null;

const syncFromValue = () => {
  const selected = props.products.find((product) => product.id === props.modelValue);
  lastSyncedId = props.modelValue ?? null;
  search.value = selected?.name || '';
};

watch(
  () => props.modelValue,
  (value) => {
    if (value === lastSyncedId) return;
    syncFromValue();
  },
  { immediate: true },
);

watch(
  () => props.products,
  () => {
    syncFromValue();
  },
);

const suggestions = computed(() => {
  const term = search.value.trim().toLowerCase();
  if (!term) {
    return props.products.slice(0, 6);
  }
  return props.products
    .filter((product) => {
      const fields = [product.name, product.code, product.sku];
      return fields
        .filter(Boolean)
        .some((field) => field.toString().toLowerCase().includes(term));
    })
    .slice(0, 8);
});

const selectProduct = (product) => {
  emit('update:modelValue', product.id);
  emit('selected', product);
  search.value = product.name || '';
  lastSyncedId = product.id;
  open.value = false;
};

const handleInput = () => {
  open.value = true;
};

const handleFocus = () => {
  open.value = true;
};

const handleBlur = () => {
  setTimeout(() => {
    open.value = false;
    syncFromValue();
  }, 120);
};
</script>

<template>
  <label class="text-xs text-slate-500 block">
    {{ label }}
    <div class="relative mt-1">
      <input
        v-model="search"
        :placeholder="placeholder"
        type="search"
        class="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-brand-200"
        :disabled="disabled"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
      />
      <ul
        v-if="open && suggestions.length"
        class="absolute z-20 bg-white border border-slate-100 rounded-xl shadow-md mt-1 w-full max-h-52 overflow-y-auto text-sm"
      >
        <li
          v-for="product in suggestions"
          :key="product.id"
          class="px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-3"
          @mousedown.prevent="selectProduct(product)"
        >
          <div class="h-10 w-10 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center text-[11px] text-slate-500 uppercase">
            <img
              v-if="product.images?.length"
              :src="product.images[0].url"
              alt=""
              class="h-full w-full object-cover"
            />
            <span v-else>{{ ((product.name || '?').slice(0, 2) || '?').toUpperCase() }}</span>
          </div>
          <div class="flex-1 flex flex-col">
            <span class="text-slate-800 font-medium">{{ product.name }}</span>
            <span class="text-[11px] text-slate-500">{{ product.code || '—' }}</span>
          </div>
        </li>
      </ul>
      <p v-if="open && !suggestions.length" class="absolute z-20 bg-white border border-slate-100 rounded-xl shadow-md mt-1 w-full px-3 py-2 text-xs text-slate-500">
        No matching products
      </p>
    </div>
  </label>
</template>
