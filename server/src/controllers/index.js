const createCrudController = require('./crud.controller');
const services = require('../services');

module.exports = {
  users: createCrudController(services.users),
  roles: require('./roles.controller'),
  permissions: createCrudController(services.permissions),
  warehouses: createCrudController(services.warehouses),
  categories: createCrudController(services.categories),
  brands: createCrudController(services.brands),
  units: createCrudController(services.units),
  currencies: createCrudController(services.currencies),
  products: {
    ...createCrudController(services.products),
    ...require('./products.controller'),
  },
  inventory: createCrudController(services.inventory),
  adjustments: createCrudController(services.adjustments),
  transfers: createCrudController(services.transfers),
  expenses: createCrudController(services.expenses),
  expenseCategories: createCrudController(services.expenseCategories),
  quotations: createCrudController(services.quotations),
  purchases: createCrudController(services.purchases),
  sales: createCrudController(services.sales),
  returns: createCrudController(services.returns),
  customers: createCrudController(services.customers),
  suppliers: createCrudController(services.suppliers),
  notes: createCrudController(services.notes),
  settings: {
    ...createCrudController(services.settings),
    notification: require('../services/notificationSettings.service'),
  },
  backups: require('./backups.controller'),
  sessions: createCrudController(services.sessions),
  payments: createCrudController(services.payments),
  labelTemplates: createCrudController(services.labelTemplates),
  notificationSettings: require('./notificationSettings.controller'),
  notifications: require('./notification.controller'),
};
