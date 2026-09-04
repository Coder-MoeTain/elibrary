const { body } = require('express-validator');
const { idParam } = require('./common.validation');

const create = [
  body('authorName').trim().notEmpty().isLength({ max: 255 }),
  body('country').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 100 }),
];

const update = [
  ...idParam,
  body('authorName').optional().trim().notEmpty().isLength({ max: 255 }),
  body('country').optional({ nullable: true }).trim().isLength({ max: 100 }),
];

module.exports = { idParam, create, update };
