const { Op } = require('sequelize');
const { models } = require('../models');
const notificationSettingsService = require('./notificationSettings.service');
const telegramService = require('./telegram.service');
const logger = require('../utils/logger');

const dispatchNotificationChannels = async (notification) => {
  const settings = await notificationSettingsService.getSettings();
  const channel = settings.channels?.telegram;
  if (channel?.enabled) {
    await telegramService.sendNotificationMessage(notification, channel);
  }
};

const createNotification = async (payload = {}) => {
  const notification = await models.Notification.create(payload);
  dispatchNotificationChannels(notification).catch((error) => {
    logger.error('Notification dispatch error', { error: error.message });
  });
  return notification;
};

const listNotifications = async (userId, options = {}) => {
  const query = { where: {}, order: [['createdAt', 'DESC']], limit: options.limit || 50 };
  if (userId) {
    query.where = {
      [Op.or]: [{ userId }, { userId: null }],
    };
  }
  return models.Notification.findAll(query);
};

const markAsRead = async (notificationId, userId) => {
  const notification = await models.Notification.findOne({
    where: {
      id: notificationId,
      [Op.or]: [{ userId }, { userId: null }],
    },
  });
  if (!notification) return null;
  await notification.update({ readAt: new Date() });
  return notification;
};

module.exports = {
  createNotification,
  listNotifications,
  markAsRead,
};
