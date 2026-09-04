const { body } = require('express-validator');
const { idParam } = require('./common.validation');

const create = [
  body('userName').trim().notEmpty().isLength({ max: 255 }),
  body('password').notEmpty().isLength({ min: 6, max: 128 }),
  body('dateOfBirth').optional({ nullable: true }).isISO8601().toDate(),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().isLength({ max: 255 }),
  body('departmentId').isInt({ min: 1 }),
];

const update = [
  ...idParam,
  body('userName').optional().trim().notEmpty().isLength({ max: 255 }),
  body('password').optional().isLength({ min: 6, max: 128 }),
  body('dateOfBirth').optional({ nullable: true }).isISO8601().toDate(),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().isLength({ max: 255 }),
  body('departmentId').optional().isInt({ min: 1 }),
];

/** Member self-service: PUT /api/users/me */
const updateMe = [
  body('userName').trim().notEmpty().isLength({ max: 255 }),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().isLength({ max: 255 }),
  body('dateOfBirth').optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body('departmentId').isInt({ min: 1 }),
];

const changeMyPassword = [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6, max: 128 }),
];

module.exports = { idParam, create, update, updateMe, changeMyPassword };
