const { Op } = require('sequelize');
const dayjs = require('dayjs');
const asyncHandler = require('../utils/asyncHandler');
const { models } = require('../models');
const opsReportService = require('../services/opsReport.service');

const resolveRange = (query) => {
  if (query.from && query.to) {
    return { from: query.from, to: query.to };
  }
  const now = dayjs();
  const ranges = {
    today: { from: now.startOf('day').toISOString(), to: now.endOf('day').toISOString() },
    last7: { from: now.subtract(7, 'day').startOf('day').toISOString(), to: now.toISOString() },
    last30: { from: now.subtract(30, 'day').startOf('day').toISOString(), to: now.toISOString() },
    last90: { from: now.subtract(90, 'day').startOf('day').toISOString(), to: now.toISOString() },
    ytd: { from: now.startOf('year').toISOString(), to: now.toISOString() },
  };
  return ranges[query.range] || ranges.last30;
};

const appendDateFilter = (clause, range) => {
  if (!range) return clause;
  return {
    ...clause,
    date: {
      [Op.between]: [range.from, range.to],
    },
  };
};

const summarizePayments = async (type) => {
  const payments = await models.Payment.findAll({
    where: { type },
    order: [['date', 'DESC']],
    limit: 100,
    include: [
      { model: models.Sale, include: [{ model: models.Customer }] },
      { model: models.Purchase, include: [{ model: models.Supplier }] },
      {
        model: models.Return,
        include: [
          { model: models.Customer, as: 'customer' },
          { model: models.Supplier, as: 'supplier' },
        ],
      },
    ],
  });
  return payments.map((payment) => ({
    id: payment.id,
    date: payment.date,
    reference: payment.reference,
    paidBy: payment.paidBy,
    amount: payment.amount,
    related: payment.Sale?.reference || payment.Purchase?.reference || payment.Return?.reference,
    partner:
      payment.Sale?.Customer?.name ||
      payment.Purchase?.Supplier?.name ||
      (payment.Return?.type === 'sale'
        ? payment.Return?.customer?.name
        : payment.Return?.supplier?.name),
  }));
};

module.exports = {
  profitAndLoss: asyncHandler(async (req, res) => {
    const range = resolveRange(req.query);
    const where = appendDateFilter({}, range);

    const sales = (await models.Sale.sum('paid', { where })) || 0;
    const purchases = (await models.Purchase.sum('paid', { where })) || 0;
    const salesReturns =
      (await models.Return.sum('total', {
        where: { ...(where.date ? { date: where.date } : {}), type: 'sale' },
      })) || 0;
    const purchaseReturns =
      (await models.Return.sum('total', {
        where: { ...(where.date ? { date: where.date } : {}), type: 'purchase' },
      })) || 0;
    const expenses = (await models.Expense.sum('amount', { where })) || 0;
    const paymentsReceived =
      ((await models.Payment.sum('amount', {
        where: appendDateFilter({ type: { [Op.in]: ['sale', 'purchase_return'] } }, range),
      })) || 0);
    const paymentsSent =
      ((await models.Payment.sum('amount', {
        where: appendDateFilter({ type: { [Op.in]: ['purchase', 'sale_return'] } }, range),
      })) || 0);

    res.json({
      filters: { ...req.query, ...range },
      summary: {
        sales,
        purchases,
        salesReturns,
        purchaseReturns,
        expenses,
        profit: sales - purchases,
        paymentsReceived,
        paymentsSent,
        paymentsNet: paymentsReceived - paymentsSent,
      },
    });
  }),
  paymentReport: asyncHandler(async (req, res) => {
    const [purchasePayments, salePayments, saleReturnPayments, purchaseReturnPayments] = await Promise.all([
      summarizePayments('purchase'),
      summarizePayments('sale'),
      summarizePayments('sale_return'),
      summarizePayments('purchase_return'),
    ]);

    res.json({
      purchasePayments,
      salePayments,
      saleReturnPayments,
      purchaseReturnPayments,
    });
  }),
  productAlerts: asyncHandler(async (req, res) => {
    const records = await models.InventoryRecord.findAll({
      where: { reorderPoint: { [Op.not]: null } },
      include: [{ model: models.Product }, { model: models.Warehouse }],
    });
    const lowStock = records.filter(
      (record) => record.reorderPoint !== null && record.quantityOnHand <= record.reorderPoint,
    );
    res.json(
      lowStock.map((record) => ({
        id: record.id,
        code: record.Product?.code,
        product: record.Product?.name,
        warehouse: record.Warehouse?.name,
        quantity: record.quantityOnHand,
        alertQuantity: record.reorderPoint,
      })),
    );
  }),
  warehouseReport: asyncHandler(async (req, res) => {
    const { warehouseId } = req.query;
    const filter = warehouseId ? { where: { warehouseId } } : {};
    const [sales, purchases, salesReturns, purchaseReturns, expenses, totalProducts] = await Promise.all([
      models.Sale.count(filter),
      models.Purchase.count(filter),
      models.Return.count({ ...filter, where: { ...filter.where, type: 'sale' } }),
      models.Return.count({ ...filter, where: { ...filter.where, type: 'purchase' } }),
      models.Expense.count(filter),
      models.Product.count(),
    ]);
    res.json({
      warehouseId,
      cards: {
        sales,
        purchases,
        salesReturns,
        purchaseReturns,
        expenses,
        totalProducts,
      },
    });
  }),
  saleReport: asyncHandler(async (req, res) => {
    const data = await models.Sale.findAll({ order: [['date', 'DESC']], limit: 100 });
    res.json(data);
  }),
  purchaseReport: asyncHandler(async (req, res) => {
    const data = await models.Purchase.findAll({ order: [['date', 'DESC']], limit: 100 });
    res.json(data);
  }),
  customerReport: asyncHandler(async (req, res) => {
    const customers = await models.Customer.findAll({
      include: [{ model: models.Sale }],
    });
    const result = customers.map((customer) => {
      const totals = customer.Sales?.reduce(
        (acc, sale) => ({
          totalAmount: acc.totalAmount + Number(sale.paid || 0),
        }),
        { totalAmount: 0 },
      ) || { totalAmount: 0 };
      return {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        phone: customer.phone,
        totalSales: customer.Sales?.length || 0,
        totalAmount: totals.totalAmount,
      };
    });
    res.json(result);
  }),
  supplierReport: asyncHandler(async (req, res) => {
    const suppliers = await models.Supplier.findAll({
      include: [{ model: models.Purchase }],
    });
    const result = suppliers.map((supplier) => ({
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      phone: supplier.phone,
      totalPurchases: supplier.Purchases?.length || 0,
    }));
    res.json(result);
  }),
  dashboardSummary: asyncHandler(async (req, res) => {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : null;
    const warehouseFilter = Number.isFinite(warehouseId) && warehouseId > 0 ? warehouseId : null;
    const baseWhere = warehouseFilter ? { warehouseId: warehouseFilter } : {};

    const [
      salesTotal,
      purchasesTotal,
      expensesTotal,
      inventoryRecords,
      transfers,
      salesCount,
      purchasesCount,
      salesReturnCount,
      purchaseReturnCount,
      expensesCount,
    ] = await Promise.all([
      models.Sale.sum('paid', { where: baseWhere }),
      models.Purchase.sum('paid', { where: baseWhere }),
      models.Expense.sum('amount', { where: baseWhere }),
      models.InventoryRecord.findAll({
        where: baseWhere,
        include: [
          { model: models.Product, attributes: ['name', 'code', 'cost'] },
          { model: models.Warehouse, attributes: ['name'] },
        ],
      }),
      models.Transfer.findAll({
        where: warehouseFilter
          ? {
              [Op.or]: [{ fromWarehouseId: warehouseFilter }, { toWarehouseId: warehouseFilter }],
            }
          : undefined,
        order: [['createdAt', 'DESC']],
        limit: 5,
        include: [
          { model: models.Warehouse, as: 'fromWarehouse', attributes: ['name'] },
          { model: models.Warehouse, as: 'toWarehouse', attributes: ['name'] },
        ],
      }),
      models.Sale.count({ where: baseWhere }),
      models.Purchase.count({ where: baseWhere }),
      models.Return.count({ where: { ...baseWhere, type: 'sale' } }),
      models.Return.count({ where: { ...baseWhere, type: 'purchase' } }),
      models.Expense.count({ where: baseWhere }),
    ]);

    const inventoryValue = inventoryRecords.reduce((sum, record) => {
      const qty = Number(record.quantityOnHand || 0);
      const cost = Number(record.Product?.cost || 0);
      return sum + qty * cost;
    }, 0);

    const inventoryBreakdownMap = {};
    inventoryRecords.forEach((record) => {
      const key = record.warehouseId || 'unassigned';
      if (!inventoryBreakdownMap[key]) {
        inventoryBreakdownMap[key] = {
          warehouseId: record.warehouseId,
          warehouse: record.Warehouse?.name || 'Unassigned',
          quantity: 0,
          stockValue: 0,
        };
      }
      inventoryBreakdownMap[key].quantity += Number(record.quantityOnHand || 0);
      inventoryBreakdownMap[key].stockValue += Number(record.quantityOnHand || 0) * Number(record.Product?.cost || 0);
    });
    const inventoryBreakdown = Object.values(inventoryBreakdownMap).sort(
      (a, b) => Number(b.stockValue) - Number(a.stockValue),
    );

    const lowStock = inventoryRecords
      .filter(
        (record) =>
          record.reorderPoint !== null &&
          record.reorderPoint !== undefined &&
          Number(record.quantityOnHand || 0) <= Number(record.reorderPoint),
      )
      .map((record) => ({
        id: record.id,
        code: record.Product?.code,
        name: record.Product?.name,
        warehouse: record.Warehouse?.name,
        quantity: Number(record.quantityOnHand || 0),
        alertQuantity: Number(record.reorderPoint),
      }))
      .slice(0, 6);

    res.json({
      warehouseId: warehouseFilter,
      totals: {
        sales: Number(salesTotal) || 0,
        purchases: Number(purchasesTotal) || 0,
        expenses: Number(expensesTotal) || 0,
        profit: (Number(salesTotal) || 0) - (Number(purchasesTotal) || 0) - (Number(expensesTotal) || 0),
        inventoryValue,
      },
      performance: {
        sales: Number(salesTotal) || 0,
        purchases: Number(purchasesTotal) || 0,
      },
      lowStock,
      transfers: transfers.map((transfer) => ({
        id: transfer.id,
        reference: transfer.reference,
        status: transfer.status,
        from: transfer.fromWarehouse?.name,
        to: transfer.toWarehouse?.name,
        date: transfer.createdAt,
      })),
      reportCounts: {
        sales: salesCount,
        purchases: purchasesCount,
        salesReturns: salesReturnCount,
        purchaseReturns: purchaseReturnCount,
        expenses: expensesCount,
      },
      inventoryBreakdown,
    });
  }),
  opsSummary: asyncHandler(async (req, res) => {
    const summary = await opsReportService.buildOpsSummary(req.query.period || 'daily');
    res.json(summary);
  }),
  notifyOpsSummary: asyncHandler(async (req, res) => {
    const summary = await opsReportService.sendOpsSummaryNotification(req.body?.period || req.query.period || 'daily');
    res.json(summary);
  }),
};
