const asyncHandler = require('../utils/asyncHandler');
const services = require('../services');
const { models } = require('../models');

const normalize = (value) => (typeof value === 'string' ? value.trim() : '');
const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

module.exports = {
  lookup: asyncHandler(async (req, res) => {
    const { code, query } = req.query || {};
    if (!code && !query) {
      return res.status(400).json({ message: 'Provide a code or query parameter.' });
    }
    const result = await services.products.lookup(code || query);
    if (!result) {
      return res.status(404).json({ message: 'Product not found.' });
    }
    res.json(result);
  }),
  generateCode: asyncHandler(async (_req, res) => {
    const code = services.products.generateCode();
    res.json({ code });
  }),
  importExcel: asyncHandler(async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({ message: 'No items payload received.' });
    }
    const failed = [];
    let imported = 0;

    // Preload brand/category lookups by name to reduce round-trips.
    const cache = {
      brands: new Map(),
      categories: new Map(),
    };

    const ensureBrand = async (name) => {
      const key = name.toLowerCase();
      if (cache.brands.has(key)) return cache.brands.get(key);
      const [record] = await models.Brand.findOrCreate({
        where: { name },
        defaults: { description: null },
      });
      cache.brands.set(key, record);
      return record;
    };

    const ensureCategory = async (name) => {
      const key = name.toLowerCase();
      if (cache.categories.has(key)) return cache.categories.get(key);
      const [record] = await models.Category.findOrCreate({
        where: { name },
        defaults: { code: name.replace(/\s+/g, '-').toUpperCase().slice(0, 32) },
      });
      cache.categories.set(key, record);
      return record;
    };

    // eslint-disable-next-line no-restricted-syntax
    for (const [index, rawItem] of items.entries()) {
      const errors = [];
      const name = normalize(rawItem.name);
      const brandName = normalize(rawItem.brandName);
      const categoryName = normalize(rawItem.categoryName);
      const barcode = normalize(rawItem.barcode);
      const worthValue = parseNumber(rawItem.worth);
      const photoData =
        typeof rawItem.photoData === 'string' && rawItem.photoData.startsWith('data:image')
          ? rawItem.photoData.trim()
          : '';

      if (!name) errors.push('Product name is required.');
      if (!brandName) errors.push('Brand is required.');
      if (!categoryName) errors.push('Category is required.');
      if (worthValue === null) errors.push('Worth must be numeric.');
      if (!barcode) errors.push('Barcode is required.');

      if (barcode) {
        const existing = await models.Product.findOne({ where: { code: barcode }, attributes: ['id'] });
        if (existing) {
          errors.push('Barcode already exists.');
        }
      }

      if (errors.length) {
        failed.push({ index, errors });
        // eslint-disable-next-line no-continue
        continue;
      }

      let brand = null;
      let category = null;
      try {
        brand = await ensureBrand(brandName);
        category = await ensureCategory(categoryName);
      } catch (error) {
        failed.push({ index, errors: ['Failed to prepare brand/category.'] });
        // eslint-disable-next-line no-continue
        continue;
      }

      try {
        const product = await models.Product.create({
          name,
          code: barcode,
          barcodeSymbology: 'code128',
          barcodeFormat: 'code128',
          brandId: brand?.id || null,
          categoryId: category?.id || null,
          cost: worthValue,
          price: worthValue,
        });
        if (photoData) {
          await services.products.attachImage(product, photoData, true);
        }
        await services.products.ensureBarcodeAsset(product, true);
        imported += 1;
      } catch (error) {
        failed.push({ index, errors: [error.message || 'Failed to create product.'] });
      }
    }

    res.json({ imported, failed });
  }),
};
