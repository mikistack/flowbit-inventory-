const path = require('path');
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { models } = require('../models');
const notificationSettingsService = require('./notificationSettings.service');
const notificationService = require('./notification.service');
const reportExportService = require('./reportExport.service');
const env = require('../config/env');

const periodToRange = (period = 'daily') => {
  const now = dayjs();
  switch (period) {
    case 'weekly':
      return { from: now.subtract(7, 'day').startOf('day'), to: now.endOf('day') };
    case 'monthly':
      return { from: now.subtract(30, 'day').startOf('day'), to: now.endOf('day') };
    case 'daily':
    default:
      return { from: now.startOf('day'), to: now.endOf('day') };
  }
};

const mapUsers = (records) =>
  records.map((user) => ({
    id: user.id,
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
    username: user.username,
    role: user.role?.name || 'N/A',
    status: user.status,
    warehouse: user.warehouse?.name || null,
  }));

const mapLowStock = (records) =>
  records.map((record) => ({
    productId: record.productId,
    product: record.Product?.name || 'Unnamed',
    code: record.Product?.code || '',
    warehouse: record.Warehouse?.name || '',
    quantity: Number(record.quantityOnHand) || 0,
    reorderPoint: Number(record.reorderPoint) || 0,
  }));

const buildOpsSummary = async (period = 'daily') => {
  const range = periodToRange(period);
  const dateBetween = {
    date: {
      [Op.between]: [range.from.toDate(), range.to.toDate()],
    },
  };
  const settings = await notificationSettingsService.getSettings();
  const threshold = Number(settings.lowStockThreshold ?? 5);
  const [salesCount, salesTotal, purchasesCount, purchasesTotal, users, lowStockRecords] =
    await Promise.all([
      models.Sale.count({ where: dateBetween }),
      models.Sale.sum('paid', { where: dateBetween }),
      models.Purchase.count({ where: dateBetween }),
      models.Purchase.sum('paid', { where: dateBetween }),
      models.User.findAll({
        attributes: ['id', 'firstName', 'lastName', 'username', 'status'],
        include: [
          { model: models.Role, as: 'role', attributes: ['name'] },
          { model: models.Warehouse, as: 'warehouse', attributes: ['name'] },
        ],
        order: [['createdAt', 'DESC']],
      }),
      models.InventoryRecord.findAll({
        where: {
          quantityOnHand: { [Op.lte]: threshold },
        },
        include: [{ model: models.Product }, { model: models.Warehouse }],
        order: [['quantityOnHand', 'ASC']],
        limit: 10,
      }),
    ]);

  return {
    period,
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    metrics: {
      sales: {
        count: salesCount,
        total: Number(salesTotal || 0),
      },
      purchases: {
        count: purchasesCount,
        total: Number(purchasesTotal || 0),
      },
      lowStockCount: lowStockRecords.length,
    },
    workers: mapUsers(users),
    lowStock: mapLowStock(lowStockRecords),
  };
};

const sendOpsSummaryNotification = async (period = 'daily') => {
  const summary = await buildOpsSummary(period);
  const csvArtifact = await reportExportService.generateOpsActivityCsv({
    label: period,
    range: { from: summary.range.from, to: summary.range.to },
  });
  const relativePath = path.relative(env.storage.reportsDir, csvArtifact.filePath);
  const message = `Sales: ETB ${summary.metrics.sales.total.toFixed(2)} · Purchases: ETB ${summary.metrics.purchases.total.toFixed(
    2,
  )} · Low stock items: ${summary.lowStock.length}`;
  await notificationService.createNotification({
    type: 'ops_summary',
    title: `Operations summary (${period})`,
    message,
    severity: 'info',
    meta: {
      ...summary,
      filePath: relativePath,
      fileName: csvArtifact.fileName,
      fileSize: csvArtifact.size,
    },
  });
  return summary;
};

module.exports = {
  buildOpsSummary,
  sendOpsSummaryNotification,
};
