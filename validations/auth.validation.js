const { body } = require('express-validator');

const adminLogin = [
  body('adminName').trim().notEmpty().isLength({ max: 255 }),
  body('password').notEmpty().isLength({ max: 128 }),
];

const userLogin = [
  body('userName').trim().notEmpty().isLength({ max: 255 }),
  body('password').notEmpty().isLength({ max: 128 }),
];

const register = [
  body('user_name').trim().notEmpty().isLength({ max: 255 }),
  body('email').trim().isEmail().isLength({ max: 255 }),
  body('password').isLength({ min: 8, max: 128 }),
  body('date_of_birth').notEmpty().isISO8601(),
  body('department_id').isInt({ min: 1 }),
];

module.exports = { adminLogin, userLogin, register };
