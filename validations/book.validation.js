const { body } = require('express-validator');
const { idParam } = require('./common.validation');

const create = [
  body('bookName').optional().trim().notEmpty().isLength({ max: 255 }),
  body('releaseDate').optional({ nullable: true }).isISO8601().toDate(),
  body('description').optional({ nullable: true }).isString(),
  body('place').optional({ nullable: true }).isLength({ max: 100 }),
  body('authorName').optional({ nullable: true }).trim().isLength({ max: 255 }),
  body('categoryName').optional({ nullable: true }).trim().isLength({ max: 255 }),
  body().custom((payload) => {
    const hasBookName =
      (typeof payload.bookName === 'string' && payload.bookName.trim()) ||
      (typeof payload.book_name === 'string' && payload.book_name.trim());
    const hasAuthor =
      Number(payload.authorId) > 0 ||
      Number(payload.author_id) > 0 ||
      (typeof payload.authorName === 'string' && payload.authorName.trim()) ||
      (typeof payload.author_name === 'string' && payload.author_name.trim());
    const hasCategory =
      Number(payload.categoryId) > 0 ||
      Number(payload.category_id) > 0 ||
      (typeof payload.categoryName === 'string' && payload.categoryName.trim()) ||
      (typeof payload.category_name === 'string' && payload.category_name.trim());
    if (!hasBookName || !hasAuthor || !hasCategory) {
      throw new Error('Provide book name, and author_id/author_name and category_id/category_name');
    }
    return true;
  }),
];

const update = [
  ...idParam,
  body('bookName').optional().trim().notEmpty().isLength({ max: 255 }),
  body('releaseDate').optional({ nullable: true }).isISO8601().toDate(),
  body('description').optional({ nullable: true }).isString(),
  body('place').optional({ nullable: true }).isLength({ max: 100 }),
  body('categoryId').optional().isInt({ min: 1 }),
  body('authorId').optional().isInt({ min: 1 }),
];

module.exports = { idParam, create, update };
