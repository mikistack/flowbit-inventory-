const express = require('express');

const toArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const buildCrudRoutes = (controller, options = []) => {
  const router = express.Router();
  let middlewares = [];
  let permissions = {};
  if (Array.isArray(options)) {
    middlewares = options;
  } else if (options && typeof options === 'object') {
    middlewares = options.middlewares || [];
    permissions = options.permissions || {};
  }
  if (middlewares.length) router.use(...middlewares);

  const guard = (key) => toArray(permissions[key]);

  router.get('/', ...guard('list'), controller.list);
  router.post('/', ...guard('create'), controller.create);
  router.get('/:id', ...guard('get'), controller.get);
  router.put('/:id', ...guard('update'), controller.update);
  router.delete('/:id', ...guard('delete'), controller.remove);

  return router;
};

module.exports = buildCrudRoutes;
