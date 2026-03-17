const asyncHandler = require('../utils/asyncHandler');
const services = require('../services');
const { models } = require('../models');

const includeConfig = [{ model: models.Permission, as: 'permissions' }];
const PROTECTED_ROLES = ['Admin'];

const loadRole = async (id) =>
  models.Role.findByPk(id, {
    include: includeConfig,
  });

const isProtectedRole = (role) => PROTECTED_ROLES.includes(role.name);

const syncPermissions = async (role, permissionKeys = []) => {
  if (!Array.isArray(permissionKeys)) {
    await role.setPermissions([]);
    return;
  }
  const permissions = await models.Permission.findAll({
    where: { key: permissionKeys },
  });
  await role.setPermissions(permissions);
};

module.exports = {
  list: asyncHandler(async (req, res) => {
    const result = await services.roles.list(req.query);
    res.json(result);
  }),
  get: asyncHandler(async (req, res) => {
    const role = await loadRole(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    return res.json(role);
  }),
  create: asyncHandler(async (req, res) => {
    const { name, description, permissions } = req.body || {};
    if (!name) {
      return res.status(422).json({ message: 'Role name is required' });
    }
    if (PROTECTED_ROLES.includes(name)) {
      return res.status(400).json({ message: 'Reserved system role name.' });
    }
    const role = await models.Role.create({ name, description });
    await syncPermissions(role, permissions);
    const payload = await loadRole(role.id);
    res.status(201).json(payload);
  }),
  update: asyncHandler(async (req, res) => {
    const { name, description, permissions } = req.body || {};
    const role = await loadRole(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    if (isProtectedRole(role) && name && name !== role.name) {
      return res.status(400).json({ message: 'System role names cannot be changed.' });
    }
    await role.update({ name: name ?? role.name, description });
    if (permissions !== undefined) {
      if (isProtectedRole(role)) {
        return res.status(400).json({ message: 'System role permissions cannot be modified.' });
      }
      await syncPermissions(role, permissions);
    }
    const payload = await loadRole(role.id);
    res.json(payload);
  }),
  remove: asyncHandler(async (req, res) => {
    const role = await loadRole(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    if (isProtectedRole(role)) {
      return res.status(400).json({ message: 'System roles cannot be deleted.' });
    }
    await role.setPermissions([]);
    await role.destroy();
    res.status(204).send();
  }),
};
