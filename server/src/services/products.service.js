const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const bwipjs = require('bwip-js');
const BaseService = require('./base.service');
const { models } = require('../models');
const env = require('../config/env');

class ProductsService extends BaseService {
  constructor() {
    super(models.Product, {
      searchable: ['name', 'code'],
      include: [
        { model: models.Category },
        { model: models.Brand },
        { model: models.Unit, as: 'unit' },
        { model: models.ProductImage, as: 'images' },
        { model: models.InventoryRecord, as: 'inventory' },
      ],
    });
  }

  generateCode() {
    return `PRD-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
  }

  async create(payload) {
    const { photoData, ...rest } = payload;
    const nextPayload = { ...rest };
    if (!nextPayload.code) {
      nextPayload.code = this.generateCode();
    }
    if (!nextPayload.barcodeFormat) {
      nextPayload.barcodeFormat = nextPayload.barcodeSymbology === 'code128' ? 'code128' : 'qr';
    }
    const product = await super.create(nextPayload);
    if (photoData) {
      await this.attachImage(product, photoData, true);
    }
    await this.ensureBarcodeAsset(product, true);
    return this.findById(product.id);
  }

  async update(id, payload) {
    const { photoData, ...rest } = payload;
    const nextPayload = { ...rest };
    if (!nextPayload.code) {
      nextPayload.code = this.generateCode();
    }
    const product = await super.update(id, nextPayload);
    if (photoData) {
      await this.attachImage(product, photoData, true);
    }
    if (rest.code || rest.barcodeFormat) {
      await this.ensureBarcodeAsset(product, true);
    }
    return this.findById(product.id);
  }

  async attachImage(product, dataUrl, replaceExisting = false) {
    if (!dataUrl?.startsWith('data:image')) return;
    const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!matches) return;
    const mime = matches[1];
    const base64Content = matches[2];
    const extension = mime.split('/')[1] || 'jpg';
    await fs.mkdir(env.storage.uploadDir, { recursive: true });
    const filename = `product-${product.id}-${Date.now()}.${extension}`;
    const filepath = path.join(env.storage.uploadDir, filename);
    await fs.writeFile(filepath, Buffer.from(base64Content, 'base64'));
    if (replaceExisting) {
      await models.ProductImage.destroy({ where: { productId: product.id } });
    }
    await models.ProductImage.create({ productId: product.id, url: `/uploads/${filename}` });
  }

  async ensureBarcodeAsset(product, force = false) {
    if (!product?.code) return null;
    if (product.barcodeImageUrl && !force) {
      return product.barcodeImageUrl;
    }
    await fs.mkdir(env.storage.uploadDir, { recursive: true });
    const buffer = await bwipjs.toBuffer({
      bcid: product.barcodeFormat === 'code128' ? 'code128' : 'qrcode',
      text: product.code,
      scale: product.barcodeFormat === 'code128' ? 3 : 6,
      includetext: product.barcodeFormat === 'code128',
      textxalign: 'center',
    });
    const filename = `barcode-${product.id}-${Date.now()}.png`;
    const filepath = path.join(env.storage.uploadDir, filename);
    await fs.writeFile(filepath, buffer);
    await product.update({ barcodeImageUrl: `/uploads/${filename}` });
    return `/uploads/${filename}`;
  }

  async lookup(codeOrQuery) {
    if (!codeOrQuery) return null;
    const search = codeOrQuery.trim();
    return this.model.findOne({
      where: { code: search },
      include: this.options.include,
    });
  }

  async list(query = {}) {
    const result = await super.list(query);
    if (Array.isArray(result.data)) {
      result.data = result.data.map((product) => this.appendStock(product));
    }
    return result;
  }

  appendStock(product) {
    if (!product) return product;
    const inventory = product.inventory || [];
    const stock = inventory.reduce((sum, record) => sum + (record.quantityOnHand || 0), 0);
    if (typeof product.setDataValue === 'function') {
      product.setDataValue('stock', stock);
    } else {
      product.stock = stock;
    }
    return product;
  }
}

module.exports = ProductsService;
