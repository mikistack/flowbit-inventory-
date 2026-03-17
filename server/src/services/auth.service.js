const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { models } = require('../models');
const env = require('../config/env');
const otpService = require('./otp.service');
const telegramService = require('./telegram.service');

const logAuthEvent = async ({ userId, type, status, message, ip, userAgent }) => {
  try {
    if (!models.AuthLog) return;
    await models.AuthLog.create({ userId, type, status, message, ip, userAgent });
  } catch (error) {
    // Logging failures should never block authentication flows
    // eslint-disable-next-line no-console
    console.error('Failed to record auth event', error.message);
  }
};

const createSession = async (userId, context = {}) => {
  return models.UserSession.create({
    userId,
    ip: context.ip || null,
    device: context.userAgent || 'Unknown Device',
    lastActivity: new Date(),
    refreshTokenHash: null,
  });
};

const storeRefreshToken = async (sessionId, token) => {
  if (!sessionId || !token) return;
  const hash = await bcrypt.hash(token, 10);
  await models.UserSession.update({ refreshTokenHash: hash, revokedAt: null }, { where: { id: sessionId } });
};

const revokeSession = async (sessionId) => {
  if (!sessionId) return;
  await models.UserSession.update({ revokedAt: new Date(), refreshTokenHash: null }, { where: { id: sessionId } });
};

const buildTokenPair = (user, sessionId) => {
  const payload = { sub: user.id, role: user.role?.name, branchId: user.warehouseId, sid: sessionId };
  const accessToken = jwt.sign(payload, env.auth.jwtSecret, { expiresIn: env.auth.jwtExpiresIn });
  const refreshToken = jwt.sign(payload, env.auth.refreshSecret, { expiresIn: env.auth.refreshExpiresIn });
  return { accessToken, refreshToken };
};

const maskUser = (user) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role?.name,
  permissions: user.role?.permissions?.map((permission) => permission.key) || [],
  telegramConnected: Boolean(user.telegramChatId),
  telegramChatId: user.telegramChatId || null,
  warehouseId: user.warehouseId,
  warehouseName: user.warehouse?.name || null,
});

const sendPasswordResetCode = async (user, context = {}, purpose = 'password_reset') => {
  if (!user?.telegramChatId) {
    const error = new Error('User does not have a Telegram chat ID configured.');
    error.status = 400;
    throw error;
  }
  const code = await otpService.issue(user.id, purpose);
  const sent = await telegramService.sendOtpCode(user, code);
  if (!sent) {
    const err = new Error('Unable to deliver code via Telegram.');
    err.status = 502;
    throw err;
  }
  await logAuthEvent({
    userId: user.id,
    type: 'password_reset',
    status: 'otp_sent',
    message: `OTP dispatched for ${purpose}.`,
    ip: context.ip,
    userAgent: context.userAgent,
  });
  return true;
};

const verifyOtpCode = async (user, code, purpose = 'password_reset') => {
  if (!user) return false;
  const valid = await otpService.verify(user.id, code, purpose);
  if (!valid) {
    const error = new Error('Invalid or expired OTP code.');
    error.status = 400;
    throw error;
  }
  return true;
};

module.exports = {
  async login({ username, password }, context = {}) {
    const user = await models.User.findOne({
      where: { username },
      include: [
        {
          model: models.Role,
          as: 'role',
          include: [{ model: models.Permission, as: 'permissions' }],
        },
        { model: models.Warehouse, as: 'warehouse' },
      ],
    });

    if (!user) {
      const error = new Error('Invalid credentials');
      error.status = 401;
      throw error;
    }

    const isValid = await bcrypt.compare(password, user.password || '');
    if (!isValid) {
      await logAuthEvent({
        userId: user.id,
        type: 'login_failure',
        status: 'invalid_password',
        message: 'Password mismatch',
        ip: context.ip,
        userAgent: context.userAgent,
      });
      const error = new Error('Invalid credentials');
      error.status = 401;
      throw error;
    }

    const session = await createSession(user.id, context);
    const tokens = buildTokenPair(user, session.id);
    await storeRefreshToken(session.id, tokens.refreshToken);
    await logAuthEvent({
      userId: user.id,
      type: 'login_success',
      status: 'ok',
      message: `Session ${session.id} created`,
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return { user: maskUser(user), sessionId: session.id, ...tokens };
  },

  async refresh(token) {
    try {
      const payload = jwt.verify(token, env.auth.refreshSecret);
      if (!payload.sid) {
        const err = new Error('Session missing');
        err.status = 401;
        throw err;
      }
      const user = await models.User.findByPk(payload.sub, {
        include: [
          {
            model: models.Role,
            as: 'role',
            include: [{ model: models.Permission, as: 'permissions' }],
          },
          { model: models.Warehouse, as: 'warehouse' },
        ],
      });
      if (!user) {
        throw new Error('User not found');
      }
      const session = await models.UserSession.findByPk(payload.sid);
      if (!session || session.revokedAt) {
        const err = new Error('Session expired');
        err.status = 401;
        throw err;
      }
      if (!session.refreshTokenHash) {
        const err = new Error('Session invalid');
        err.status = 401;
        throw err;
      }
      const matches = await bcrypt.compare(token, session.refreshTokenHash);
      if (!matches) {
        await revokeSession(session.id);
        const err = new Error('Refresh token revoked');
        err.status = 401;
        throw err;
      }
      await session.update({ lastActivity: new Date() });
      const tokens = buildTokenPair(user, session.id);
      await storeRefreshToken(session.id, tokens.refreshToken);
      return { user: maskUser(user), ...tokens };
    } catch (error) {
      const err = new Error('Invalid refresh token');
      err.status = 401;
      throw err;
    }
  },

  async logout(sessionId) {
    const session = await models.UserSession.findByPk(sessionId);
    await revokeSession(sessionId);
    await logAuthEvent({
      userId: session?.userId,
      type: 'logout',
      status: 'ok',
      message: `Session ${sessionId} revoked`,
    });
  },

  async initiatePasswordReset(username, context = {}) {
    if (!username) {
      const err = new Error('Username is required.');
      err.status = 422;
      throw err;
    }
    const user = await models.User.findOne({ where: { username } });
    if (!user) {
      return true;
    }
    await sendPasswordResetCode(user, context, 'password_reset');
    return true;
  },

  async completePasswordReset(username, code, newPassword) {
    if (!username || !code || !newPassword) {
      const err = new Error('Username, OTP code, and new password are required.');
      err.status = 422;
      throw err;
    }
    const user = await models.User.findOne({ where: { username } });
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    await verifyOtpCode(user, code, 'password_reset');
    const hash = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hash });
    await models.UserSession.update(
      { revokedAt: new Date(), refreshTokenHash: null },
      { where: { userId: user.id }, paranoid: false },
    );
    await logAuthEvent({
      userId: user.id,
      type: 'password_reset',
      status: 'ok',
      message: 'Password reset via Telegram OTP',
    });
    return true;
  },

  async changePassword(userId, currentPassword, newPassword) {
    const user = await models.User.findByPk(userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    const matches = await bcrypt.compare(currentPassword, user.password || '');
    if (!matches) {
      const err = new Error('Current password is incorrect');
      err.status = 400;
      throw err;
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hash });
    await models.PasswordReset.update({ usedAt: new Date() }, { where: { userId, usedAt: null } });
    await models.UserSession.update({ revokedAt: new Date(), refreshTokenHash: null }, { where: { userId } });
    await logAuthEvent({
      userId,
      type: 'password_reset',
      status: 'ok',
      message: 'Password changed by user',
    });
    return true;
  },
};
