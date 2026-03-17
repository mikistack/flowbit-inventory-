const fs = require('fs/promises');
const path = require('path');
const { Parser } = require('json2csv');
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const env = require('../config/env');
const { models } = require('../models');

const ensureReportDir = async () => {
  await fs.mkdir(env.storage.reportsDir, { recursive: true });
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const collectTransactions = async (from, to) => {
  const dateFilter = {};
  if (from && to) {
    dateFilter[Op.between] = [from.toDate(), to.toDate()];
  } else if (from) {
    dateFilter[Op.gte] = from.toDate();
  }
  const [sales, purchases] = await Promise.all([
    models.Sale.findAll({
      where: { createdAt: dateFilter },
      include: [{ model: models.Customer }, { model: models.Warehouse }],
    }),
    models.Purchase.findAll({
      where: { createdAt: dateFilter },
      include: [{ model: models.Supplier }, { model: models.Warehouse }],
    }),
  ]);

  const rows = [];
  sales.forEach((sale) => {
    rows.push({
      type: 'Sale',
      reference: sale.reference,
      branch: sale.Warehouse?.name || '',
      counterparty: sale.Customer?.name || '',
      amount: toNumber(sale.paid) + toNumber(sale.due),
      paid: toNumber(sale.paid),
      due: toNumber(sale.due),
      tax: toNumber(sale.orderTax),
      discount: toNumber(sale.discount),
      status: sale.status,
      paymentStatus: sale.paymentStatus,
      date: dayjs(sale.createdAt).format('YYYY-MM-DD HH:mm'),
    });
  });
  purchases.forEach((purchase) => {
    rows.push({
      type: 'Purchase',
      reference: purchase.reference,
      branch: purchase.Warehouse?.name || '',
      counterparty: purchase.Supplier?.name || '',
      amount: toNumber(purchase.paid) + toNumber(purchase.due),
      paid: toNumber(purchase.paid),
      due: toNumber(purchase.due),
      tax: toNumber(purchase.orderTax),
      discount: toNumber(purchase.discount),
      status: purchase.status,
      paymentStatus: purchase.paymentStatus,
      date: dayjs(purchase.createdAt).format('YYYY-MM-DD HH:mm'),
    });
  });
  return rows;
};

const generateTransactionReport = async ({ label, period }) => {
  await ensureReportDir();
  const from = period?.from ? dayjs(period.from) : dayjs().startOf('day');
  const to = period?.to ? dayjs(period.to) : dayjs();
  const rows = await collectTransactions(from, to);
  if (!rows.length) {
    rows.push({
      type: 'info',
      reference: 'n/a',
      branch: 'n/a',
      counterparty: 'n/a',
      amount: 0,
      paid: 0,
      due: 0,
      tax: 0,
      discount: 0,
      status: 'no-data',
      paymentStatus: 'n/a',
      date: dayjs().format('YYYY-MM-DD HH:mm'),
    });
  }
  const parser = new Parser();
  const csv = parser.parse(rows);
  const fileName = `report-${label.replace(/\s+/g, '-').toLowerCase()}-${dayjs().format('YYYYMMDDHHmmss')}.csv`;
  const filePath = path.join(env.storage.reportsDir, fileName);
  await fs.writeFile(filePath, csv);
  const stats = await fs.stat(filePath);
  return { filePath, fileName, size: stats.size, from: from.toISOString(), to: to.toISOString() };
};

const generateOpsActivityCsv = async ({ label, range }) => {
  await ensureReportDir();
  const from = range?.from ? dayjs(range.from) : dayjs().startOf('day');
  const to = range?.to ? dayjs(range.to) : dayjs();
  const where = {
    createdAt: {
      [Op.between]: [from.toDate(), to.toDate()],
    },
  };
  const [sales, purchases, products, expenses] = await Promise.all([
    models.Sale.findAll({
      where,
      include: [{ model: models.Customer }, { model: models.Warehouse }],
    }),
    models.Purchase.findAll({
      where,
      include: [{ model: models.Supplier }, { model: models.Warehouse }],
    }),
    models.Product.findAll({ where }),
    models.Expense.findAll({
      where,
      include: [{ model: models.ExpenseCategory, as: 'category' }, { model: models.Warehouse }],
    }),
  ]);
  const rows = [];
  const pushRow = (row) => rows.push(row);
  sales.forEach((sale) =>
    pushRow({
      action: 'Sale',
      reference: sale.reference,
      name: sale.Customer?.name || sale.reference,
      branch: sale.Warehouse?.name || '',
      counterparty: sale.Customer?.name || '',
      amount: toNumber(sale.paid) + toNumber(sale.due),
      notes: `Status: ${sale.status}`,
      date: dayjs(sale.createdAt).format('YYYY-MM-DD HH:mm'),
    }),
  );
  purchases.forEach((purchase) =>
    pushRow({
      action: 'Purchase',
      reference: purchase.reference,
      name: purchase.Supplier?.name || purchase.reference,
      branch: purchase.Warehouse?.name || '',
      counterparty: purchase.Supplier?.name || '',
      amount: toNumber(purchase.paid) + toNumber(purchase.due),
      notes: `Status: ${purchase.status}`,
      date: dayjs(purchase.createdAt).format('YYYY-MM-DD HH:mm'),
    }),
  );
  products.forEach((product) =>
    pushRow({
      action: 'New Product',
      reference: product.code,
      name: product.name,
      branch: '',
      counterparty: '',
      amount: toNumber(product.price),
      notes: `Stock alert: ${product.stockAlert ?? 0}`,
      date: dayjs(product.createdAt).format('YYYY-MM-DD HH:mm'),
    }),
  );
  expenses.forEach((expense) =>
    pushRow({
      action: 'Expense',
      reference: expense.reference,
      name: expense.category?.name || 'Expense',
      branch: expense.Warehouse?.name || '',
      counterparty: '',
      amount: toNumber(expense.amount),
      notes: expense.details || '',
      date: dayjs(expense.createdAt).format('YYYY-MM-DD HH:mm'),
    }),
  );
  if (!rows.length) {
    rows.push({
      action: 'info',
      reference: 'n/a',
      name: 'No records',
      branch: 'n/a',
      counterparty: 'n/a',
      amount: 0,
      notes: 'No activity recorded',
      date: dayjs().format('YYYY-MM-DD HH:mm'),
    });
  }
  const parser = new Parser();
  const csv = parser.parse(rows);
  const fileName = `ops-${label}-${dayjs().format('YYYYMMDDHHmmss')}.csv`;
  const filePath = path.join(env.storage.reportsDir, fileName);
  await fs.writeFile(filePath, csv);
  const stats = await fs.stat(filePath);
  return { filePath, fileName, size: stats.size, from: from.toISOString(), to: to.toISOString() };
};

module.exports = {
  generateTransactionReport,
  generateOpsActivityCsv,
};
