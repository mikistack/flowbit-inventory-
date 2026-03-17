const express = require('express');
const authMiddleware = require('../middlewares/auth');
const hasPermission = require('../middlewares/permissions');
const buildCrudRoutes = require('./crud.routes');
const controllers = require('../controllers');
const authRoutes = require('./auth.routes');
const reportController = require('../controllers/report.controller');
const utilityController = require('../controllers/utility.controller');
const transactionController = require('../controllers/transaction.controller');
const telegramController = require('../controllers/telegram.controller');

const router = express.Router();

const buildPermissionSet = (baseKey, overrides = {}) => ({
  list: hasPermission(overrides.list || `${baseKey}.view`),
  get: hasPermission(overrides.get || `${baseKey}.view`),
  create: hasPermission(overrides.create || `${baseKey}.create`),
  update: hasPermission(overrides.update || `${baseKey}.edit`),
  delete: hasPermission(overrides.delete || `${baseKey}.delete`),
});

const singlePermissionSet = (permissionKey) => ({
  list: hasPermission(permissionKey),
  get: hasPermission(permissionKey),
  create: hasPermission(permissionKey),
  update: hasPermission(permissionKey),
  delete: hasPermission(permissionKey),
});

router.use('/auth', authRoutes);

router.use('/users', authMiddleware, hasPermission('users.manage'), buildCrudRoutes(controllers.users));
router.use('/roles', authMiddleware, hasPermission('roles.manage'), buildCrudRoutes(controllers.roles));
router.use('/permissions', authMiddleware, hasPermission('roles.manage'), buildCrudRoutes(controllers.permissions));
router.use(
  '/warehouses',
  authMiddleware,
  buildCrudRoutes(controllers.warehouses, { permissions: singlePermissionSet('settings.warehouse') }),
);
router.use(
  '/categories',
  authMiddleware,
  buildCrudRoutes(controllers.categories, { permissions: singlePermissionSet('settings.category') }),
);
router.use(
  '/brands',
  authMiddleware,
  buildCrudRoutes(controllers.brands, { permissions: singlePermissionSet('settings.brand') }),
);
router.use(
  '/units',
  authMiddleware,
  buildCrudRoutes(controllers.units, { permissions: singlePermissionSet('settings.unit') }),
);
router.use(
  '/currencies',
  authMiddleware,
  buildCrudRoutes(controllers.currencies, { permissions: singlePermissionSet('settings.currency') }),
);
router.get(
  '/products/lookup',
  authMiddleware,
  hasPermission('products.view'),
  controllers.products.lookup,
);
router.post(
  '/products/generate-code',
  authMiddleware,
  hasPermission('products.create'),
  controllers.products.generateCode,
);
router.post(
  '/products/import-excel',
  authMiddleware,
  hasPermission('products.create'),
  controllers.products.importExcel,
);
router.use(
  '/products',
  authMiddleware,
  buildCrudRoutes(controllers.products, { permissions: buildPermissionSet('products') }),
);
router.use(
  '/inventory',
  authMiddleware,
  buildCrudRoutes(controllers.inventory, {
    permissions: {
      list: hasPermission('products.view'),
      get: hasPermission('products.view'),
      create: hasPermission('products.edit'),
      update: hasPermission('products.edit'),
      delete: hasPermission('products.delete'),
    },
  }),
);
router.get('/adjustments', authMiddleware, hasPermission('adjustments.view'), transactionController.listAdjustments);
router.post('/adjustments', authMiddleware, hasPermission('adjustments.create'), transactionController.createAdjustment);
router.get('/transfers', authMiddleware, hasPermission('transfers.view'), transactionController.listTransfers);
router.post('/transfers', authMiddleware, hasPermission('transfers.create'), transactionController.createTransfer);
router.use(
  '/expenses',
  authMiddleware,
  buildCrudRoutes(controllers.expenses, { permissions: buildPermissionSet('expenses') }),
);
router.use(
  '/expense-categories',
  authMiddleware,
  buildCrudRoutes(controllers.expenseCategories, { permissions: buildPermissionSet('expenses') }),
);
router.use(
  '/quotations',
  authMiddleware,
  buildCrudRoutes(controllers.quotations, {
    permissions: {
      list: hasPermission(['quotations.view', 'sales.view']),
      get: hasPermission(['quotations.view', 'sales.view']),
      create: hasPermission(['quotations.create', 'sales.create']),
      update: hasPermission(['quotations.edit', 'sales.edit']),
      delete: hasPermission(['quotations.delete', 'sales.delete']),
    },
  }),
);
router.get('/purchases', authMiddleware, hasPermission('purchases.view'), transactionController.listPurchases);
router.post('/purchases', authMiddleware, hasPermission('purchases.create'), transactionController.createPurchase);
router.get('/sales', authMiddleware, hasPermission('sales.view'), transactionController.listSales);
router.post('/sales', authMiddleware, hasPermission('sales.create'), transactionController.createSale);
router.use(
  '/returns',
  authMiddleware,
  buildCrudRoutes(controllers.returns, {
    permissions: {
      list: hasPermission(['salesReturns.view', 'purchaseReturns.view'], { mode: 'all' }),
      get: hasPermission(['salesReturns.view', 'purchaseReturns.view'], { mode: 'all' }),
      create: hasPermission(['salesReturns.create', 'purchaseReturns.create'], { mode: 'all' }),
      update: hasPermission(['salesReturns.edit', 'purchaseReturns.edit'], { mode: 'all' }),
      delete: hasPermission(['salesReturns.delete', 'purchaseReturns.delete'], { mode: 'all' }),
    },
  }),
);
router.use(
  '/customers',
  authMiddleware,
  buildCrudRoutes(controllers.customers, { permissions: buildPermissionSet('customers') }),
);
router.use(
  '/suppliers',
  authMiddleware,
  buildCrudRoutes(controllers.suppliers, { permissions: buildPermissionSet('suppliers') }),
);
router.use(
  '/notes',
  authMiddleware,
  buildCrudRoutes(controllers.notes, { permissions: buildPermissionSet('notes') }),
);
router.get('/settings/notification', authMiddleware, controllers.notificationSettings.get);
router.put('/settings/notification', authMiddleware, controllers.notificationSettings.update);
router.use('/settings', authMiddleware, hasPermission('settings.manage'), buildCrudRoutes(controllers.settings));
router.get('/backups', authMiddleware, hasPermission('settings.backup'), controllers.backups.list);
router.post('/backups', authMiddleware, hasPermission('settings.backup'), controllers.backups.create);
router.get('/backups/:id', authMiddleware, hasPermission('settings.backup'), controllers.backups.get);
router.delete('/backups/:id', authMiddleware, hasPermission('settings.backup'), controllers.backups.remove);
router.get(
  '/backups/:id/download',
  authMiddleware,
  hasPermission('settings.backup'),
  controllers.backups.download,
);
router.use('/sessions', authMiddleware, hasPermission('users.records'), buildCrudRoutes(controllers.sessions));
router.use(
  '/payments',
  authMiddleware,
  buildCrudRoutes(controllers.payments, {
    permissions: {
      list: hasPermission(['payments.sales', 'payments.purchases', 'payments.returns'], { mode: 'all' }),
      get: hasPermission(['payments.sales', 'payments.purchases', 'payments.returns'], { mode: 'all' }),
      create: hasPermission(['payments.sales', 'payments.purchases', 'payments.returns'], { mode: 'all' }),
      update: hasPermission(['payments.sales', 'payments.purchases', 'payments.returns'], { mode: 'all' }),
      delete: hasPermission(['payments.sales', 'payments.purchases', 'payments.returns'], { mode: 'all' }),
    },
  }),
);
router.use(
  '/label-templates',
  authMiddleware,
  buildCrudRoutes(controllers.labelTemplates, { permissions: singlePermissionSet('products.barcode') }),
);

router.get('/notifications', authMiddleware, controllers.notifications.list);
router.post('/notifications/:id/read', authMiddleware, controllers.notifications.read);
router.get('/notifications/:id/file', authMiddleware, controllers.notifications.download);

router.get(
  '/reports/profit-loss',
  authMiddleware,
  hasPermission('reports.profitLoss'),
  reportController.profitAndLoss,
);
router.get(
  '/reports/dashboard-summary',
  authMiddleware,
  hasPermission('dashboard.view'),
  reportController.dashboardSummary,
);
router.get('/reports/payments', authMiddleware, hasPermission('reports.salesPayments'), reportController.paymentReport);
router.get('/reports/product-alerts', authMiddleware, hasPermission('reports.alerts'), reportController.productAlerts);
router.get('/reports/warehouse', authMiddleware, hasPermission('reports.warehouse'), reportController.warehouseReport);
router.get('/reports/sales', authMiddleware, hasPermission('reports.sales'), reportController.saleReport);
router.get('/reports/purchases', authMiddleware, hasPermission('reports.purchases'), reportController.purchaseReport);
router.get('/reports/customers', authMiddleware, hasPermission('reports.customers'), reportController.customerReport);
router.get('/reports/suppliers', authMiddleware, hasPermission('reports.suppliers'), reportController.supplierReport);
router.get('/reports/ops-summary', authMiddleware, hasPermission('reports.opsSummary'), reportController.opsSummary);
router.post(
  '/reports/ops-summary/notify',
  authMiddleware,
  hasPermission('reports.opsSummary'),
  reportController.notifyOpsSummary,
);

router.post('/products/import', authMiddleware, hasPermission('products.manage'), utilityController.importProducts);
router.get('/exports/:type', authMiddleware, hasPermission('reports.profitLoss'), utilityController.exportData);
router.post(
  '/sessions/terminate-all',
  authMiddleware,
  hasPermission('users.manage'),
  utilityController.terminateSessions,
);
router.post(
  '/label-templates/print',
  authMiddleware,
  hasPermission('products.barcode'),
  utilityController.printLabels,
);

router.post('/integrations/telegram/webhook', telegramController.webhook);
router.post(
  '/integrations/telegram/test',
  authMiddleware,
  hasPermission('settings.manage'),
  telegramController.test,
);

module.exports = router;
