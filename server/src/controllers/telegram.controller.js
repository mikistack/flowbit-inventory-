const asyncHandler = require('../utils/asyncHandler');
const telegramService = require('../services/telegram.service');
const notificationSettingsService = require('../services/notificationSettings.service');
const env = require('../config/env');

const ensureSecret = (req) => {
  if (!env.telegram.webhookSecret) return true;
  const token = req.headers['x-telegram-bot-api-secret-token'] || req.query.secret;
  return token === env.telegram.webhookSecret;
};

module.exports = {
  webhook: asyncHandler(async (req, res) => {
    if (!ensureSecret(req)) {
      return res.status(401).json({ message: 'Invalid webhook signature.' });
    }
    await telegramService.handleUpdate(req.body);
    res.json({ ok: true });
  }),
  test: asyncHandler(async (req, res) => {
    const { message } = req.body || {};
    const settings = await notificationSettingsService.getSettings();
    await telegramService.sendNotificationMessage(
      {
        title: 'Test Alert',
        message: message || 'This is a Telegram delivery test.',
        createdAt: new Date(),
      },
      settings.channels?.telegram,
    );
    res.json({ message: 'Test notification dispatched (if channel configured).' });
  }),
};
