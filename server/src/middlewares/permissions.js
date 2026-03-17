module.exports = (permissionKey, options = {}) => (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  if (['Admin', 'Super Admin'].includes(req.user.role.name)) {
    return next();
  }

  const required = Array.isArray(permissionKey) ? permissionKey : [permissionKey];
  const mode = options.mode === 'all' ? 'all' : 'any';
  const permissions = req.user.role.permissions || [];
  const matches = (key) =>
    permissions.some((permission) => {
      if (typeof permission === 'string') {
        return permission === key;
      }
      return permission?.key === key;
    });
  const hasPermission = mode === 'all' ? required.every((key) => matches(key)) : required.some((key) => matches(key));

  if (!hasPermission) {
    return res.status(403).json({ message: 'Permission denied' });
  }

  return next();
};
