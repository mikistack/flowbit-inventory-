const { Op } = require('sequelize');
const { buildPagination, paginateResult } = require('../utils/pagination');

class BaseService {
  constructor(model, options = {}) {
    this.model = model;
    this.searchable = options.searchable || [];
    this.defaultInclude = options.include || [];
    this.defaultOrder = options.order || [['createdAt', 'DESC']];
  }

  async list(query = {}) {
    const { page, limit, offset } = buildPagination(query);
    const where = this.buildFilters(query);

    const { rows, count } = await this.model.findAndCountAll({
      where,
      limit,
      offset,
      include: this.defaultInclude,
      order: this.defaultOrder,
      distinct: Array.isArray(this.defaultInclude) && this.defaultInclude.length > 0,
    });

    return paginateResult(rows, count, { page, limit });
  }

  async findById(id, options = {}) {
    return this.model.findByPk(id, {
      include: this.defaultInclude,
      ...options,
    });
  }

  async create(payload) {
    return this.model.create(payload);
  }

  async update(id, payload) {
    const record = await this.findById(id);
    if (!record) {
      const error = new Error('Record not found');
      error.status = 404;
      throw error;
    }
    return record.update(payload);
  }

  async remove(id) {
    const record = await this.findById(id);
    if (!record) {
      const error = new Error('Record not found');
      error.status = 404;
      throw error;
    }
    await record.destroy();
    return { success: true };
  }

  buildFilters(query) {
    const where = {};
    if (query.search && this.searchable.length) {
      where[Op.or] = this.searchable.map((field) => ({
        [field]: { [Op.iLike]: `%${query.search}%` },
      }));
    }
    Object.entries(query).forEach(([key, value]) => {
      if (['page', 'limit', 'search'].includes(key)) return;
      if (value === undefined || value === null || value === '' || value === 'all') return;
      where[key] = value;
    });
    return where;
  }
}

module.exports = BaseService;
