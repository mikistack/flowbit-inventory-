const fs = require('fs');
const path = require('path');
const app = require('./app');
const { sequelize } = require('./models');
const bootstrap = require('./db/bootstrap');
const env = require('./config/env');
const logger = require('./utils/logger');
const { startNotificationJobs } = require('./jobs/notificationJobs');

const ensureStorage = () => {
  if (!fs.existsSync(env.storage.uploadDir)) {
    fs.mkdirSync(env.storage.uploadDir, { recursive: true });
  }
  if (!fs.existsSync(env.storage.reportsDir)) {
    fs.mkdirSync(env.storage.reportsDir, { recursive: true });
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const applyPatches = async () => {
  await sequelize.query(
    'ALTER TABLE IF EXISTS "warehouses" ADD COLUMN IF NOT EXISTS "type" VARCHAR(20) NOT NULL DEFAULT \'store\'',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "user_sessions" ADD COLUMN IF NOT EXISTS "refresh_token_hash" VARCHAR(255)',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS "telegram_chat_id" VARCHAR(100)',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS "telegram_username" VARCHAR(100)',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS "telegram_otp_enabled" BOOLEAN DEFAULT false',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS "telegram_link_code" VARCHAR(50)',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS "warehouse_id" INTEGER REFERENCES "warehouses" ("id")',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS "mfa_secret" VARCHAR(255)',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "products" ADD COLUMN IF NOT EXISTS "barcode_format" VARCHAR(20) DEFAULT \'qr\'',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "products" ADD COLUMN IF NOT EXISTS "barcode_image_url" VARCHAR(255)',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "notification_settings" ADD COLUMN IF NOT EXISTS "highAdditionThreshold" INTEGER DEFAULT 100',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "notification_settings" ADD COLUMN IF NOT EXISTS "ops_report_schedule" JSONB',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "returns" ADD COLUMN IF NOT EXISTS "sale_id" INTEGER REFERENCES "sales" ("id") ON UPDATE CASCADE ON DELETE SET NULL',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "returns" ADD COLUMN IF NOT EXISTS "purchase_id" INTEGER REFERENCES "purchases" ("id") ON UPDATE CASCADE ON DELETE SET NULL',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "returns" ADD COLUMN IF NOT EXISTS "source_reference" VARCHAR(255)',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "returns" ADD COLUMN IF NOT EXISTS "source_total" NUMERIC',
  );
  // Backfill common Sequelize default FK column names (e.g. "SupplierId") into underscored columns.
  await sequelize.query(
    `
    DO $do$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'SupplierId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'supplier_id') THEN
        ALTER TABLE "purchases" RENAME COLUMN "SupplierId" TO "supplier_id";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'supplierId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'supplier_id') THEN
        ALTER TABLE "purchases" RENAME COLUMN "supplierId" TO "supplier_id";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'WarehouseId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'warehouse_id') THEN
        ALTER TABLE "purchases" RENAME COLUMN "WarehouseId" TO "warehouse_id";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'warehouseId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'warehouse_id') THEN
        ALTER TABLE "purchases" RENAME COLUMN "warehouseId" TO "warehouse_id";
      END IF;
    END;
    $do$;
  `,
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "purchases" ADD COLUMN IF NOT EXISTS "supplier_id" INTEGER REFERENCES "suppliers" ("id") ON UPDATE CASCADE ON DELETE SET NULL',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "purchases" ADD COLUMN IF NOT EXISTS "warehouse_id" INTEGER REFERENCES "warehouses" ("id") ON UPDATE CASCADE ON DELETE SET NULL',
  );

  await sequelize.query(
    `
    DO $do$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'PurchaseId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'purchase_id') THEN
        ALTER TABLE "purchase_items" RENAME COLUMN "PurchaseId" TO "purchase_id";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'purchaseId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'purchase_id') THEN
        ALTER TABLE "purchase_items" RENAME COLUMN "purchaseId" TO "purchase_id";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'ProductId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'product_id') THEN
        ALTER TABLE "purchase_items" RENAME COLUMN "ProductId" TO "product_id";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'productId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'product_id') THEN
        ALTER TABLE "purchase_items" RENAME COLUMN "productId" TO "product_id";
      END IF;
    END;
    $do$;
  `,
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "purchase_items" ADD COLUMN IF NOT EXISTS "purchase_id" INTEGER REFERENCES "purchases" ("id") ON UPDATE CASCADE ON DELETE CASCADE',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "purchase_items" ADD COLUMN IF NOT EXISTS "product_id" INTEGER REFERENCES "products" ("id") ON UPDATE CASCADE ON DELETE RESTRICT',
  );

  await sequelize.query(
    `
    DO $do$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'CustomerId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'customer_id') THEN
        ALTER TABLE "sales" RENAME COLUMN "CustomerId" TO "customer_id";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'customerId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'customer_id') THEN
        ALTER TABLE "sales" RENAME COLUMN "customerId" TO "customer_id";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'WarehouseId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'warehouse_id') THEN
        ALTER TABLE "sales" RENAME COLUMN "WarehouseId" TO "warehouse_id";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'warehouseId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'warehouse_id') THEN
        ALTER TABLE "sales" RENAME COLUMN "warehouseId" TO "warehouse_id";
      END IF;
    END;
    $do$;
  `,
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "sales" ADD COLUMN IF NOT EXISTS "customer_id" INTEGER REFERENCES "customers" ("id") ON UPDATE CASCADE ON DELETE SET NULL',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "sales" ADD COLUMN IF NOT EXISTS "warehouse_id" INTEGER REFERENCES "warehouses" ("id") ON UPDATE CASCADE ON DELETE SET NULL',
  );

  await sequelize.query(
    `
    DO $do$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'SaleId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'sale_id') THEN
        ALTER TABLE "sale_items" RENAME COLUMN "SaleId" TO "sale_id";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'saleId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'sale_id') THEN
        ALTER TABLE "sale_items" RENAME COLUMN "saleId" TO "sale_id";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'ProductId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'product_id') THEN
        ALTER TABLE "sale_items" RENAME COLUMN "ProductId" TO "product_id";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'productId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'product_id') THEN
        ALTER TABLE "sale_items" RENAME COLUMN "productId" TO "product_id";
      END IF;
    END;
    $do$;
  `,
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "sale_items" ADD COLUMN IF NOT EXISTS "sale_id" INTEGER REFERENCES "sales" ("id") ON UPDATE CASCADE ON DELETE CASCADE',
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "sale_items" ADD COLUMN IF NOT EXISTS "product_id" INTEGER REFERENCES "products" ("id") ON UPDATE CASCADE ON DELETE RESTRICT',
  );

  await sequelize.query(
    `
    DO $do$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'password_resets' AND column_name = 'UserId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'password_resets' AND column_name = 'user_id') THEN
        ALTER TABLE "password_resets" RENAME COLUMN "UserId" TO "user_id";
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'password_resets' AND column_name = 'userId')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'password_resets' AND column_name = 'user_id') THEN
        ALTER TABLE "password_resets" RENAME COLUMN "userId" TO "user_id";
      END IF;
    END;
    $do$;
  `,
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "password_resets" ADD COLUMN IF NOT EXISTS "user_id" INTEGER REFERENCES "users" ("id") ON DELETE CASCADE',
  );
  await sequelize.query(
    `
    DO $do$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'one_time_codes' AND column_name = 'userId'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'one_time_codes' AND column_name = 'user_id'
      ) THEN
        ALTER TABLE "one_time_codes" RENAME COLUMN "userId" TO "user_id";
      END IF;
    END;
    $do$;
  `,
  );
  await sequelize.query(
    'ALTER TABLE IF EXISTS "one_time_codes" ADD COLUMN IF NOT EXISTS "user_id" INTEGER REFERENCES "users" ("id") ON DELETE CASCADE',
  );
};

const initDatabase = async (retries = 10) => {
  let attempt = 0;
  while (attempt < retries) {
    attempt += 1;
    try {
      await sequelize.authenticate();
      await sequelize.sync();
      await applyPatches();
      await bootstrap();
      logger.info('Database connected');
      return true;
    } catch (error) {
      logger.error('Database connection failed', { error: error.message, attempt });
      if (env.nodeEnv !== 'production') {
        // eslint-disable-next-line no-console
        console.error(error);
      }
      if (attempt >= retries) {
        throw error;
      }
      await wait(5000);
    }
  }
  return false;
};

const start = async () => {
  ensureStorage();
  await initDatabase().catch((error) => {
    logger.error('Unable to initialize database', { error: error.message });
    process.exit(1);
  });

  app.listen(env.app.port, () => {
    logger.info(`API listening on port ${env.app.port}`);
  });

  startNotificationJobs();
};

start();
