<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import api from '@/utils/api';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  record: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['update:modelValue', 'saved']);

const state = reactive({
  loadingPermissions: false,
  saving: false,
  error: '',
  success: '',
});

const form = reactive({
  name: '',
  description: '',
});

const errors = reactive({
  name: '',
});

const permissionGroups = ref([]);
const selectedKeys = ref(new Set());

const groupedPermissions = computed(() => permissionGroups.value);
const isEditing = computed(() => Boolean(props.record?.id));
const modalTitle = computed(() => (isEditing.value ? 'Edit Role' : 'Create Permission'));
const actionLabel = computed(() => (isEditing.value ? 'Update Role' : 'Create Role'));

const close = () => {
  emit('update:modelValue', false);
};

const resetForm = () => {
  form.name = '';
  form.description = '';
  selectedKeys.value = new Set();
  errors.name = '';
  state.error = '';
  state.success = '';
};

const applyRecord = (record) => {
  if (!record) {
    resetForm();
    return;
  }
  form.name = record.name || '';
  form.description = record.description || '';
  const keys =
    record.permissions?.map((permission) =>
      typeof permission === 'string' ? permission : permission.key,
    ) || [];
  selectedKeys.value = new Set(keys);
};

const loadPermissions = async () => {
  state.loadingPermissions = true;
  state.error = '';
  try {
    const { data } = await api.get('/permissions', { params: { limit: 500 } });
    const rows = data.data || data || [];
    const groups = rows.reduce((acc, permission) => {
      const moduleName = permission.module || 'General';
      if (!acc[moduleName]) acc[moduleName] = [];
      acc[moduleName].push(permission);
      return acc;
    }, {});
    permissionGroups.value = Object.entries(groups).map(([moduleName, permissions]) => ({
      moduleName,
      permissions,
    }));
  } catch (error) {
    state.error = error.response?.data?.message || 'Failed to load permissions.';
  } finally {
    state.loadingPermissions = false;
  }
};

const togglePermission = (key) => {
  const updated = new Set(selectedKeys.value);
  if (updated.has(key)) {
    updated.delete(key);
  } else {
    updated.add(key);
  }
  selectedKeys.value = updated;
};

const selectAllInModule = (moduleName) => {
  const module = permissionGroups.value.find((group) => group.moduleName === moduleName);
  if (!module) return;
  const updated = new Set(selectedKeys.value);
  const allSelected = module.permissions.every((perm) => updated.has(perm.key));
  module.permissions.forEach((perm) => {
    if (allSelected) {
      updated.delete(perm.key);
    } else {
      updated.add(perm.key);
    }
  });
  selectedKeys.value = updated;
};

const isModuleFullySelected = (moduleName) => {
  const module = permissionGroups.value.find((group) => group.moduleName === moduleName);
  if (!module) return false;
  return module.permissions.every((perm) => selectedKeys.value.has(perm.key));
};

const validate = () => {
  let valid = true;
  if (!form.name.trim()) {
    errors.name = 'Role name is required';
    valid = false;
  } else {
    errors.name = '';
  }
  return valid;
};

const submit = async () => {
  if (!validate()) return;
  state.saving = true;
  state.error = '';
  state.success = '';
  try {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      permissions: Array.from(selectedKeys.value),
    };
    if (isEditing.value && props.record?.id) {
      await api.put(`/roles/${props.record.id}`, payload);
      state.success = 'Role updated successfully.';
    } else {
      await api.post('/roles', payload);
      state.success = 'Role created successfully.';
    }
    emit('saved');
    close();
  } catch (error) {
    state.error = error.response?.data?.message || 'Failed to create role.';
  } finally {
    state.saving = false;
  }
};

watch(
  () => props.modelValue,
  async (visible) => {
    if (visible) {
      state.error = '';
      state.success = '';
      errors.name = '';
      if (isEditing.value) {
        applyRecord(props.record);
      } else {
        resetForm();
      }
      await loadPermissions();
      if (isEditing.value) {
        applyRecord(props.record);
      }
    } else {
      resetForm();
    }
  },
);

watch(
  () => props.record,
  (record) => {
    if (props.modelValue && isEditing.value && record) {
      applyRecord(record);
    }
  },
);

onMounted(() => {
  if (props.modelValue) {
    loadPermissions();
  }
});
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-5xl rounded-3xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <header class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-brand-500">Settings</p>
            <h2 class="text-xl font-semibold text-slate-900">{{ modalTitle }}</h2>
          </div>
          <button type="button" class="text-slate-500 hover:text-slate-700" @click="close">
            ✕
          </button>
        </header>

        <div class="px-6 py-5 space-y-6">
          <p v-if="state.error" class="text-sm text-rose-600">{{ state.error }}</p>
          <p v-if="state.success" class="text-sm text-emerald-600">{{ state.success }}</p>

          <div class="grid gap-4 md:grid-cols-2">
            <label class="text-sm text-slate-600 flex flex-col gap-1">
              Role Name
              <input
                v-model="form.name"
                type="text"
                class="input"
                :class="{ 'border-rose-400 focus:ring-rose-200': errors.name }"
                placeholder="Enter role name"
              />
              <span v-if="errors.name" class="text-xs text-rose-600">{{ errors.name }}</span>
            </label>
            <label class="text-sm text-slate-600 flex flex-col gap-1">
              Role Description
              <input v-model="form.description" type="text" class="input" placeholder="Enter description" />
            </label>
          </div>

          <div v-if="state.loadingPermissions" class="text-sm text-slate-500">Loading permissions…</div>
          <div v-else class="grid gap-4 lg:grid-cols-3">
            <div
              v-for="group in groupedPermissions"
              :key="group.moduleName"
              class="card p-4 space-y-3"
            >
              <div class="flex items-center justify-between">
                <h3 class="font-semibold text-slate-800">{{ group.moduleName }}</h3>
                <button
                  type="button"
                  class="text-xs text-brand-600"
                  @click="selectAllInModule(group.moduleName)"
                >
                  {{ isModuleFullySelected(group.moduleName) ? 'Clear All' : 'Select All' }}
                </button>
              </div>
              <div class="grid gap-2">
                <label
                  v-for="permission in group.permissions"
                  :key="permission.key"
                  class="flex items-center gap-2 text-sm text-slate-600"
                >
                  <input
                    type="checkbox"
                    class="rounded border-slate-300"
                    :checked="selectedKeys.has(permission.key)"
                    @change="togglePermission(permission.key)"
                  />
                  <span>{{ permission.label || permission.key }}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <footer class="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button type="button" class="btn-secondary" @click="close">Cancel</button>
          <button type="button" class="btn-primary" :disabled="state.saving" @click="submit">
            {{ state.saving ? 'Saving…' : actionLabel }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.card {
  @apply rounded-2xl border border-slate-100 bg-white shadow-sm;
}
.input {
  @apply rounded-2xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-200;
}
.btn-primary {
  @apply px-4 py-2 rounded-2xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50;
}
.btn-secondary {
  @apply px-4 py-2 rounded-2xl border border-slate-200 text-sm font-semibold hover:bg-slate-50;
}
</style>
