const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { models } = require('../models');

module.exports = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, env.auth.jwtSecret);
    if (payload.sid) {
      const session = await models.UserSession.findByPk(payload.sid);
      if (!session || session.revokedAt) {
        return res.status(401).json({ message: 'Session expired' });
      }
      await session.update({ lastActivity: new Date() });
      req.session = session;
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
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Authentication failed' });
  }
};
