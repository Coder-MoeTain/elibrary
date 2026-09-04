const { body } = require('express-validator');
const { idParam } = require('./common.validation');

const create = [body('categoryName').trim().notEmpty().isLength({ max: 255 })];

const update = [
  ...idParam,
  body('categoryName').optional().trim().notEmpty().isLength({ max: 255 }),
];

module.exports = { idParam, create, update };
