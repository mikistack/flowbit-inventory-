const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const env = require('./config/env');
const errorHandler = require('./middlewares/errorHandler');
const logger = require('./utils/logger');

const app = express();

const buildCorsOrigin = (value) => {
  if (!value || value === '*') {
    return true;
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      if (!entry.includes('*')) {
        return entry;
      }

      const escaped = entry.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      return new RegExp(`^${escaped}$`);
    });
};

app.use(helmet());
app.use(
  cors({
    origin: buildCorsOrigin(env.app.corsOrigin),
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('tiny'));
app.use('/uploads', express.static(path.join(env.storage.uploadDir)));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timezone: env.app.timezone });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'Inventory Management API',
    status: 'online',
    docs: 'Use /api/* endpoints (e.g., POST /api/auth/login)',
  });
});

app.use('/api', routes);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
});

module.exports = app;
