const express = require('express');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth');
const rateLimiter = require('../middlewares/rateLimiter');

const router = express.Router();

router.post('/login', rateLimiter({ windowMs: 60 * 1000, max: 5 }), authController.login);
router.post('/refresh', authController.refresh);
router.get('/me', authMiddleware, authController.profile);
router.post('/logout', authController.logout);
router.post('/password-reset/request', authController.requestPasswordReset);
router.post('/password-reset/complete', authController.completePasswordReset);
router.post('/change-password', authController.changePassword);

module.exports = router;
