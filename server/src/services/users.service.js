const bcrypt = require('bcrypt');
const BaseService = require('./base.service');
const { models } = require('../models');

class UsersService extends BaseService {
  constructor() {
    super(models.User, {
      searchable: ['firstName', 'lastName', 'email', 'username'],
      include: [{ model: models.Role, as: 'role' }],
    });
  }

  async create(payload) {
    if (!payload.password) {
      const error = new Error('Password is required');
      error.status = 422;
      throw error;
    }
    const data = { ...payload, password: await bcrypt.hash(payload.password, 10) };
    return super.create(data);
  }

  async update(id, payload) {
    const data = { ...payload };
    if (payload.password) {
      data.password = await bcrypt.hash(payload.password, 10);
    } else {
      delete data.password;
    }
    return super.update(id, data);
  }
}

module.exports = UsersService;
