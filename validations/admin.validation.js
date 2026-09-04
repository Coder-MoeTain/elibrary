const { body } = require('express-validator');
const { idParam } = require('./common.validation');

const create = [
  body('adminName').trim().notEmpty().isLength({ max: 255 }),
  body('password').notEmpty().isLength({ min: 8, max: 128 }),
  body('role').optional().isIn(['SUPER_ADMIN', 'ADMIN']),
];

const update = [
  ...idParam,
  body('adminName').optional().trim().notEmpty().isLength({ max: 255 }),
  body('password').optional().isLength({ min: 8, max: 128 }),
  body('role').optional().isIn(['SUPER_ADMIN', 'ADMIN']),
];

module.exports = { idParam, create, update };
