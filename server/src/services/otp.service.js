const bcrypt = require('bcrypt');
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { models } = require('../models');

const OTP_TTL_MINUTES = 5;

const clearExisting = async (userId, purpose) => {
  await models.OneTimeCode.destroy({ where: { userId, purpose, consumedAt: { [Op.is]: null } } });
};

const issue = async (userId, purpose = 'login') => {
  if (!userId) {
    throw new Error('userId is required for OTP issuance');
  }
  await clearExisting(userId, purpose);
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = dayjs().add(OTP_TTL_MINUTES, 'minute').toDate();
  await models.OneTimeCode.create({ userId, purpose, codeHash, expiresAt });
  return code;
};

const verify = async (userId, code, purpose = 'login') => {
  if (!userId || !code) return false;
  const record = await models.OneTimeCode.findOne({
    where: { userId, purpose },
    order: [['createdAt', 'DESC']],
  });
  if (!record) return false;
  if (record.consumedAt) return false;
  if (record.expiresAt && record.expiresAt < new Date()) {
    await record.destroy();
    return false;
  }
  const match = await bcrypt.compare(code, record.codeHash);
  if (!match) return false;
  await record.update({ consumedAt: new Date() });
  return true;
};

module.exports = {
  issue,
  verify,
};
