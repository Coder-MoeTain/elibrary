const { body, param } = require('express-validator');
const { idParam } = require('./common.validation');

const borrow = [
  body('bookId').isInt({ min: 1 }),
  body('usersId').optional({ nullable: true }).isInt({ min: 1 }),
  body('rentDate').optional({ nullable: true }).isISO8601().toDate(),
  body('dueDate').optional({ nullable: true }).isISO8601().toDate(),
];

const returnBook = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
];

const update = [
  ...idParam,
  body('rentDate').optional({ nullable: true }).isISO8601().toDate(),
  body('dueDate').optional({ nullable: true }).isISO8601().toDate(),
  body('returnDate').optional({ nullable: true }).isISO8601().toDate(),
  body('bookId').optional().isInt({ min: 1 }),
  body('usersId').optional().isInt({ min: 1 }),
];

module.exports = { borrow, returnBook, update, idParam };
