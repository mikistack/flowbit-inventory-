const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

const numberFromEnv = (value, fallback) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  seedSampleData: process.env.SEED_SAMPLE_DATA === 'true',
  app: {
    port: numberFromEnv(process.env.PORT, 4000),
    timezone: process.env.APP_TZ || 'Africa/Addis_Ababa',
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: numberFromEnv(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME || 'inventory_db',
    username: process.env.DB_USER || 'inventory_user',
    password: process.env.DB_PASSWORD || 'change-me',
    logging: process.env.DB_LOGGING === 'true',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-too',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  },
  admin: {
    defaultPassword: process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@123',
    forcePasswordReset: process.env.ADMIN_FORCE_PASSWORD_RESET !== 'false',
  },
  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    uploadDir: process.env.UPLOAD_DIR || path.join(process.cwd(), 'storage', 'uploads'),
    reportsDir: process.env.REPORT_DIR || path.join(process.cwd(), 'storage', 'reports'),
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: numberFromEnv(process.env.SMTP_PORT, 587),
    username: process.env.SMTP_USERNAME,
    password: process.env.SMTP_PASSWORD,
    encryption: process.env.SMTP_ENCRYPTION || 'starttls',
  },
  twilio: {
    sid: process.env.TWILIO_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_FROM,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    defaultChatId: process.env.TELEGRAM_CHAT_ID,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  },
};
