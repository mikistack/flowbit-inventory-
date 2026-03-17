const dayjs = require('dayjs');
const { Op } = require('sequelize');
const env = require('../config/env');
const { models } = require('../models');
const notificationSettingsService = require('./notificationSettings.service');
const opsReportService = require('./opsReport.service');

const fetchFn = (...args) => {
  if (typeof fetch === 'function') {
    return fetch(...args);
  }
  return Promise.reject(new Error('Fetch API not available in this runtime.'));
};

const buildApiUrl = (token, method) => `https://api.telegram.org/bot${token}/${method}`;

const sendTelegramRequest = async (token, payload) => {
  if (!token) {
    throw new Error('Telegram bot token missing.');
  }
  const response = await fetchFn(buildApiUrl(token, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Telegram API error: ${text}`);
  }
  return response.json();
};

const formatNotification = (notification) => {
  const stamp = dayjs(notification.createdAt || new Date()).format('YYYY-MM-DD HH:mm');
  return [`${notification.title || 'Inventory alert'}`, notification.message || '—', `Time: ${stamp}`]
    .filter(Boolean)
    .join('\n');
};

const resolveChannelConfig = (channelOverride) => {
  const base = channelOverride || {};
  return {
    enabled: Boolean(base.enabled),
    botToken: base.botToken || env.telegram.botToken,
    chatId: base.chatId || env.telegram.defaultChatId,
  };
};

const sendNotificationMessage = async (notification, channelConfig) => {
  if (!notification || !channelConfig?.enabled) {
    return false;
  }
  const { botToken, chatId } = resolveChannelConfig(channelConfig);
  if (!botToken || !chatId) {
    return false;
  }
  try {
    await sendTelegramRequest(botToken, {
      chat_id: chatId,
      text: formatNotification(notification),
    });
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Telegram notification error', error.message);
    return false;
  }
};

const sendOtpCode = async (user, code) => {
  if (!user?.telegramChatId || !code) return false;
  const settings = await notificationSettingsService.getSettings();
  const channel = resolveChannelConfig(settings.channels?.telegram || {});
  const chatId = user.telegramChatId;
  const token = channel.botToken;
  if (!token) return false;
  try {
    await sendTelegramRequest(token, {
      chat_id: chatId,
      text: `🔐 Security OTP: ${code}\nThis code expires in 5 minutes.`,
    });
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Telegram OTP error', error.message);
    return false;
  }
};

const handleStartCommand = async (chatId, botToken) => {
  const settings = await notificationSettingsService.getSettings();
  const adminUser = await models.User.findOne({
    where: { telegramChatId: String(chatId) },
    include: [{ model: models.Role, as: 'role' }],
  });
  const greeting =
    adminUser && adminUser.firstName
      ? `👋 Hello ${adminUser.firstName}!`
      : '👋 Inventory Cloud Bot';
  const message = [
    greeting,
    'Use /link <code> from your profile to connect any other account.',
    'Commands:',
    '• /alerts – latest alerts',
    '• /lowstock – products below threshold',
    '• /ops – latest operations summary',
    '• /workers – list of workers/roles',
    '• /report <daily|weekly|monthly> – generate a report + CSV',
  ].join('\n');
  await sendTelegramRequest(botToken, {
    chat_id: chatId,
    text: message,
  });
};

const handleLinkCommand = async (chatId, username, code, botToken) => {
  if (!code) {
    await sendTelegramRequest(botToken, {
      chat_id: chatId,
      text: 'Send /link CODE provided in the web portal.',
    });
    return;
  }
  const user = await models.User.findOne({ where: { telegramLinkCode: code.trim().toUpperCase() } });
  if (!user) {
    await sendTelegramRequest(botToken, {
      chat_id: chatId,
      text: 'Link code not found or already used.',
    });
    return;
  }
  await user.update({
    telegramChatId: String(chatId),
    telegramUsername: username || null,
    telegramOtpEnabled: true,
    telegramLinkCode: null,
  });
  await sendTelegramRequest(botToken, {
    chat_id: chatId,
    text: '✅ Telegram connected. You will now receive alerts and OTP prompts here.',
  });
};

const handleAlertsCommand = async (chatId, botToken) => {
  const notifications = await models.Notification.findAll({
    order: [['createdAt', 'DESC']],
    limit: 5,
  });
  if (!notifications.length) {
    await sendTelegramRequest(botToken, {
      chat_id: chatId,
      text: 'No alerts yet. You are all clear.',
    });
    return;
  }
  const text = notifications
    .map((notification) => `• ${notification.title || notification.type} — ${notification.message}`)
    .join('\n');
  await sendTelegramRequest(botToken, {
    chat_id: chatId,
    text,
  });
};

const handleLowStockCommand = async (chatId, botToken) => {
  const settings = await notificationSettingsService.getSettings();
  const threshold = Number(settings.lowStockThreshold || 5);
  const lowStock = await models.InventoryRecord.findAll({
    where: { quantityOnHand: { [Op.lte]: threshold } },
    include: [{ model: models.Product }, { model: models.Warehouse }],
    limit: 5,
  });
  if (!lowStock.length) {
    await sendTelegramRequest(botToken, {
      chat_id: chatId,
      text: 'Inventory is healthy. No low stock items today.',
    });
    return;
  }
  const text = lowStock
    .map(
      (record) =>
        `${record.Product?.name || record.productId}: ${record.quantityOnHand} pcs @ ${record.Warehouse?.name || 'Warehouse'}`,
    )
    .join('\n');
  await sendTelegramRequest(botToken, {
    chat_id: chatId,
    text,
  });
};

const handleWorkersCommand = async (chatId, botToken) => {
  const summary = await opsReportService.buildOpsSummary('daily');
  if (!summary.workers?.length) {
    await sendTelegramRequest(botToken, {
      chat_id: chatId,
      text: 'No workers found.',
    });
    return;
  }
  const entries = summary.workers.slice(0, 8).map(
    (worker, index) =>
      `${index + 1}. ${worker.name} – ${worker.role || 'Role'} (${worker.status})${
        worker.warehouse ? ` @ ${worker.warehouse}` : ''
      }`,
  );
  await sendTelegramRequest(botToken, {
    chat_id: chatId,
    text: entries.join('\n'),
  });
};

const handleReportCommand = async (chatId, botToken, periodArg) => {
  const allowed = ['daily', 'weekly', 'monthly'];
  const period = allowed.includes((periodArg || '').toLowerCase()) ? periodArg.toLowerCase() : 'daily';
  const summary = await opsReportService.sendOpsSummaryNotification(period);
  const text = [
    `📊 Report (${period})`,
    `Sales: ETB ${summary.metrics.sales.total.toFixed(2)}`,
    `Purchases: ETB ${summary.metrics.purchases.total.toFixed(2)}`,
    `Low stock items: ${summary.lowStock.length}`,
    'Full CSV available in the dashboard notifications.',
  ].join('\n');
  await sendTelegramRequest(botToken, {
    chat_id: chatId,
    text,
  });
};

const handleUpdate = async (update) => {
  const settings = await notificationSettingsService.getSettings();
  const channel = resolveChannelConfig(settings.channels?.telegram || {});
  const botToken = channel.botToken;
  if (!botToken || !update?.message) {
    return;
  }
  const chatId = update.message.chat?.id;
  const username = update.message.from?.username;
  const text = (update.message.text || '').trim();
  if (!text || !chatId) return;
  if (text.startsWith('/start')) {
    await handleStartCommand(chatId, botToken);
    return;
  }
  if (text.startsWith('/link')) {
    const [, code] = text.split(' ');
    await handleLinkCommand(chatId, username, code, botToken);
    return;
  }
  if (text.startsWith('/alerts')) {
    await handleAlertsCommand(chatId, botToken);
    return;
  }
  if (text.startsWith('/lowstock')) {
    await handleLowStockCommand(chatId, botToken);
    return;
  }
  if (text.startsWith('/ops')) {
    await handleOpsCommand(chatId, botToken);
    return;
  }
  if (text.startsWith('/workers')) {
    await handleWorkersCommand(chatId, botToken);
    return;
  }
  if (text.startsWith('/report')) {
    const [, arg] = text.split(' ');
    await handleReportCommand(chatId, botToken, arg || 'daily');
    return;
  }
  await sendTelegramRequest(botToken, {
    chat_id: chatId,
    text: 'Unknown command. Try /alerts, /lowstock, /ops, /workers, /report <period>, or /link <code>.',
  });
};

module.exports = {
  sendNotificationMessage,
  sendOtpCode,
  handleUpdate,
  resolveChannelConfig,
};
const handleOpsCommand = async (chatId, botToken) => {
  const summary = await models.Notification.findOne({
    where: { type: 'ops_summary' },
    order: [['createdAt', 'DESC']],
  });
  if (!summary) {
    await sendTelegramRequest(botToken, {
      chat_id: chatId,
      text: 'No operations summary yet. Use /alerts or check again later.',
    });
    return;
  }
  const meta = summary.meta || {};
  const text = [
    `📊 Ops summary (${summary.meta?.period || 'daily'})`,
    `Sales: ETB ${(summary.meta?.metrics?.sales?.total || 0).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })}`,
    `Purchases: ETB ${(summary.meta?.metrics?.purchases?.total || 0).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })}`,
    `Workers: ${meta.workers?.length || 0}`,
    `Low stock: ${meta.lowStock?.length || 0}`,
  ].join('\n');
  await sendTelegramRequest(botToken, {
    chat_id: chatId,
    text,
  });
};
