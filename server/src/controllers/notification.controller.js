const fs = require('fs');
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notification.service');
const { models } = require('../models');
const env = require('../config/env');

const resolveReportPath = (relativePath) => {
  const safePath = relativePath || '';
  const normalized = path.normalize(safePath).replace(/^\/+/, '');
  return path.join(env.storage.reportsDir, normalized);
};

module.exports = {
  list: asyncHandler(async (req, res) => {
    const notifications = await notificationService.listNotifications(req.user.id, req.query);
    res.json(notifications);
  }),
  read: asyncHandler(async (req, res) => {
    const notification = await notificationService.markAsRead(req.params.id, req.user.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(notification);
  }),
  download: asyncHandler(async (req, res) => {
    const notification = await models.Notification.findByPk(req.params.id);
    if (!notification || !notification.meta?.filePath) {
      return res.status(404).json({ message: 'File not available for this notification.' });
    }
    const fullPath = resolveReportPath(notification.meta.filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'File not found.' });
    }
    res.download(fullPath, notification.meta.fileName || path.basename(fullPath));
  }),
};
