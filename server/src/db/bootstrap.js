const bcrypt = require('bcrypt');
const { models } = require('../models');
const env = require('../config/env');

const seedSampleData = Boolean(env.seedSampleData);

const permissionSeeds = [
  { key: 'users.view', module: 'Users Management', label: 'View users' },
  { key: 'users.create', module: 'Users Management', label: 'Create users' },
  { key: 'users.edit', module: 'Users Management', label: 'Edit users' },
  { key: 'users.delete', module: 'Users Management', label: 'Delete users' },
  { key: 'users.records', module: 'Users Management', label: 'View all user records' },

  { key: 'users.manage', module: 'Users Management', label: 'Manage users' },
  { key: 'roles.view', module: 'Users Permissions', label: 'View roles' },
  { key: 'roles.create', module: 'Users Permissions', label: 'Create roles' },
  { key: 'roles.edit', module: 'Users Permissions', label: 'Edit roles' },
  { key: 'roles.delete', module: 'Users Permissions', label: 'Delete roles' },
  { key: 'roles.manage', module: 'Users Permissions', label: 'Manage roles & permissions' },

  { key: 'products.view', module: 'Products', label: 'View products' },
  { key: 'products.create', module: 'Products', label: 'Create products' },
  { key: 'products.edit', module: 'Products', label: 'Edit products' },
  { key: 'products.delete', module: 'Products', label: 'Delete products' },
  { key: 'products.barcode', module: 'Products', label: 'Generate barcodes' },
  { key: 'products.import', module: 'Products', label: 'Import products' },

  { key: 'adjustments.view', module: 'Adjustment', label: 'View adjustments' },
  { key: 'adjustments.create', module: 'Adjustment', label: 'Create adjustments' },
  { key: 'adjustments.edit', module: 'Adjustment', label: 'Edit adjustments' },
  { key: 'adjustments.delete', module: 'Adjustment', label: 'Delete adjustments' },

  { key: 'transfers.view', module: 'Transfer', label: 'View transfers' },
  { key: 'transfers.create', module: 'Transfer', label: 'Create transfers' },
  { key: 'transfers.edit', module: 'Transfer', label: 'Edit transfers' },
  { key: 'transfers.delete', module: 'Transfer', label: 'Delete transfers' },

  { key: 'expenses.view', module: 'Expenses', label: 'View expenses' },
  { key: 'expenses.create', module: 'Expenses', label: 'Create expenses' },
  { key: 'expenses.edit', module: 'Expenses', label: 'Edit expenses' },
  { key: 'expenses.delete', module: 'Expenses', label: 'Delete expenses' },

  { key: 'sales.view', module: 'Sales', label: 'View sales' },
  { key: 'sales.create', module: 'Sales', label: 'Create sales' },
  { key: 'sales.edit', module: 'Sales', label: 'Edit sales' },
  { key: 'sales.delete', module: 'Sales', label: 'Delete sales' },
  { key: 'sales.pos', module: 'Sales', label: 'Use Point of Sale' },

  { key: 'purchases.view', module: 'Purchases', label: 'View purchases' },
  { key: 'purchases.create', module: 'Purchases', label: 'Create purchases' },
  { key: 'purchases.edit', module: 'Purchases', label: 'Edit purchases' },
  { key: 'purchases.delete', module: 'Purchases', label: 'Delete purchases' },

  { key: 'salesReturns.view', module: 'Sales Return', label: 'View sales returns' },
  { key: 'salesReturns.create', module: 'Sales Return', label: 'Create sales returns' },
  { key: 'salesReturns.edit', module: 'Sales Return', label: 'Edit sales returns' },
  { key: 'salesReturns.delete', module: 'Sales Return', label: 'Delete sales returns' },

  { key: 'purchaseReturns.view', module: 'Purchases Return', label: 'View purchase returns' },
  { key: 'purchaseReturns.create', module: 'Purchases Return', label: 'Create purchase returns' },
  { key: 'purchaseReturns.edit', module: 'Purchases Return', label: 'Edit purchase returns' },
  { key: 'purchaseReturns.delete', module: 'Purchases Return', label: 'Delete purchase returns' },

  { key: 'payments.sales', module: 'Payments Sales', label: 'Manage sales payments' },
  { key: 'payments.purchases', module: 'Payments Purchases', label: 'Manage purchase payments' },
  { key: 'payments.returns', module: 'Payments Returns', label: 'Manage return payments' },

  { key: 'customers.view', module: 'Customer List', label: 'View customers' },
  { key: 'customers.create', module: 'Customer List', label: 'Create customers' },
  { key: 'customers.edit', module: 'Customer List', label: 'Edit customers' },
  { key: 'customers.delete', module: 'Customer List', label: 'Delete customers' },
  { key: 'customers.import', module: 'Customer List', label: 'Import customers' },

  { key: 'suppliers.view', module: 'Supplier List', label: 'View suppliers' },
  { key: 'suppliers.create', module: 'Supplier List', label: 'Create suppliers' },
  { key: 'suppliers.edit', module: 'Supplier List', label: 'Edit suppliers' },
  { key: 'suppliers.delete', module: 'Supplier List', label: 'Delete suppliers' },
  { key: 'suppliers.import', module: 'Supplier List', label: 'Import suppliers' },

  { key: 'reports.salesPayments', module: 'Reports', label: 'Sales payment reports' },
  { key: 'reports.purchasePayments', module: 'Reports', label: 'Purchase payment reports' },
  { key: 'reports.saleReturnPayments', module: 'Reports', label: 'Sale return payment reports' },
  { key: 'reports.purchaseReturnPayments', module: 'Reports', label: 'Purchase return payment reports' },
  { key: 'reports.sales', module: 'Reports', label: 'Sales report' },
  { key: 'reports.purchases', module: 'Reports', label: 'Purchase report' },
  { key: 'reports.customers', module: 'Reports', label: 'Customer report' },
  { key: 'reports.suppliers', module: 'Reports', label: 'Supplier report' },
  { key: 'reports.profitLoss', module: 'Reports', label: 'Profit and loss' },
  { key: 'reports.alerts', module: 'Reports', label: 'Product quantity alerts' },
  { key: 'reports.warehouse', module: 'Reports', label: 'Warehouse stock chart' },
  { key: 'reports.opsSummary', module: 'Reports', label: 'Operations summary' },

  { key: 'settings.manage', module: 'Settings', label: 'Manage system settings' },
  { key: 'settings.system', module: 'Settings', label: 'System settings' },
  { key: 'settings.category', module: 'Settings', label: 'Manage categories' },
  { key: 'settings.brand', module: 'Settings', label: 'Manage brands' },
  { key: 'settings.currency', module: 'Settings', label: 'Manage currencies' },
  { key: 'settings.warehouse', module: 'Settings', label: 'Manage warehouses' },
  { key: 'settings.unit', module: 'Settings', label: 'Manage units' },
  { key: 'settings.backup', module: 'Settings', label: 'Manage backups' },

  { key: 'notes.view', module: 'Notes', label: 'View notes' },
  { key: 'notes.create', module: 'Notes', label: 'Create notes' },
  { key: 'notes.edit', module: 'Notes', label: 'Edit notes' },
  { key: 'notes.delete', module: 'Notes', label: 'Delete notes' },

  { key: 'dashboard.view', module: 'Dashboard', label: 'View dashboard' },
  { key: 'dashboard.profit', module: 'Dashboard', label: 'View profit insights' },
  { key: 'dashboard.expense', module: 'Dashboard', label: 'View expense insights' },
];

const ensurePermissions = async () => {
  const permissions = [];
  for (const seed of permissionSeeds) {
    const [permission] = await models.Permission.findOrCreate({
      where: { key: seed.key },
      defaults: seed,
    });
    permissions.push(permission);
  }
  return permissions;
};

module.exports = async () => {
  const permissions = await ensurePermissions();
  const defaultAdminPassword = env.admin?.defaultPassword || 'Admin@123';
  const forceAdminPasswordReset = env.admin?.forcePasswordReset !== false;

  const [superRole] = await models.Role.findOrCreate({
    where: { name: 'Super Admin' },
    defaults: { description: 'Full control role' },
  });

  const [adminRole] = await models.Role.findOrCreate({
    where: { name: 'Admin' },
    defaults: { description: 'Administrative role' },
  });

  const [workerRole] = await models.Role.findOrCreate({
    where: { name: 'Worker' },
    defaults: { description: 'Operational role' },
  });

  const uniquePermissions = [
    ...new Map(permissions.map((permission) => [permission.id, permission])).values(),
  ];
  await superRole.setPermissions(uniquePermissions);
  await adminRole.setPermissions(uniquePermissions);
  const filtered = uniquePermissions.filter((permission) => permission.key !== 'reports.profitLoss');
  await workerRole.setPermissions(filtered);

  let admin = await models.User.findOne({ where: { username: 'admin' }, paranoid: false });
  if (!admin) {
    const hash = await bcrypt.hash(defaultAdminPassword, 10);
    admin = await models.User.create({
      firstName: 'Super',
      lastName: 'Admin',
      username: 'admin',
      email: 'admin@example.com',
      password: hash,
      roleId: superRole.id,
      status: 'active',
    });
  } else {
    if (admin.deletedAt) {
      await admin.restore();
    }
    const updates = { roleId: superRole.id, status: 'active' };
    if (forceAdminPasswordReset || !admin.password) {
      updates.password = await bcrypt.hash(defaultAdminPassword, 10);
    }
    await admin.update(updates);
  }

  if (!seedSampleData) {
    return;
  }

  const [defaultWarehouse] = await models.Warehouse.findOrCreate({
    where: { code: 'WH-001' },
    defaults: {
      name: 'Headquarters Store',
      code: 'WH-001',
      country: 'Ethiopia',
      city: 'Addis Ababa',
      phone: '+251-000-000',
      type: 'store',
    },
  });

  const [secondaryWarehouse] = await models.Warehouse.findOrCreate({
    where: { code: 'WH-002' },
    defaults: {
      name: 'Central Warehouse',
      code: 'WH-002',
      country: 'Ethiopia',
      city: 'Dire Dawa',
      phone: '+251-333-333',
      type: 'storage',
    },
  });

  const [defaultCategory] = await models.Category.findOrCreate({
    where: { code: 'CAT-GEN' },
    defaults: { code: 'CAT-GEN', name: 'General' },
  });

  const [defaultBrand] = await models.Brand.findOrCreate({
    where: { name: 'Generic' },
    defaults: { name: 'Generic', description: 'Default brand' },
  });

  const [defaultCurrency] = await models.Currency.findOrCreate({
    where: { code: 'ETB' },
    defaults: { code: 'ETB', name: 'Ethiopian Birr', symbol: 'ETB' },
  });

  const [defaultUnit] = await models.Unit.findOrCreate({
    where: { name: 'Piece' },
    defaults: { name: 'Piece', shortName: 'pc', operator: '*', operationValue: 1 },
  });

  const [defaultCustomer] = await models.Customer.findOrCreate({
    where: { code: 'CUST-0001' },
    defaults: {
      code: 'CUST-0001',
      name: 'Default Customer',
      email: 'customer@example.com',
      phone: '+251-111-111',
      country: 'Ethiopia',
      city: 'Addis Ababa',
    },
  });

  const [defaultSupplier] = await models.Supplier.findOrCreate({
    where: { code: 'SUP-0001' },
    defaults: {
      code: 'SUP-0001',
      name: 'Default Supplier',
      email: 'supplier@example.com',
      phone: '+251-222-222',
      country: 'Ethiopia',
      city: 'Addis Ababa',
    },
  });

  await models.LabelTemplate.findOrCreate({
    where: { name: 'Default Label' },
    defaults: {
      name: 'Default Label',
      size: 'A7',
      fields: { showPrice: true, showSku: true },
    },
  });

  const [sampleProduct] = await models.Product.findOrCreate({
    where: { code: 'SKU-0001' },
    defaults: {
      code: 'SKU-0001',
      name: 'Sample Product',
      price: 250,
      cost: 150,
      stockAlert: 5,
      categoryId: defaultCategory.id,
      brandId: defaultBrand.id,
      unitId: defaultUnit.id,
      currencyId: defaultCurrency.id,
      barcodeSymbology: 'code128',
      taxType: 'exclusive',
    },
  });

  await models.InventoryRecord.findOrCreate({
    where: { productId: sampleProduct.id, warehouseId: defaultWarehouse.id },
    defaults: {
      productId: sampleProduct.id,
      warehouseId: defaultWarehouse.id,
      quantityOnHand: 10,
      reorderPoint: 3,
    },
  });

  await models.InventoryRecord.findOrCreate({
    where: { productId: sampleProduct.id, warehouseId: secondaryWarehouse.id },
    defaults: {
      productId: sampleProduct.id,
      warehouseId: secondaryWarehouse.id,
      quantityOnHand: 5,
      reorderPoint: 2,
    },
  });

  await models.User.update(
    { warehouseId: defaultWarehouse.id },
    { where: { username: 'admin', warehouseId: null } },
  );
};
