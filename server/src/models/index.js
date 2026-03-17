const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Role = sequelize.define('Role', {
  name: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
});

const Permission = sequelize.define('Permission', {
  key: { type: DataTypes.STRING, unique: true },
  label: DataTypes.STRING,
  module: DataTypes.STRING,
});

const RolePermission = sequelize.define('RolePermission', {});

const User = sequelize.define('User', {
  firstName: DataTypes.STRING,
  lastName: DataTypes.STRING,
  username: { type: DataTypes.STRING, unique: true },
  email: { type: DataTypes.STRING, unique: true },
  phone: DataTypes.STRING,
  password: DataTypes.STRING,
  avatarUrl: DataTypes.STRING,
  status: { type: DataTypes.ENUM('active', 'invited', 'disabled'), defaultValue: 'active' },
  mfaSecret: DataTypes.STRING,
  telegramChatId: DataTypes.STRING,
  telegramUsername: DataTypes.STRING,
  telegramOtpEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  telegramLinkCode: DataTypes.STRING,
  warehouseId: DataTypes.INTEGER,
});

const Warehouse = sequelize.define('Warehouse', {
  name: DataTypes.STRING,
  code: DataTypes.STRING,
  phone: DataTypes.STRING,
  email: DataTypes.STRING,
  country: DataTypes.STRING,
  city: DataTypes.STRING,
  address: DataTypes.STRING,
  zipCode: DataTypes.STRING,
  type: {
    type: DataTypes.STRING,
    defaultValue: 'store',
  },
});

const Category = sequelize.define('Category', {
  code: DataTypes.STRING,
  name: DataTypes.STRING,
});

const Brand = sequelize.define('Brand', {
  name: DataTypes.STRING,
  description: DataTypes.TEXT,
  imageUrl: DataTypes.STRING,
});

const Unit = sequelize.define('Unit', {
  name: DataTypes.STRING,
  shortName: DataTypes.STRING,
  operator: DataTypes.ENUM('*', '/'),
  operationValue: DataTypes.FLOAT,
});

const Currency = sequelize.define('Currency', {
  code: DataTypes.STRING,
  name: DataTypes.STRING,
  symbol: DataTypes.STRING,
});

const Product = sequelize.define('Product', {
  code: { type: DataTypes.STRING, unique: true },
  name: DataTypes.STRING,
  barcodeSymbology: DataTypes.STRING,
  barcodeFormat: { type: DataTypes.ENUM('code128', 'qr'), defaultValue: 'qr' },
  barcodeImageUrl: DataTypes.STRING,
  cost: DataTypes.DECIMAL,
  price: DataTypes.DECIMAL,
  productUnit: DataTypes.STRING,
  saleUnit: DataTypes.STRING,
  purchaseUnit: DataTypes.STRING,
  stockAlert: DataTypes.INTEGER,
  initialQuantity: DataTypes.INTEGER,
  orderTax: DataTypes.FLOAT,
  taxType: DataTypes.ENUM('inclusive', 'exclusive'),
  hasVariants: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: { type: DataTypes.ENUM('active', 'archived'), defaultValue: 'active' },
  note: DataTypes.TEXT,
  categoryId: DataTypes.INTEGER,
  brandId: DataTypes.INTEGER,
  unitId: DataTypes.INTEGER,
  currencyId: DataTypes.INTEGER,
});

const ProductImage = sequelize.define('ProductImage', {
  url: DataTypes.STRING,
  productId: DataTypes.INTEGER,
});

const ProductVariant = sequelize.define('ProductVariant', {
  name: DataTypes.STRING,
  sku: DataTypes.STRING,
  price: DataTypes.DECIMAL,
  productId: DataTypes.INTEGER,
});

const InventoryRecord = sequelize.define('InventoryRecord', {
  quantityOnHand: { type: DataTypes.INTEGER, defaultValue: 0 },
  reorderPoint: DataTypes.INTEGER,
  productId: DataTypes.INTEGER,
  warehouseId: DataTypes.INTEGER,
});

const Adjustment = sequelize.define('Adjustment', {
  reference: DataTypes.STRING,
  notes: DataTypes.TEXT,
  date: DataTypes.DATE,
  warehouseId: DataTypes.INTEGER,
  createdById: DataTypes.INTEGER,
});

const AdjustmentItem = sequelize.define('AdjustmentItem', {
  quantity: DataTypes.INTEGER,
  type: DataTypes.ENUM('addition', 'subtraction'),
  adjustmentId: DataTypes.INTEGER,
  productId: DataTypes.INTEGER,
});

const Transfer = sequelize.define('Transfer', {
  reference: DataTypes.STRING,
  status: { type: DataTypes.ENUM('pending', 'completed'), defaultValue: 'pending' },
  orderTax: DataTypes.FLOAT,
  discount: DataTypes.FLOAT,
  shipping: DataTypes.FLOAT,
  note: DataTypes.TEXT,
  date: DataTypes.DATE,
});

const TransferItem = sequelize.define('TransferItem', {
  netUnitCost: DataTypes.DECIMAL,
  quantity: DataTypes.INTEGER,
  discount: DataTypes.FLOAT,
  tax: DataTypes.FLOAT,
  subtotal: DataTypes.DECIMAL,
  transferId: DataTypes.INTEGER,
  productId: DataTypes.INTEGER,
});

const ExpenseCategory = sequelize.define('ExpenseCategory', {
  name: DataTypes.STRING,
  description: DataTypes.TEXT,
});

const Expense = sequelize.define('Expense', {
  reference: DataTypes.STRING,
  amount: DataTypes.DECIMAL,
  details: DataTypes.TEXT,
  date: DataTypes.DATE,
  warehouseId: DataTypes.INTEGER,
  categoryId: DataTypes.INTEGER,
});

const Customer = sequelize.define('Customer', {
  code: DataTypes.STRING,
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  phone: DataTypes.STRING,
  country: DataTypes.STRING,
  city: DataTypes.STRING,
  address: DataTypes.STRING,
});

const Supplier = sequelize.define('Supplier', {
  code: DataTypes.STRING,
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  phone: DataTypes.STRING,
  country: DataTypes.STRING,
  city: DataTypes.STRING,
  address: DataTypes.STRING,
});

const Quotation = sequelize.define('Quotation', {
  reference: DataTypes.STRING,
  status: DataTypes.ENUM('pending', 'sent', 'accepted'),
  orderTax: DataTypes.FLOAT,
  discount: DataTypes.FLOAT,
  shipping: DataTypes.FLOAT,
  note: DataTypes.TEXT,
  date: DataTypes.DATE,
  customerId: DataTypes.INTEGER,
  warehouseId: DataTypes.INTEGER,
});

const QuotationItem = sequelize.define('QuotationItem', {
  netUnitPrice: DataTypes.DECIMAL,
  quantity: DataTypes.INTEGER,
  discount: DataTypes.FLOAT,
  tax: DataTypes.FLOAT,
  subtotal: DataTypes.DECIMAL,
  quotationId: DataTypes.INTEGER,
  productId: DataTypes.INTEGER,
});

const Purchase = sequelize.define('Purchase', {
  reference: DataTypes.STRING,
  status: DataTypes.ENUM('pending', 'ordered', 'received'),
  orderTax: DataTypes.FLOAT,
  discount: DataTypes.FLOAT,
  shipping: DataTypes.FLOAT,
  paid: DataTypes.DECIMAL,
  due: DataTypes.DECIMAL,
  paymentStatus: DataTypes.ENUM('paid', 'partial', 'pending'),
  note: DataTypes.TEXT,
  date: DataTypes.DATE,
  supplierId: DataTypes.INTEGER,
  warehouseId: DataTypes.INTEGER,
});

const PurchaseItem = sequelize.define('PurchaseItem', {
  netUnitCost: DataTypes.DECIMAL,
  adjustedPrice: DataTypes.DECIMAL,
  quantity: DataTypes.INTEGER,
  discount: DataTypes.FLOAT,
  tax: DataTypes.FLOAT,
  subtotal: DataTypes.DECIMAL,
  purchaseId: DataTypes.INTEGER,
  productId: DataTypes.INTEGER,
});

const Sale = sequelize.define('Sale', {
  reference: DataTypes.STRING,
  status: DataTypes.ENUM('pending', 'completed'),
  orderTax: DataTypes.FLOAT,
  discount: DataTypes.FLOAT,
  shipping: DataTypes.FLOAT,
  paid: DataTypes.DECIMAL,
  due: DataTypes.DECIMAL,
  paymentStatus: DataTypes.ENUM('paid', 'partial', 'pending'),
  note: DataTypes.TEXT,
  date: DataTypes.DATE,
  customerId: DataTypes.INTEGER,
  warehouseId: DataTypes.INTEGER,
});

const SaleItem = sequelize.define('SaleItem', {
  netUnitPrice: DataTypes.DECIMAL,
  adjustedPrice: DataTypes.DECIMAL,
  quantity: DataTypes.INTEGER,
  discount: DataTypes.FLOAT,
  tax: DataTypes.FLOAT,
  subtotal: DataTypes.DECIMAL,
  saleId: DataTypes.INTEGER,
  productId: DataTypes.INTEGER,
});

const Return = sequelize.define('Return', {
  reference: DataTypes.STRING,
  type: DataTypes.ENUM('sale', 'purchase'),
  status: DataTypes.ENUM('pending', 'completed'),
  saleId: DataTypes.INTEGER,
  purchaseId: DataTypes.INTEGER,
  sourceReference: DataTypes.STRING,
  sourceTotal: DataTypes.DECIMAL,
  orderTax: DataTypes.FLOAT,
  discount: DataTypes.FLOAT,
  shipping: DataTypes.FLOAT,
  total: DataTypes.DECIMAL,
  note: DataTypes.TEXT,
  date: DataTypes.DATE,
  customerId: DataTypes.INTEGER,
  supplierId: DataTypes.INTEGER,
  warehouseId: DataTypes.INTEGER,
});

const ReturnItem = sequelize.define('ReturnItem', {
  netUnitPrice: DataTypes.DECIMAL,
  quantity: DataTypes.INTEGER,
  discount: DataTypes.FLOAT,
  tax: DataTypes.FLOAT,
  subtotal: DataTypes.DECIMAL,
  returnId: DataTypes.INTEGER,
  productId: DataTypes.INTEGER,
});

const Payment = sequelize.define('Payment', {
  reference: DataTypes.STRING,
  paidBy: DataTypes.STRING,
  amount: DataTypes.DECIMAL,
  date: DataTypes.DATE,
  type: DataTypes.ENUM('sale', 'sale_return', 'purchase', 'purchase_return'),
  saleId: DataTypes.INTEGER,
  purchaseId: DataTypes.INTEGER,
  returnId: DataTypes.INTEGER,
});

const Note = sequelize.define('Note', {
  title: DataTypes.STRING,
  content: DataTypes.TEXT,
  pinned: { type: DataTypes.BOOLEAN, defaultValue: false },
  background: DataTypes.STRING,
  authorId: DataTypes.INTEGER,
});

const Setting = sequelize.define('Setting', {
  key: { type: DataTypes.STRING, unique: true },
  value: DataTypes.JSONB,
});

const Backup = sequelize.define('Backup', {
  filename: DataTypes.STRING,
  size: DataTypes.INTEGER,
  status: DataTypes.ENUM('pending', 'completed', 'failed'),
  initiatedById: DataTypes.INTEGER,
});

const AuthLog = sequelize.define('AuthLog', {
  type: DataTypes.ENUM('login_success', 'login_failure', 'logout', 'password_reset', 'mfa_setup'),
  ip: DataTypes.STRING,
  userAgent: DataTypes.STRING,
  status: DataTypes.STRING,
  message: DataTypes.TEXT,
});

const LabelTemplate = sequelize.define('LabelTemplate', {
  name: DataTypes.STRING,
  size: DataTypes.STRING,
  fields: DataTypes.JSONB,
});

const UserSession = sequelize.define('UserSession', {
  ip: DataTypes.STRING,
  device: DataTypes.STRING,
  lastActivity: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  revokedAt: DataTypes.DATE,
  refreshTokenHash: { type: DataTypes.STRING, field: 'refresh_token_hash' },
  userId: { type: DataTypes.INTEGER, field: 'user_id' },
});

const PasswordReset = sequelize.define('PasswordReset', {
  token: { type: DataTypes.STRING, unique: true },
  expiresAt: DataTypes.DATE,
  usedAt: DataTypes.DATE,
  userId: DataTypes.INTEGER,
});

const NotificationSetting = sequelize.define('NotificationSetting', {
  lowStockThreshold: { type: DataTypes.INTEGER, defaultValue: 5 },
  highSalesThreshold: { type: DataTypes.DECIMAL, defaultValue: 10000 },
  highPurchaseThreshold: { type: DataTypes.DECIMAL, defaultValue: 10000 },
  highAdditionThreshold: { type: DataTypes.INTEGER, defaultValue: 100 },
  csvSchedule: {
    type: DataTypes.JSONB,
    defaultValue: { daily: true, weekly: false, monthly: false, hour: 8 },
  },
  opsReportSchedule: {
    type: DataTypes.JSONB,
    defaultValue: { daily: true, weekly: true, monthly: true, hour: 8 },
  },
  channels: {
    type: DataTypes.JSONB,
    defaultValue: { inApp: true, telegram: { enabled: false, botToken: '', chatId: '' } },
  },
});

const Notification = sequelize.define('Notification', {
  type: DataTypes.STRING,
  title: DataTypes.STRING,
  message: DataTypes.TEXT,
  severity: { type: DataTypes.ENUM('info', 'warning', 'critical'), defaultValue: 'info' },
  readAt: DataTypes.DATE,
  meta: DataTypes.JSONB,
});

const OneTimeCode = sequelize.define('OneTimeCode', {
  purpose: { type: DataTypes.STRING, allowNull: false },
  codeHash: DataTypes.STRING,
  expiresAt: DataTypes.DATE,
  consumedAt: DataTypes.DATE,
  userId: { type: DataTypes.INTEGER, field: 'user_id' },
});

// Associations
Role.hasMany(User, { foreignKey: 'roleId' });
User.belongsTo(Role, { as: 'role', foreignKey: 'roleId' });

Role.belongsToMany(Permission, { through: RolePermission, as: 'permissions' });
Permission.belongsToMany(Role, { through: RolePermission });

Product.belongsTo(Category, { foreignKey: 'categoryId' });
Category.hasMany(Product, { foreignKey: 'categoryId' });

Product.belongsTo(Brand, { foreignKey: 'brandId' });
Brand.hasMany(Product, { foreignKey: 'brandId' });

Product.belongsTo(Unit, { as: 'unit', foreignKey: 'unitId' });
Product.hasMany(ProductImage, { as: 'images', foreignKey: 'productId' });
ProductImage.belongsTo(Product, { foreignKey: 'productId' });

Product.hasMany(ProductVariant, { as: 'variants', foreignKey: 'productId' });
ProductVariant.belongsTo(Product, { foreignKey: 'productId' });

Product.belongsTo(Currency, { as: 'currency', foreignKey: 'currencyId' });

InventoryRecord.belongsTo(Product, { foreignKey: 'productId' });
InventoryRecord.belongsTo(Warehouse, { foreignKey: 'warehouseId' });
Product.hasMany(InventoryRecord, { as: 'inventory', foreignKey: 'productId' });
Warehouse.hasMany(InventoryRecord, { as: 'inventory', foreignKey: 'warehouseId' });

Adjustment.belongsTo(Warehouse, { foreignKey: 'warehouseId' });
Adjustment.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });
Adjustment.hasMany(AdjustmentItem, { as: 'items', foreignKey: 'adjustmentId' });
AdjustmentItem.belongsTo(Adjustment, { foreignKey: 'adjustmentId' });
AdjustmentItem.belongsTo(Product, { foreignKey: 'productId' });

Transfer.belongsTo(Warehouse, { as: 'fromWarehouse', foreignKey: 'fromWarehouseId' });
Transfer.belongsTo(Warehouse, { as: 'toWarehouse', foreignKey: 'toWarehouseId' });
Transfer.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });
Transfer.hasMany(TransferItem, { as: 'items', foreignKey: 'transferId' });
TransferItem.belongsTo(Transfer, { foreignKey: 'transferId' });
TransferItem.belongsTo(Product, { foreignKey: 'productId' });

Expense.belongsTo(ExpenseCategory, { as: 'category', foreignKey: 'categoryId' });
Expense.belongsTo(Warehouse, { foreignKey: 'warehouseId' });

Quotation.belongsTo(Customer, { foreignKey: 'customerId' });
Quotation.belongsTo(Warehouse, { foreignKey: 'warehouseId' });
Quotation.hasMany(QuotationItem, { as: 'items', foreignKey: 'quotationId' });
QuotationItem.belongsTo(Quotation, { foreignKey: 'quotationId' });
QuotationItem.belongsTo(Product, { foreignKey: 'productId' });

Purchase.belongsTo(Supplier, { foreignKey: 'supplierId' });
Purchase.belongsTo(Warehouse, { foreignKey: 'warehouseId' });
Purchase.hasMany(PurchaseItem, { as: 'items', foreignKey: 'purchaseId' });
PurchaseItem.belongsTo(Purchase, { foreignKey: 'purchaseId' });
PurchaseItem.belongsTo(Product, { foreignKey: 'productId' });

Sale.belongsTo(Customer, { foreignKey: 'customerId' });
Sale.belongsTo(Warehouse, { foreignKey: 'warehouseId' });
Sale.hasMany(SaleItem, { as: 'items', foreignKey: 'saleId' });
SaleItem.belongsTo(Sale, { foreignKey: 'saleId' });
SaleItem.belongsTo(Product, { foreignKey: 'productId' });

Return.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId' });
Return.belongsTo(Supplier, { as: 'supplier', foreignKey: 'supplierId' });
Return.belongsTo(Warehouse, { foreignKey: 'warehouseId' });
Return.belongsTo(Sale, { as: 'sourceSale', foreignKey: 'saleId' });
Return.belongsTo(Purchase, { as: 'sourcePurchase', foreignKey: 'purchaseId' });
Return.hasMany(ReturnItem, { as: 'items', foreignKey: 'returnId' });
ReturnItem.belongsTo(Return, { foreignKey: 'returnId' });
ReturnItem.belongsTo(Product, { foreignKey: 'productId' });

Payment.belongsTo(Sale, { foreignKey: 'saleId' });
Payment.belongsTo(Purchase, { foreignKey: 'purchaseId' });
Payment.belongsTo(Return, { foreignKey: 'returnId' });

Note.belongsTo(User, { as: 'author', foreignKey: 'authorId' });

Backup.belongsTo(User, { as: 'initiatedBy', foreignKey: 'initiatedById' });

UserSession.belongsTo(User);
User.hasMany(UserSession, { as: 'sessions' });

PasswordReset.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(PasswordReset, { as: 'passwordResets', foreignKey: 'userId' });

AuthLog.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(AuthLog, { as: 'authLogs', foreignKey: 'userId' });

Notification.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Notification, { as: 'notifications', foreignKey: 'userId' });
User.belongsTo(Warehouse, { as: 'warehouse', foreignKey: 'warehouseId' });
Warehouse.hasMany(User, { as: 'members', foreignKey: 'warehouseId' });
OneTimeCode.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(OneTimeCode, { as: 'otpCodes', foreignKey: 'userId' });

module.exports = {
  sequelize,
  models: {
    Role,
    Permission,
    RolePermission,
    User,
    Warehouse,
    Category,
    Brand,
    Unit,
    Currency,
    Product,
    ProductImage,
    ProductVariant,
    InventoryRecord,
    Adjustment,
    AdjustmentItem,
    Transfer,
    TransferItem,
    ExpenseCategory,
    Expense,
    Customer,
    Supplier,
    Quotation,
    QuotationItem,
    Purchase,
    PurchaseItem,
    Sale,
    SaleItem,
    Return,
    ReturnItem,
    Payment,
    Note,
    Setting,
    Backup,
    UserSession,
    LabelTemplate,
    PasswordReset,
    NotificationSetting,
    Notification,
    OneTimeCode,
    AuthLog,
  },
};
