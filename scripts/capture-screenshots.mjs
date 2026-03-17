import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'http://127.0.0.1:8080';
const OUTPUT_DIR = process.env.SCREENSHOT_OUTPUT_DIR
  ? path.resolve(process.env.SCREENSHOT_OUTPUT_DIR)
  : path.resolve(process.cwd(), 'docs', 'screenshots');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const shotPath = (name) => path.join(OUTPUT_DIR, `${name}.png`);

const gotoAndSettle = async (page, url, expectedText) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (expectedText) {
    await page.getByText(expectedText, { exact: false }).first().waitFor({ timeout: 30_000 });
  }
  await page.waitForTimeout(800);
};

const main = async () => {
  ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Login
  await gotoAndSettle(page, `${BASE_URL}/login`, 'Welcome back');
  await page.screenshot({ path: shotPath('login'), fullPage: true });

  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('Admin@123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByText('Inventory Dashboard', { exact: false }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: shotPath('dashboard'), fullPage: true });

  // Modules
  await gotoAndSettle(page, `${BASE_URL}/products`, 'Products');
  await page.screenshot({ path: shotPath('products'), fullPage: true });

  await gotoAndSettle(page, `${BASE_URL}/purchases`, 'Purchases');
  await page.screenshot({ path: shotPath('purchases'), fullPage: true });

  await gotoAndSettle(page, `${BASE_URL}/sales`, 'Sales');
  await page.screenshot({ path: shotPath('sales'), fullPage: true });

  await gotoAndSettle(page, `${BASE_URL}/reports/profit-loss`, 'Profit & Loss');
  await page.screenshot({ path: shotPath('reports'), fullPage: true });

  await gotoAndSettle(page, `${BASE_URL}/settings/system`, 'System Settings');
  await page.screenshot({ path: shotPath('settings'), fullPage: true });

  // Telegram section: scroll so the webhook hint is visible in a focused screenshot.
  const telegramToggle = page.getByText('Telegram bot', { exact: false });
  await telegramToggle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: shotPath('telegram-settings'), fullPage: false });

  await browser.close();
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});

