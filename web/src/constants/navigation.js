export const navigation = [
  {
    label: 'Dashboard',
    icon: 'HomeIcon',
    to: { name: 'dashboard' },
    permission: 'dashboard.view',
  },
  {
    label: 'Products',
    icon: 'TagIcon',
    children: [
      { label: 'Product Catalog', to: { name: 'products' }, permission: 'products.view' },
      { label: 'Inventory Overview', to: { name: 'inventory-overview' }, permission: 'products.view' },
      { label: 'Excel Products', to: { name: 'products-excel' }, permission: 'products.create' },
      { label: 'Barcode & Labels', to: { name: 'barcode-labels' }, permission: 'products.barcode' },
      { label: 'Transfers', to: { name: 'transfers' }, permission: 'transfers.view' },
    ],
  },
  {
    label: 'Transactions',
    icon: 'ArrowsRightLeftIcon',
    children: [
      { label: 'Expenses', to: { name: 'expenses' }, permission: 'expenses.view' },
      { label: 'Expense Categories', to: { name: 'expense-categories' }, permission: 'expenses.view' },
      { label: 'Purchases', to: { name: 'purchases' }, permission: 'purchases.view' },
      { label: 'Sales', to: { name: 'sales' }, permission: 'sales.view' },
      { label: 'Sales Return', to: { name: 'sales-returns' }, permission: 'salesReturns.view' },
      { label: 'Purchase Return', to: { name: 'purchase-returns' }, permission: 'purchaseReturns.view' },
    ],
  },
  {
    label: 'People',
    icon: 'UsersIcon',
    children: [
      { label: 'Customers', to: { name: 'customers' }, permission: 'customers.view' },
      { label: 'Suppliers', to: { name: 'suppliers' }, permission: 'suppliers.view' },
      { label: 'Users', to: { name: 'users' }, permission: 'users.view' },
      { label: 'Notes', to: { name: 'notes' }, permission: 'notes.view' },
    ],
  },
  {
    label: 'Settings',
    icon: 'Cog8ToothIcon',
    children: [
      { label: 'System', to: { name: 'settings-system' }, permission: 'settings.system' },
      { label: 'Warehouses', to: { name: 'settings-warehouses' }, permission: 'settings.warehouse' },
      { label: 'Categories', to: { name: 'settings-categories' }, permission: 'settings.category' },
      { label: 'Brands', to: { name: 'settings-brands' }, permission: 'settings.brand' },
      { label: 'Currency', to: { name: 'settings-currencies' }, permission: 'settings.currency' },
      { label: 'Units', to: { name: 'settings-units' }, permission: 'settings.unit' },
      { label: 'Group Permissions', to: { name: 'settings-permissions' }, permission: 'roles.manage' },
    ],
  },
  {
    label: 'Reports',
    icon: 'ChartPieIcon',
    children: [
      { label: 'Profit & Loss', to: { name: 'reports-profit-loss' }, permission: 'reports.profitLoss' },
      { label: 'Payments', to: { name: 'reports-payments' }, permission: 'reports.salesPayments' },
      { label: 'Product Alerts', to: { name: 'reports-product-alerts' }, permission: 'reports.alerts' },
      { label: 'Warehouse Report', to: { name: 'reports-warehouse' }, permission: 'reports.warehouse' },
      { label: 'Sales Report', to: { name: 'reports-sales' }, permission: 'reports.sales' },
      { label: 'Purchase Report', to: { name: 'reports-purchases' }, permission: 'reports.purchases' },
      { label: 'Customer Report', to: { name: 'reports-customers' }, permission: 'reports.customers' },
      { label: 'Supplier Report', to: { name: 'reports-suppliers' }, permission: 'reports.suppliers' },
    ],
  },
];
