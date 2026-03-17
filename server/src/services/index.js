const BaseService = require('./base.service');
const UsersService = require('./users.service');
const ProductsService = require('./products.service');
const { models } = require('../models');

const services = {
  users: new UsersService(),
  roles: new BaseService(models.Role, { searchable: ['name'], include: [{ model: models.Permission, as: 'permissions' }] }),
  permissions: new BaseService(models.Permission, { searchable: ['key', 'module'] }),
  warehouses: new BaseService(models.Warehouse, { searchable: ['name', 'city', 'country'] }),
  categories: new BaseService(models.Category, { searchable: ['name', 'code'] }),
  brands: new BaseService(models.Brand, { searchable: ['name'] }),
  units: new BaseService(models.Unit, { searchable: ['name', 'shortName'] }),
  currencies: new BaseService(models.Currency, { searchable: ['code', 'name'] }),
  products: new ProductsService(),
  inventory: new BaseService(models.InventoryRecord, {
    include: [{ model: models.Product }, { model: models.Warehouse }],
  }),
  adjustments: new BaseService(models.Adjustment, {
    searchable: ['reference'],
    include: [{ model: models.Warehouse }, { model: models.User, as: 'createdBy' }, { model: models.AdjustmentItem, as: 'items' }],
  }),
  transfers: new BaseService(models.Transfer, {
    searchable: ['reference'],
    include: [
      { model: models.Warehouse, as: 'fromWarehouse' },
      { model: models.Warehouse, as: 'toWarehouse' },
      { model: models.User, as: 'createdBy' },
      { model: models.TransferItem, as: 'items' },
    ],
  }),
  expenses: new BaseService(models.Expense, {
    searchable: ['reference', 'details'],
    include: [{ model: models.ExpenseCategory, as: 'category' }, { model: models.Warehouse }],
  }),
  expenseCategories: new BaseService(models.ExpenseCategory, { searchable: ['name'] }),
  quotations: new BaseService(models.Quotation, {
    searchable: ['reference'],
    include: [{ model: models.Customer }, { model: models.Warehouse }, { model: models.QuotationItem, as: 'items' }],
  }),
  purchases: new BaseService(models.Purchase, {
    searchable: ['reference'],
    include: [{ model: models.Supplier }, { model: models.Warehouse }, { model: models.PurchaseItem, as: 'items' }],
  }),
  sales: new BaseService(models.Sale, {
    searchable: ['reference'],
    include: [{ model: models.Customer }, { model: models.Warehouse }, { model: models.SaleItem, as: 'items' }],
  }),
  returns: new BaseService(models.Return, {
    searchable: ['reference'],
    include: [
      { model: models.Customer, as: 'customer' },
      { model: models.Supplier, as: 'supplier' },
      { model: models.Warehouse },
      { model: models.Sale, as: 'sourceSale' },
      { model: models.Purchase, as: 'sourcePurchase' },
      { model: models.ReturnItem, as: 'items', include: [{ model: models.Product }] },
    ],
  }),
  customers: new BaseService(models.Customer, { searchable: ['name', 'code', 'phone'] }),
  suppliers: new BaseService(models.Supplier, { searchable: ['name', 'code', 'phone'] }),
  notes: new BaseService(models.Note, {
    searchable: ['title'],
    include: [{ model: models.User, as: 'author' }],
  }),
  settings: new BaseService(models.Setting, { searchable: ['key'], order: [['key', 'ASC']] }),
  backups: new BaseService(models.Backup, {
    searchable: ['filename'],
    include: [{ model: models.User, as: 'initiatedBy' }],
  }),
  sessions: new BaseService(models.UserSession, {
    searchable: ['ip', 'device'],
    include: [{ model: models.User }],
  }),
  payments: new BaseService(models.Payment, { searchable: ['reference', 'paidBy'] }),
  labelTemplates: new BaseService(models.LabelTemplate, { searchable: ['name', 'size'] }),
};

module.exports = services;
