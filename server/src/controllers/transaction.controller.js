const { Sequelize } = require('sequelize');
const { sequelize, models } = require('../models');
const { adjustInventory, getInventoryQuantity } = require('../services/inventory.service');
const notificationSettingsService = require('../services/notificationSettings.service');
const notificationService = require('../services/notification.service');

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const pad = (value) => value.toString().padStart(2, '0');
const generateReference = (prefix) => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const randomPart = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${datePart}-${randomPart}`;
};

const isAdminUser = (req) => ['Admin', 'Super Admin'].includes(req.user?.role?.name);

const ensureWarehouseAccess = (req, res, warehouseId) => {
  if (isAdminUser(req)) {
    return true;
  }

  const assigned = req.user?.warehouseId;
  if (!assigned) {
    res.status(403).json({ message: 'Warehouse assignment required for this action.' });
    return false;
  }

  if (Number(assigned) !== Number(warehouseId)) {
    res.status(403).json({ message: 'You are not authorized to operate on this warehouse.' });
    return false;
  }

  return true;
};

const applyWarehouseScope = (req, res, where = {}, model, overrideField) => {
  if (isAdminUser(req)) {
    return where;
  }
  const assigned = req.user?.warehouseId;
  if (!assigned) {
    res.status(403).json({ message: 'Warehouse assignment required to view this data.' });
    return null;
  }
  const attribute =
    overrideField ||
    model?.rawAttributes?.warehouseId?.field ||
    model?.rawAttributes?.warehouse_id?.field ||
    'warehouse_id';
  return { ...where, [attribute]: assigned };
};

const paginationMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

const calcTotals = (items = []) =>
  items.reduce(
    (acc, item) => {
      const qty = toNumber(item.quantity);
      const price = toNumber(item.price);
      acc.subtotal += qty * price;
      acc.discount += toNumber(item.discount);
      acc.tax += toNumber(item.tax);
      return acc;
    },
    { subtotal: 0, discount: 0, tax: 0 },
  );

const paymentStatus = (paid, total) => {
  if (paid >= total) return 'paid';
  if (paid > 0) return 'partial';
  return 'pending';
};

const triggerHighValueAlert = async (type, amount, meta = {}) => {
  const settings = await notificationSettingsService.getSettings();
  const threshold =
    type === 'sale'
      ? Number(settings.highSalesThreshold || 0)
      : Number(settings.highPurchaseThreshold || 0);
  if (!threshold || amount < threshold) return;
  await notificationService.createNotification({
    type: `high_${type}`,
    title: `High ${type === 'sale' ? 'sale' : 'purchase'} recorded`,
    message: `Transaction amount ${amount} exceeds threshold ${threshold}.`,
    severity: 'critical',
    meta: { amount, ...meta },
  });
};

const triggerHighQuantityAlert = async (quantity, meta = {}) => {
  const settings = await notificationSettingsService.getSettings();
  const threshold = Number(settings.highAdditionThreshold || 0);
  if (!threshold || quantity < threshold) return;
  await notificationService.createNotification({
    type: 'high_quantity',
    title: 'High stock intake recorded',
    message: `A batch of ${quantity} units exceeded the configured alert threshold of ${threshold}.`,
    severity: 'warning',
    meta: { quantity, ...meta },
  });
};

const includeMaps = {
  purchase: [
    { model: models.Supplier },
    { model: models.Warehouse },
    { model: models.PurchaseItem, as: 'items', include: [{ model: models.Product }] },
  ],
  sale: [
    { model: models.Customer },
    { model: models.Warehouse },
    { model: models.SaleItem, as: 'items', include: [{ model: models.Product }] },
  ],
  adjustment: [
    { model: models.Warehouse },
    { model: models.AdjustmentItem, as: 'items', include: [{ model: models.Product }] },
  ],
  transfer: [
    { model: models.Warehouse, as: 'fromWarehouse' },
    { model: models.Warehouse, as: 'toWarehouse' },
    { model: models.TransferItem, as: 'items', include: [{ model: models.Product }] },
  ],
};

const listRecords = async (model, includeKey, req, res, where = {}, options = {}) => {
  const page = toNumber(req.query.page, 1);
  const limit = toNumber(req.query.limit, 25);
  const offset = (page - 1) * limit;

  let scopedWhere = where;
  if (options.scopeByWarehouse !== false) {
    scopedWhere = applyWarehouseScope(req, res, where, model, options.warehouseField);
    if (scopedWhere === null) {
      return;
    }
  }

  const { rows, count } = await model.findAndCountAll({
    where: scopedWhere,
    include: includeMaps[includeKey],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  res.json({ data: rows, meta: paginationMeta(page, limit, count) });
};

const createPurchase = async (req, res) => {
  const {
    items = [],
    shipping = 0,
    orderDiscount = 0,
    orderTax = 0,
    supplierId,
    warehouseId,
    note,
    reference,
    paid = 0,
    paymentStatus: paymentState,
    status: orderStatus,
  } = req.body || {};
  if (!items.length) {
    return res.status(400).json({ message: 'At least one item is required.' });
  }

  if (!ensureWarehouseAccess(req, res, warehouseId)) {
    return;
  }

  const normalizedItems = items
    .map((item) => ({
      productId: item.productId,
      quantity: toNumber(item.quantity),
      price: toNumber(item.price),
      discount: toNumber(item.discount),
      tax: toNumber(item.tax),
    }))
    .filter((item) => item.productId && item.quantity > 0);
  const totalQuantity = normalizedItems.reduce((sum, line) => sum + line.quantity, 0);

  if (!normalizedItems.length) {
    return res.status(400).json({ message: 'Provide valid product lines.' });
  }

  const totals = calcTotals(normalizedItems);
  totals.discount += toNumber(orderDiscount);
  totals.tax += toNumber(orderTax);
  const shippingCost = toNumber(shipping);
  const grandTotal = totals.subtotal + totals.tax - totals.discount + shippingCost;
  const paidAmount = toNumber(paid);
  const dueAmount = grandTotal - paidAmount;

  const referenceCode = reference || generateReference('PUR');

  const result = await sequelize.transaction(async (transaction) => {
    const purchase = await models.Purchase.create(
      {
        reference: referenceCode,
        supplierId,
        warehouseId,
        note,
        orderTax: totals.tax,
        discount: totals.discount,
        shipping: shippingCost,
        paid: paidAmount,
        due: dueAmount,
        paymentStatus: paymentState || paymentStatus(paidAmount, grandTotal),
        status: orderStatus || 'pending',
        date: new Date(),
      },
      { transaction },
    );

    for (const line of normalizedItems) {
      await models.PurchaseItem.create(
        {
          purchaseId: purchase.id,
          productId: line.productId,
          quantity: line.quantity,
          netUnitCost: line.price,
          discount: line.discount,
          tax: line.tax,
          subtotal: line.quantity * line.price - line.discount + line.tax,
        },
        { transaction },
      );
      await adjustInventory(line.productId, warehouseId, line.quantity, transaction);
    }

    return purchase;
  });

  const purchaseWithItems = await models.Purchase.findByPk(result.id, {
    include: includeMaps.purchase,
  });
  await triggerHighValueAlert('purchase', grandTotal, {
    reference: referenceCode,
    supplierId,
    warehouseId,
  });
  await triggerHighQuantityAlert(totalQuantity, {
    reference: referenceCode,
    warehouseId,
    supplierId,
    type: 'purchase',
  });
  res.status(201).json(purchaseWithItems);
};

const createSale = async (req, res) => {
  const {
    items = [],
    shipping = 0,
    orderDiscount = 0,
    orderTax = 0,
    customerId,
    warehouseId,
    note,
    reference,
    paid = 0,
    paymentStatus: paymentState,
    status: saleStatus,
  } = req.body || {};
  if (!items.length) {
    return res.status(400).json({ message: 'At least one item is required.' });
  }

  if (!ensureWarehouseAccess(req, res, warehouseId)) {
    return;
  }

  const normalizedItems = items
    .map((item) => ({
      productId: item.productId,
      quantity: toNumber(item.quantity),
      price: toNumber(item.price),
      discount: toNumber(item.discount),
      tax: toNumber(item.tax),
    }))
    .filter((item) => item.productId && item.quantity > 0);

  if (!normalizedItems.length) {
    return res.status(400).json({ message: 'Provide valid product lines.' });
  }

  const totals = calcTotals(normalizedItems);
  totals.discount += toNumber(orderDiscount);
  totals.tax += toNumber(orderTax);
  const shippingCost = toNumber(shipping);
  const grandTotal = totals.subtotal + totals.tax - totals.discount + shippingCost;
  const paidAmount = toNumber(paid);
  const dueAmount = grandTotal - paidAmount;

  const referenceCode = reference || generateReference('SAL');

  const result = await sequelize.transaction(async (transaction) => {
    const sale = await models.Sale.create(
      {
        reference: referenceCode,
        customerId,
        warehouseId,
        note,
        orderTax: totals.tax,
        discount: totals.discount,
        shipping: shippingCost,
        paid: paidAmount,
        due: dueAmount,
        paymentStatus: paymentState || paymentStatus(paidAmount, grandTotal),
        status: saleStatus || 'pending',
        date: new Date(),
      },
      { transaction },
    );

    for (const line of normalizedItems) {
      await models.SaleItem.create(
        {
          saleId: sale.id,
          productId: line.productId,
          quantity: line.quantity,
          netUnitPrice: line.price,
          discount: line.discount,
          tax: line.tax,
          subtotal: line.quantity * line.price - line.discount + line.tax,
        },
        { transaction },
      );
      await adjustInventory(line.productId, warehouseId, -line.quantity, transaction);
    }

    return sale;
  });

  const saleWithItems = await models.Sale.findByPk(result.id, {
    include: includeMaps.sale,
  });
  await triggerHighValueAlert('sale', grandTotal, {
    reference: referenceCode,
    customerId,
    warehouseId,
  });
  res.status(201).json(saleWithItems);
};

const createAdjustment = async (req, res) => {
  const { reference, warehouseId, note, items = [] } = req.body || {};
  const normalizedItems = items
    .map((item) => ({
      productId: item.productId,
      quantity: toNumber(item.quantity),
      type: item.type === 'subtraction' ? 'subtraction' : 'addition',
    }))
    .filter((item) => item.productId && item.quantity > 0);
  const additionQuantity = normalizedItems
    .filter((line) => line.type !== 'subtraction')
    .reduce((sum, line) => sum + line.quantity, 0);

  if (!normalizedItems.length) {
    return res.status(400).json({ message: 'Provide valid adjustment lines.' });
  }

  if (!ensureWarehouseAccess(req, res, warehouseId)) {
    return;
  }

  const referenceCode = reference || generateReference('ADJ');

  const adjustment = await sequelize.transaction(async (transaction) => {
    const record = await models.Adjustment.create(
      {
        reference: referenceCode,
        warehouseId,
        createdById: req.user?.id,
        notes: note,
        date: new Date(),
      },
      { transaction },
    );

    for (const line of normalizedItems) {
      await models.AdjustmentItem.create(
        {
          adjustmentId: record.id,
          productId: line.productId,
          quantity: line.quantity,
          type: line.type,
        },
        { transaction },
      );
      const delta = line.type === 'subtraction' ? -line.quantity : line.quantity;
      await adjustInventory(line.productId, warehouseId, delta, transaction);
    }

    return record;
  });

  const result = await models.Adjustment.findByPk(adjustment.id, {
    include: includeMaps.adjustment,
  });
  await triggerHighQuantityAlert(additionQuantity, {
    reference: referenceCode,
    warehouseId,
    type: 'adjustment',
  });
  res.status(201).json(result);
};

const createTransfer = async (req, res) => {
  const { reference, fromWarehouseId, toWarehouseId, note, items = [] } = req.body || {};

  if (!fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId) {
    return res.status(400).json({ message: 'Select distinct source and destination warehouses.' });
  }

  if (!ensureWarehouseAccess(req, res, fromWarehouseId)) {
    return;
  }

  const normalizedItems = items
    .map((item) => ({
      productId: item.productId,
      quantity: toNumber(item.quantity),
      netUnitCost: toNumber(item.price),
    }))
    .filter((item) => item.productId && item.quantity > 0);

  if (!normalizedItems.length) {
    return res.status(400).json({ message: 'Provide products to transfer.' });
  }

  const validationPromises = normalizedItems.map(async (line) => {
    const available = await getInventoryQuantity(line.productId, fromWarehouseId);
    if (line.quantity > available) {
      const product = await models.Product.findByPk(line.productId);
      const productName = product?.name || `product #${line.productId}`;
      const error = new Error(`Not enough stock for ${productName} in the source warehouse`);
      error.status = 400;
      throw error;
    }
  });

  try {
    await Promise.all(validationPromises);
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }

  const referenceCode = reference || generateReference('TRF');

  const transfer = await sequelize.transaction(async (transaction) => {
    const header = await models.Transfer.create(
      {
        reference: referenceCode,
        fromWarehouseId,
        toWarehouseId,
        createdById: req.user?.id,
        note,
        status: 'completed',
        date: new Date(),
      },
      { transaction },
    );

    for (const line of normalizedItems) {
      await models.TransferItem.create(
        {
          transferId: header.id,
          productId: line.productId,
          quantity: line.quantity,
          netUnitCost: line.netUnitCost,
          subtotal: line.quantity * line.netUnitCost,
        },
        { transaction },
      );
      await adjustInventory(line.productId, fromWarehouseId, -line.quantity, transaction);
      await adjustInventory(line.productId, toWarehouseId, line.quantity, transaction);
    }

    return header;
  });

  const result = await models.Transfer.findByPk(transfer.id, {
    include: includeMaps.transfer,
  });
  res.status(201).json(result);
};

module.exports = {
  listPurchases: (req, res) => listRecords(models.Purchase, 'purchase', req, res),
  createPurchase,
  listSales: (req, res) => listRecords(models.Sale, 'sale', req, res),
  createSale,
  listAdjustments: (req, res) => listRecords(models.Adjustment, 'adjustment', req, res),
  createAdjustment,
  listTransfers: (req, res) => {
    let where = {};
    if (!isAdminUser(req)) {
      const assigned = req.user?.warehouseId;
      if (!assigned) {
        return res.status(403).json({ message: 'Warehouse assignment required to view transfers.' });
      }
      where = {
        [Sequelize.Op.or]: [{ fromWarehouseId: assigned }, { toWarehouseId: assigned }],
      };
    }
    return listRecords(models.Transfer, 'transfer', req, res, where, { scopeByWarehouse: false });
  },
  createTransfer,
};
