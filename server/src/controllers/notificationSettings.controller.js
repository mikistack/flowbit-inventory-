const asyncHandler = require('../utils/asyncHandler');
const notificationSettingsService = require('../services/notificationSettings.service');
const hasPermission = require('../middlewares/permissions');

module.exports = {
  get: [
    hasPermission('settings.manage'),
    asyncHandler(async (req, res) => {
      const settings = await notificationSettingsService.getSettings();
      res.json(settings);
    }),
  ],
  update: [
    hasPermission('settings.manage'),
    asyncHandler(async (req, res) => {
      const settings = await notificationSettingsService.updateSettings(req.body || {});
      res.json(settings);
    }),
  ],
};
