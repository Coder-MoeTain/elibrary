const { body } = require('express-validator');
const { idParam } = require('./common.validation');

const create = [
  body('departmentName')
    .trim()
    .notEmpty()
    .withMessage('Department name is required')
    .isLength({ max: 255 })
    .withMessage('Department name must be less than or equal to 255 characters'),
];

const update = [
  ...idParam,
  body('departmentName')
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Department name must be between 1 and 255 characters'),
];

module.exports = { idParam, create, update };
