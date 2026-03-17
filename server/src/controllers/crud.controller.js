const asyncHandler = require('../utils/asyncHandler');

const createCrudController = (service) => ({
  list: asyncHandler(async (req, res) => {
    const result = await service.list(req.query);
    res.json(result);
  }),
  get: asyncHandler(async (req, res) => {
    const item = await service.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Not found' });
    }
    return res.json(item);
  }),
  create: asyncHandler(async (req, res) => {
    const item = await service.create(req.body);
    res.status(201).json(item);
  }),
  update: asyncHandler(async (req, res) => {
    const item = await service.update(req.params.id, req.body);
    res.json(item);
  }),
  remove: asyncHandler(async (req, res) => {
    await service.remove(req.params.id);
    res.status(204).send();
  }),
});

module.exports = createCrudController;
