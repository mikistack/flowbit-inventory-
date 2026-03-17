const { body, validationResult } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');
const authMiddleware = require('../middlewares/auth');
const rateLimiter = require('../middlewares/rateLimiter');

const loginValidators = [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const refreshValidators = [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
];

const validate = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation error');
    error.status = 422;
    error.details = errors.array();
    throw error;
  }
};

module.exports = {
  loginValidators,
  refreshValidators,
  login: [
    ...loginValidators,
    asyncHandler(async (req, res) => {
      validate(req);
      const context = {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      };
      const result = await authService.login(req.body, context);
      res.json(result);
    }),
  ],
  refresh: [
    ...refreshValidators,
    asyncHandler(async (req, res) => {
      validate(req);
      const result = await authService.refresh(req.body.refreshToken);
      res.json(result);
    }),
  ],
  profile: asyncHandler(async (req, res) => {
    res.json({
      id: req.user.id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      role: req.user.role?.name,
      warehouseId: req.user.warehouseId,
      warehouse: req.user.warehouse?.name,
      telegramConnected: Boolean(req.user.telegramChatId),
      telegramChatId: req.user.telegramChatId,
      permissions: (req.user.role?.permissions || []).map((permission) =>
        typeof permission === 'string' ? permission : permission.key,
      ),
    });
  }),
  logout: [
    authMiddleware,
    asyncHandler(async (req, res) => {
      if (req.session?.id) {
        await authService.logout(req.session.id);
      }
      res.json({ message: 'Logged out' });
    }),
  ],
  requestPasswordReset: [
    rateLimiter({ windowMs: 60 * 1000, max: 3 }),
    asyncHandler(async (req, res) => {
      const { username } = req.body || {};
      if (!username) {
        return res.status(422).json({ message: 'Username is required.' });
      }
      const context = { ip: req.ip, userAgent: req.get('user-agent') };
      await authService.initiatePasswordReset(username, context);
      res.json({ message: 'If the account is linked to Telegram, an OTP has been sent.' });
    }),
  ],
  completePasswordReset: asyncHandler(async (req, res) => {
    const { username, code, password } = req.body || {};
    if (!username || !code || !password) {
      return res
        .status(422)
        .json({ message: 'Username, verification code, and password are required.' });
    }
    await authService.completePasswordReset(username, code, password);
    res.json({ message: 'Password reset successfully.' });
  }),
  changePassword: [
    authMiddleware,
    asyncHandler(async (req, res) => {
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) {
        return res
          .status(422)
          .json({ message: 'Current password and new password are required.' });
      }
      await authService.changePassword(req.user.id, currentPassword, newPassword);
      res.json({ message: 'Password updated successfully.' });
    }),
  ],
};
