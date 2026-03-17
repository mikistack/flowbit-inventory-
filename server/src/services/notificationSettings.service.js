const { models } = require('../models');
const { Op } = require('sequelize');

const normalize = (record) => {
  const data = record?.toJSON ? record.toJSON() : { ...(record || {}) };
  if (!data.channels || typeof data.channels !== 'object') {
    data.channels = { inApp: true, telegram: { enabled: false, botToken: '', chatId: '' } };
  }
  if (!data.channels.telegram || typeof data.channels.telegram !== 'object') {
    data.channels.telegram = {
      enabled: Boolean(data.channels.telegram),
      botToken: '',
      chatId: '',
    };
  }
  if (!data.csvSchedule || typeof data.csvSchedule !== 'object') {
    data.csvSchedule = { daily: true, weekly: false, monthly: false, hour: 8 };
  }
  if (!data.highAdditionThreshold) {
    data.highAdditionThreshold = 100;
  }
  if (!data.opsReportSchedule || typeof data.opsReportSchedule !== 'object') {
    data.opsReportSchedule = { daily: true, weekly: true, monthly: true, hour: data.csvSchedule?.hour ?? 8 };
  } else if (data.opsReportSchedule.hour === undefined) {
    data.opsReportSchedule.hour = data.csvSchedule?.hour ?? 8;
  }
  return data;
};

const getLatestRecord = async () =>
  models.NotificationSetting.findOne({
    order: [['updatedAt', 'DESC']],
    paranoid: false,
  });

const getSettings = async () => {
  let record = await getLatestRecord();
  if (!record) {
    record = await models.NotificationSetting.create({});
  }
  return normalize(record);
};

const updateSettings = async (payload) => {
  let record = await getLatestRecord();
  if (!record) {
    record = await models.NotificationSetting.create(payload || {});
  } else {
    await record.update(payload || {});
  }
  await models.NotificationSetting.destroy({
    where: { id: { [Op.ne]: record.id } },
    force: true,
  });
  await record.reload();
  return normalize(record);
};

module.exports = {
  getSettings,
  updateSettings,
};
