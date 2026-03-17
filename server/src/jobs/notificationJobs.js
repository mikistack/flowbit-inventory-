const cron = require('node-cron');
const path = require('path');
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { models } = require('../models');
const notificationSettingsService = require('../services/notificationSettings.service');
const notificationService = require('../services/notification.service');
const reportExportService = require('../services/reportExport.service');
const opsReportService = require('../services/opsReport.service');
const env = require('../config/env');

const recentlyNotified = new Map();
const csvRunTracker = { daily: null, weekly: null, monthly: null };
const opsRunTracker = { daily: null, weekly: null, monthly: null };

const shouldSkipDuplicate = (key, ttlMinutes = 120) => {
  const now = Date.now();
  const prev = recentlyNotified.get(key);
  if (prev && now - prev < ttlMinutes * 60 * 1000) {
    return true;
  }
  recentlyNotified.set(key, now);
  return false;
};

const checkLowStock = async () => {
  const settings = await notificationSettingsService.getSettings();
  const threshold = Number(settings.lowStockThreshold || 5);
  const records = await models.InventoryRecord.findAll({
    where: { quantityOnHand: { [Op.lte]: threshold } },
    include: [{ model: models.Product }, { model: models.Warehouse }],
  });
  await Promise.all(
    records.map(async (record) => {
      const key = `low-${record.productId}-${record.warehouseId}`;
      if (shouldSkipDuplicate(key)) return;
      await notificationService.createNotification({
        type: 'low_stock',
        title: `Low stock: ${record.Product?.name || record.productId}`,
        message: `Warehouse ${record.Warehouse?.name || record.warehouseId} has ${record.quantityOnHand} units.`,
        severity: 'warning',
        meta: {
          productId: record.productId,
          warehouseId: record.warehouseId,
          quantity: record.quantityOnHand,
        },
      });
    }),
  );
};

const shouldRunCsv = (scheduleFlag, trackerKey) => {
  if (!scheduleFlag) return false;
  const today = dayjs().format('YYYY-MM-DD');
  if (csvRunTracker[trackerKey] === today) return false;
  csvRunTracker[trackerKey] = today;
  return true;
};

const generateCsvReports = async () => {
  const settings = await notificationSettingsService.getSettings();
  const currentHour = dayjs().hour();
  const scheduleHour = Number(settings.csvSchedule?.hour ?? 8);
  if (currentHour !== scheduleHour) return;
  const today = dayjs();
  const tasks = [];
  if (shouldRunCsv(settings.csvSchedule?.daily, 'daily')) {
    tasks.push({ label: 'Daily report', period: { from: today.startOf('day'), to: today.endOf('day') } });
  }
  if (today.day() === 1 && shouldRunCsv(settings.csvSchedule?.weekly, 'weekly')) {
    tasks.push({ label: 'Weekly report', period: { from: today.subtract(7, 'day'), to: today } });
  }
  if (today.date() === 1 && shouldRunCsv(settings.csvSchedule?.monthly, 'monthly')) {
    tasks.push({ label: 'Monthly report', period: { from: today.subtract(30, 'day'), to: today } });
  }
  if (!tasks.length) return;
  await Promise.all(
    tasks.map(async (task) => {
      const artifact = await reportExportService.generateTransactionReport({ label: task.label, period: task.period });
      const relativePath = path.relative(env.storage.reportsDir, artifact.filePath);
      await notificationService.createNotification({
        type: 'csv_schedule',
        title: `${task.label} report ready`,
        message: `CSV export generated for ${task.label.toLowerCase()}.`,
        severity: 'info',
        meta: {
          fileName: artifact.fileName,
          filePath: relativePath,
          from: artifact.from,
          to: artifact.to,
          size: artifact.size,
        },
      });
    }),
  );
};

const shouldRunOps = (flag, key) => {
  if (!flag) return false;
  const today = dayjs().format('YYYY-MM-DD');
  if (opsRunTracker[key] === today) {
    return false;
  }
  opsRunTracker[key] = today;
  return true;
};

const dispatchOpsReports = async () => {
  const settings = await notificationSettingsService.getSettings();
  const schedule = settings.opsReportSchedule || {};
  const scheduleHour = Number(schedule.hour ?? 8);
  if (dayjs().hour() !== scheduleHour) return;
  const today = dayjs();
  const tasks = [];
  if (shouldRunOps(schedule.daily, 'daily')) {
    tasks.push('daily');
  }
  if (today.day() === 1 && shouldRunOps(schedule.weekly, 'weekly')) {
    tasks.push('weekly');
  }
  if (today.date() === 1 && shouldRunOps(schedule.monthly, 'monthly')) {
    tasks.push('monthly');
  }
  await Promise.all(tasks.map((period) => opsReportService.sendOpsSummaryNotification(period)));
};

const startNotificationJobs = () => {
  const timezone = env.app.timezone || 'UTC';
  cron.schedule('0 * * * *', checkLowStock, { timezone });
  cron.schedule('0 * * * *', generateCsvReports, { timezone });
  cron.schedule('0 * * * *', dispatchOpsReports, { timezone });
};

module.exports = {
  startNotificationJobs,
};
