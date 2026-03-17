const { Sequelize } = require('sequelize');
const env = require('./env');

const sequelize = new Sequelize(env.db.database, env.db.username, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'postgres',
  logging: env.db.logging ? console.log : false,
  timezone: env.app.timezone,
  define: {
    underscored: true,
    paranoid: true,
  },
  pool: {
    min: 0,
    max: 10,
    idle: 10000,
  },
});

module.exports = sequelize;
