const { Parser } = require('json2csv');
const { parse } = require('csv-parse/sync');
const { Readable } = require('stream');
const asyncHandler = require('../utils/asyncHandler');
const { models, sequelize } = require('../models');
const { renderLabel } = require('../utils/pdf');

const buildCsvResponse = (res, filename, data) => {
  const parser = new Parser();
  const csv = parser.parse(data);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
};

module.exports = {
  importProducts: asyncHandler(async (req, res) => {
    const { csv } = req.body;
    if (!csv) {
      return res.status(400).json({ message: 'CSV payload is required.' });
    }
    const records = parse(csv, {
      columns: true,
      skipEmptyLines: true,
      trim: true,
    });
    const created = [];
    for (const record of records) {
      const payload = {
        code: record.code || `SKU-${Date.now()}`,
        name: record.name,
        price: record.price || 0,
        cost: record.cost || 0,
        stockAlert: record.stockAlert || 0,
        barcodeSymbology: record.barcodeSymbology || 'code128',
        taxType: record.taxType || 'exclusive',
      };
      const product = await models.Product.create(payload);
      created.push(product);
    }
    res.json({ count: created.length });
  }),

  exportData: asyncHandler(async (req, res) => {
    const { type } = req.params;
    const map = {
      sales: { model: models.Sale, filename: 'sales.csv' },
      purchases: { model: models.Purchase, filename: 'purchases.csv' },
      customers: { model: models.Customer, filename: 'customers.csv' },
      suppliers: { model: models.Supplier, filename: 'suppliers.csv' },
      products: { model: models.Product, filename: 'products.csv' },
    };
    const target = map[type];
    if (!target) {
      return res.status(400).json({ message: 'Unsupported export type.' });
    }
    const rows = await target.model.findAll();
    buildCsvResponse(res, target.filename, rows.map((row) => row.toJSON()));
  }),

  terminateSessions: asyncHandler(async (req, res) => {
    await models.UserSession.update(
      { revokedAt: new Date() },
      {
        where: {
          revokedAt: null,
        },
      },
    );
    res.json({ message: 'All sessions terminated.' });
  }),

  printLabels: asyncHandler(async (req, res) => {
    const { productId, templateId, quantity = 1 } = req.body;
    if (!productId || !templateId) {
      return res.status(400).json({ message: 'productId and templateId are required.' });
    }
    const [product, template] = await Promise.all([
      models.Product.findByPk(productId),
      models.LabelTemplate.findByPk(templateId),
    ]);
    if (!product || !template) {
      return res.status(404).json({ message: 'Template or product not found.' });
    }
    const filename = `label-${product.code}-${Date.now()}.pdf`;
    const pdfBuffer = await renderLabel({
      product,
      template,
      quantity,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  }),
};
