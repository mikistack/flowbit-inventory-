const path = require('path');
const fs = require('fs/promises');
const asyncHandler = require('../utils/asyncHandler');
const services = require('../services');
const { models } = require('../models');

const BACKUP_DIR = path.join(process.cwd(), 'storage', 'backups');

const ensureBackupDir = async () => {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
};

const collectDataSnapshot = async () => {
  const dataset = {};
  const entries = Object.entries(models).filter(([, model]) => typeof model?.findAll === 'function');
  for (const [name, model] of entries) {
    dataset[name] = await model.findAll({ raw: true });
  }
  return dataset;
};

const buildFilePath = (filename) => path.join(BACKUP_DIR, filename);

const findBackupById = async (id) =>
  models.Backup.findByPk(id, {
    include: [{ model: models.User, as: 'initiatedBy' }],
  });

module.exports = {
  list: asyncHandler(async (req, res) => {
    const result = await services.backups.list(req.query);
    res.json(result);
  }),

  get: asyncHandler(async (req, res) => {
    const backup = await findBackupById(req.params.id);
    if (!backup) {
      return res.status(404).json({ message: 'Backup not found' });
    }
    res.json(backup);
  }),

  create: asyncHandler(async (req, res) => {
    await ensureBackupDir();
    const snapshot = await collectDataSnapshot();
    const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filePath = buildFilePath(filename);
    await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
    const stats = await fs.stat(filePath);
    const record = await models.Backup.create({
      filename,
      size: stats.size,
      status: 'completed',
      initiatedById: req.user.id,
    });
    res.status(201).json(record);
  }),

  remove: asyncHandler(async (req, res) => {
    const backup = await findBackupById(req.params.id);
    if (!backup) {
      return res.status(404).json({ message: 'Backup not found' });
    }
    const filePath = buildFilePath(backup.filename);
    await fs.unlink(filePath).catch(() => {});
    await backup.destroy();
    res.status(204).send();
  }),

  download: asyncHandler(async (req, res) => {
    const backup = await findBackupById(req.params.id);
    if (!backup) {
      return res.status(404).json({ message: 'Backup not found' });
    }
    const filePath = buildFilePath(backup.filename);
    await fs.access(filePath);
    res.download(filePath, backup.filename);
  }),
};
