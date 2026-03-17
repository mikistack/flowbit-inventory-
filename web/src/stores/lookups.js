import { defineStore } from 'pinia';
import api from '@/utils/api';

export const useLookupStore = defineStore('lookups', {
  state: () => ({
    warehouses: [],
    customers: [],
    suppliers: [],
    products: [],
    categories: [],
    brands: [],
    units: [],
    currencies: [],
    expenseCategories: [],
    labelTemplates: [],
    roles: [],
  }),
  actions: {
    async fetchResource(key, endpoint, options = {}) {
      const { force = false } = options;
      if (!force && this[key]?.length) return;
      const { data } = await api.get(endpoint, { params: { limit: 100 } });
      this[key] = data.data || data;
    },
    loadWarehouses(force = false) {
      return this.fetchResource('warehouses', '/warehouses', { force });
    },
    loadCustomers(force = false) {
      return this.fetchResource('customers', '/customers', { force });
    },
    loadSuppliers(force = false) {
      return this.fetchResource('suppliers', '/suppliers', { force });
    },
    loadProducts(force = false) {
      return this.fetchResource('products', '/products', { force });
    },
    loadCategories(force = false) {
      return this.fetchResource('categories', '/categories', { force });
    },
    loadExpenseCategories(force = false) {
      return this.fetchResource('expenseCategories', '/expense-categories', { force });
    },
    loadBrands(force = false) {
      return this.fetchResource('brands', '/brands', { force });
    },
    loadUnits(force = false) {
      return this.fetchResource('units', '/units', { force });
    },
    loadCurrencies(force = false) {
      return this.fetchResource('currencies', '/currencies', { force });
    },
    loadLabelTemplates(force = false) {
      return this.fetchResource('labelTemplates', '/label-templates', { force });
    },
    loadRoles(force = false) {
      return this.fetchResource('roles', '/roles', { force });
    },
  },
});
