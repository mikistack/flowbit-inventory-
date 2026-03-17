const { models } = require('../models');

const ensureInventoryRecord = async (productId, warehouseId, transaction) => {
  const [record] = await models.InventoryRecord.findOrCreate({
    where: { productId, warehouseId },
    defaults: { productId, warehouseId, quantityOnHand: 0, reorderPoint: 0 },
    transaction,
  });
  return record;
};

const adjustInventory = async (productId, warehouseId, deltaQuantity, transaction) => {
  const record = await ensureInventoryRecord(productId, warehouseId, transaction);
  const newQuantity = Number(record.quantityOnHand || 0) + Number(deltaQuantity || 0);
  if (newQuantity < 0) {
    const error = new Error('Insufficient stock for product');
    error.status = 400;
    throw error;
  }
  await record.update({ quantityOnHand: newQuantity }, { transaction });
  return record;
};

const getInventoryQuantity = async (productId, warehouseId) => {
  const record = await models.InventoryRecord.findOne({
    where: { productId, warehouseId },
  });
  return Number(record?.quantityOnHand || 0);
};

module.exports = {
  ensureInventoryRecord,
  adjustInventory,
  getInventoryQuantity,
};
