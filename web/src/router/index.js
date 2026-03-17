import { createRouter, createWebHistory } from 'vue-router';
import DashboardLayout from '@/layouts/DashboardLayout.vue';
const MobileLayout = () => import('@/layouts/MobileLayout.vue');
const MobileHomeView = () => import('@/views/mobile/MobileHomeView.vue');
import LoginView from '@/views/auth/LoginView.vue';
import DashboardView from '@/views/dashboard/DashboardView.vue';
import ModuleScaffold from '@/views/modules/ModuleScaffold.vue';
import PurchasesView from '@/views/modules/PurchasesView.vue';
import SalesView from '@/views/modules/SalesView.vue';
import TransfersView from '@/views/modules/TransfersView.vue';
import InventoryOverview from '@/views/modules/InventoryOverview.vue';
import ExcelProductsView from '@/views/modules/ExcelProductsView.vue';
import ProductCatalogView from '@/views/modules/ProductCatalogView.vue';
import SystemSettingsView from '@/views/settings/SystemSettingsView.vue';
import ProfitLossReport from '@/views/reports/ProfitLossReport.vue';
import WarehouseReport from '@/views/reports/WarehouseReport.vue';
import PaymentsReport from '@/views/reports/PaymentsReport.vue';
import { useAuthStore } from '@/stores/auth';
const TermsView = () => import('@/views/legal/TermsView.vue');
const PrivacyView = () => import('@/views/legal/PrivacyView.vue');

const moduleRoute = (path, name, meta = {}) => ({
  path,
  name,
  component: ModuleScaffold,
  meta: {
    resource: meta.resource ?? name,
    filters: {
      search: true,
      warehouse: false,
      status: false,
      ...(meta.filters || {}),
    },
    requiresPermission: meta.permission,
    ...meta,
  },
});

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { public: true, title: 'Login' },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/views/auth/ForgotPasswordView.vue'),
      meta: { public: true, title: 'Forgot Password' },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/views/auth/ResetPasswordView.vue'),
      meta: { public: true, title: 'Reset Password' },
    },
    {
      path: '/legal/terms',
      name: 'terms',
      component: TermsView,
      meta: { public: true, title: 'Terms of Use' },
    },
    {
      path: '/legal/privacy',
      name: 'privacy',
      component: PrivacyView,
      meta: { public: true, title: 'Privacy Policy' },
    },
    {
      path: '/',
      component: DashboardLayout,
      children: [
        {
          path: '',
          name: 'dashboard',
          component: DashboardView,
          meta: { title: 'Dashboard', requiresPermission: 'dashboard.view' },
        },
        {
          path: 'products',
          name: 'products',
          component: ProductCatalogView,
          meta: {
            resource: 'products',
            title: 'Products',
            description: 'Manage global SKU catalog shared by every warehouse.',
            columns: ['Code', 'Name', 'Category', 'Brand', 'Stock', 'Cost', 'Price', 'Stock Alert'],
            actions: [],
            filters: { search: true, warehouse: false, status: false },
            editAction: null,
            customEdit: true,
            exportType: 'products',
            permission: 'products.view',
            requiresPermission: 'products.view',
            advancedFilters: [
              {
                key: 'categoryId',
                label: 'Category',
                type: 'select',
                optionSource: 'categories',
                optionLabelKey: 'name',
                optionValueKey: 'id',
                valueKey: 'categoryId',
              },
              {
                key: 'brandId',
                label: 'Brand',
                type: 'select',
                optionSource: 'brands',
                optionLabelKey: 'name',
                optionValueKey: 'id',
                valueKey: 'brandId',
              },
            ],
          },
        },
        {
          path: 'inventory/overview',
          name: 'inventory-overview',
          component: InventoryOverview,
          meta: { title: 'Inventory Overview', requiresPermission: 'products.view' },
        },
        {
          path: 'products/excel',
          name: 'products-excel',
          component: ExcelProductsView,
          meta: {
            title: 'Bulk Products (CSV)',
            requiresPermission: 'products.create',
          },
        },
        moduleRoute('barcode-labels', 'barcode-labels', {
          resource: 'label-templates',
          title: 'Barcode & Labels',
          description: 'Generate printable barcode labels with unified templates.',
          columns: ['Template', 'Size', 'Updated'],
          actions: ['Create Template', 'Print Labels'],
          editAction: 'Create Template',
          permission: 'products.barcode',
        }),
        {
          path: 'transfers',
          name: 'transfers',
          component: TransfersView,
          meta: { title: 'Warehouse Transfers', requiresPermission: 'transfers.view' },
        },
        moduleRoute('expenses', 'expenses', {
          resource: 'expenses',
          title: 'Expenses',
          description: 'Track operating expenses across branches.',
          columns: ['Date', 'Reference', 'Details', 'Amount', 'Category', 'Warehouse'],
          actions: ['Log Expense'],
          filters: { warehouse: true },
          editAction: 'Log Expense',
          permission: 'expenses.view',
        }),
        moduleRoute('expense-categories', 'expense-categories', {
          resource: 'expense-categories',
          title: 'Expense Categories',
          description: 'Maintain your expense chart for reporting.',
          columns: ['Name', 'Description', 'Created'],
          actions: ['Add Expense Category'],
          editAction: 'Add Expense Category',
          permission: 'expenses.view',
        }),
        {
          path: 'purchases',
          name: 'purchases',
          component: PurchasesView,
          meta: { title: 'Purchases', requiresPermission: 'purchases.view' },
        },
        {
          path: 'sales',
          name: 'sales',
          component: SalesView,
          meta: { title: 'Sales', requiresPermission: 'sales.view' },
        },
        moduleRoute('sales-returns', 'sales-returns', {
          resource: 'returns',
          resourceParams: { type: 'sale' },
          title: 'Sales Returns',
          columns: ['Reference', 'Customer', 'Warehouse', 'Status', 'Grand Total', 'Paid', 'Due'],
          actions: ['New Sales Return'],
          filters: { warehouse: true, status: true },
          statusOptions: ['pending', 'completed'],
          editAction: 'New Sales Return',
          permission: 'salesReturns.view',
          advancedFilters: [
            {
              key: 'customer',
              label: 'Customer',
              type: 'text',
              match: (row, value) =>
                ((row.customer?.name || row.customer?.code || '').toLowerCase()).includes(
                  value.toLowerCase(),
                ),
            },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Completed', value: 'completed' },
              ],
              valueKey: 'status',
            },
            {
              key: 'minTotal',
              label: 'Min Total',
              type: 'number-min',
              valueKey: 'total',
            },
            {
              key: 'maxTotal',
              label: 'Max Total',
              type: 'number-max',
              valueKey: 'total',
            },
            {
              key: 'minQuantity',
              label: 'Min Quantity',
              type: 'number-min',
              match: (row, value) => {
                const totalQty = (row.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
                return totalQty >= Number(value);
              },
            },
            {
              key: 'product',
              label: 'Product Code or Name',
              type: 'text',
              match: (row, value) => {
                const query = value.toLowerCase();
                return (row.items || []).some((item) => {
                  const product = item.Product || item.product || {};
                  return (
                    product.name?.toLowerCase().includes(query) ||
                    product.code?.toLowerCase().includes(query)
                  );
                });
              },
            },
          ],
        }),
        moduleRoute('purchase-returns', 'purchase-returns', {
          resource: 'returns',
          resourceParams: { type: 'purchase' },
          title: 'Purchase Returns',
          columns: ['Reference', 'Supplier', 'Warehouse', 'Status', 'Grand Total', 'Paid', 'Due'],
          actions: ['New Purchase Return'],
          filters: { warehouse: true, status: true },
          statusOptions: ['pending', 'completed'],
          editAction: 'New Purchase Return',
          permission: 'purchaseReturns.view',
          advancedFilters: [
            {
              key: 'supplier',
              label: 'Supplier',
              type: 'text',
              match: (row, value) =>
                ((row.supplier?.name || row.supplier?.code || '').toLowerCase()).includes(
                  value.toLowerCase(),
                ),
            },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Completed', value: 'completed' },
              ],
              valueKey: 'status',
            },
            {
              key: 'minTotal',
              label: 'Min Total',
              type: 'number-min',
              valueKey: 'total',
            },
            {
              key: 'maxTotal',
              label: 'Max Total',
              type: 'number-max',
              valueKey: 'total',
            },
            {
              key: 'minQuantity',
              label: 'Min Quantity',
              type: 'number-min',
              match: (row, value) => {
                const totalQty = (row.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
                return totalQty >= Number(value);
              },
            },
            {
              key: 'product',
              label: 'Product Code or Name',
              type: 'text',
              match: (row, value) => {
                const query = value.toLowerCase();
                return (row.items || []).some((item) => {
                  const product = item.Product || item.product || {};
                  return (
                    product.name?.toLowerCase().includes(query) ||
                    product.code?.toLowerCase().includes(query)
                  );
                });
              },
            },
          ],
        }),
        moduleRoute('customers', 'customers', {
          resource: 'customers',
          title: 'Customers',
          columns: ['Code', 'Name', 'Phone', 'Email', 'Country', 'City'],
          actions: ['Add Customer', 'Import CSV'],
          editAction: 'Add Customer',
          exportType: 'customers',
          permission: 'customers.view',
        }),
        moduleRoute('suppliers', 'suppliers', {
          resource: 'suppliers',
          title: 'Suppliers',
          columns: ['Code', 'Name', 'Phone', 'Email', 'Country', 'City'],
          actions: ['Add Supplier'],
          editAction: 'Add Supplier',
          exportType: 'suppliers',
          permission: 'suppliers.view',
        }),
        moduleRoute('users', 'users', {
          resource: 'users',
          title: 'Users',
          columns: ['First Name', 'Last Name', 'Username', 'Email', 'Phone', 'Status'],
          actions: ['Invite User'],
          filters: { status: true },
          statusOptions: ['active', 'invited', 'disabled'],
          editAction: 'Invite User',
          permission: 'users.view',
        }),
        moduleRoute('notes', 'notes', {
          resource: 'notes',
          title: 'Notebook',
          description: 'Pin compliance notes and attach documents.',
          columns: ['Title', 'Pinned', 'Updated'],
          actions: ['Add Note'],
          editAction: 'Add Note',
          permission: 'notes.view',
        }),
        {
          path: 'settings/system',
          name: 'settings-system',
          component: SystemSettingsView,
          meta: { title: 'System Settings', requiresPermission: 'settings.system' },
        },
        moduleRoute('settings/warehouses', 'settings-warehouses', {
          resource: 'warehouses',
          title: 'Warehouses',
          columns: ['Name', 'Type', 'Phone', 'City', 'Country', 'Email'],
          actions: ['Add Warehouse'],
          editAction: 'Add Warehouse',
          permission: 'settings.warehouse',
        }),
        moduleRoute('settings/categories', 'settings-categories', {
          resource: 'categories',
          title: 'Product Categories',
          columns: ['Code', 'Name'],
          actions: ['Add Product Category'],
          editAction: 'Add Product Category',
          permission: 'settings.category',
        }),
        moduleRoute('settings/brands', 'settings-brands', {
          resource: 'brands',
          title: 'Brands',
          columns: ['Name', 'Description'],
          actions: ['Add Brand'],
          editAction: 'Add Brand',
          permission: 'settings.brand',
        }),
        moduleRoute('settings/currencies', 'settings-currencies', {
          resource: 'currencies',
          title: 'Currencies',
          columns: ['Code', 'Name', 'Symbol'],
          actions: ['Add Currency'],
          editAction: 'Add Currency',
          permission: 'settings.currency',
        }),
        moduleRoute('settings/units', 'settings-units', {
          resource: 'units',
          title: 'Units',
          columns: ['Name', 'Short', 'Base Unit', 'Operator', 'Value'],
          actions: ['Add Unit'],
          editAction: 'Add Unit',
          permission: 'settings.unit',
        }),
        moduleRoute('settings/permissions', 'settings-permissions', {
          resource: 'roles',
          title: 'Group Permissions',
          description: 'Define high-management roles and assign fine-grained access.',
          columns: ['Name', 'Description', 'Created At'],
          actions: ['Add Role'],
          editAction: 'Add Role',
          permission: 'roles.manage',
        }),
        {
          path: 'reports/profit-loss',
          name: 'reports-profit-loss',
          component: ProfitLossReport,
          meta: { title: 'Profit & Loss', requiresPermission: 'reports.profitLoss' },
        },
        {
          path: 'reports/payments',
          name: 'reports-payments',
          component: PaymentsReport,
          meta: { title: 'Payments Report', requiresPermission: 'reports.salesPayments' },
        },
        {
          path: 'reports/product-alerts',
          name: 'reports-product-alerts',
          component: ModuleScaffold,
          meta: {
            resource: null,
            title: 'Product Quantity Alerts',
            columns: ['Code', 'Product', 'Warehouse', 'Quantity', 'Alert Quantity'],
            actions: ['Export PDF'],
            reportEndpoint: '/reports/product-alerts',
            requiresPermission: 'reports.alerts',
          },
        },
        {
          path: 'reports/warehouse',
          name: 'reports-warehouse',
          component: WarehouseReport,
          meta: { title: 'Warehouse Report', requiresPermission: 'reports.warehouse' },
        },
        {
          path: 'reports/sales',
          name: 'reports-sales',
          component: ModuleScaffold,
          meta: {
            title: 'Sales Report',
            columns: ['Date', 'Reference', 'Customer', 'Status', 'Grand Total', 'Paid', 'Due'],
            actions: ['Export CSV'],
            exportType: 'sales',
            requiresPermission: 'reports.sales',
          },
        },
        {
          path: 'reports/purchases',
          name: 'reports-purchases',
          component: ModuleScaffold,
          meta: {
            title: 'Purchase Report',
            columns: ['Date', 'Reference', 'Supplier', 'Status', 'Grand Total', 'Paid', 'Due'],
            actions: ['Export CSV'],
            exportType: 'purchases',
            requiresPermission: 'reports.purchases',
          },
        },
        {
          path: 'reports/customers',
          name: 'reports-customers',
          component: ModuleScaffold,
          meta: {
            title: 'Customer Report',
            columns: ['Code', 'Customer', 'Phone', 'Total Sales', 'Total Amount', 'Paid', 'Due'],
            actions: ['Export CSV'],
            exportType: 'customers',
            requiresPermission: 'reports.customers',
          },
        },
        {
          path: 'reports/suppliers',
          name: 'reports-suppliers',
          component: ModuleScaffold,
          meta: {
            title: 'Supplier Report',
            columns: ['Code', 'Supplier', 'Phone', 'Total Purchases', 'Total Amount', 'Paid', 'Due'],
            actions: ['Export CSV'],
            exportType: 'suppliers',
            requiresPermission: 'reports.suppliers',
          },
        },
      ],
    },
    {
      path: '/mobile',
      component: MobileLayout,
      meta: { title: 'Mobile', requiresPermission: 'dashboard.view' },
      children: [
        {
          path: '',
          name: 'mobile-home',
          component: MobileHomeView,
          meta: { title: 'Mobile Home', requiresPermission: 'dashboard.view' },
        },
      ],
    },
  ],
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  document.title = to.meta?.title ? `${to.meta.title} · Inventory Cloud` : 'Inventory Cloud';

  if (!to.meta?.public) {
    if (!authStore.isAuthenticated) {
      return next({ name: 'login' });
    }
    if (!authStore.profileLoaded) {
      try {
        await authStore.fetchProfile();
      } catch (error) {
        authStore.logout();
        return next({ name: 'login' });
      }
    }
  }

  if (to.name === 'login' && authStore.isAuthenticated) {
    return next({ name: 'dashboard' });
  }

  if (to.meta?.requiresPermission && !authStore.hasPermission(to.meta.requiresPermission)) {
    return next({ name: 'dashboard' });
  }

  return next();
});

export default router;
