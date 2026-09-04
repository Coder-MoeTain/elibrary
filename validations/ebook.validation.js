const { body, query } = require('express-validator');
const { idParam } = require('./common.validation');

const create = [
  body().custom((payload, { req }) => {
    const data = req.body ?? payload ?? {};
    const ebookName = data.eBookName || data.ebookName || data.ebook_name;
    const authorId = Number(data.authorId || data.author_id);
    const categoryId = Number(data.categoryId || data.category_id);
    const authorName = String(data.authorName || data.author_name || '').trim();
    const categoryName = String(data.categoryName || data.category_name || '').trim();

    if (!ebookName || !String(ebookName).trim()) {
      throw new Error('ebook_name is required');
    }
    if ((!Number.isInteger(authorId) || authorId < 1) && !authorName) {
      throw new Error('author_id or author_name is required');
    }
    if ((!Number.isInteger(categoryId) || categoryId < 1) && !categoryName) {
      throw new Error('category_id or category_name is required');
    }
    return true;
  }),
  body('releaseDate').optional({ nullable: true }).isISO8601().toDate(),
  body('release_date').optional({ nullable: true }).isISO8601().toDate(),
  body('description').optional({ nullable: true }).isString(),
];

const update = [
  ...idParam,
  body('eBookName').optional().trim().notEmpty().isLength({ max: 255 }),
  body('releaseDate').optional({ nullable: true }).isISO8601().toDate(),
  body('description').optional({ nullable: true }).isString(),
  body('categoryId').optional().isInt({ min: 1 }),
  body('authorId').optional().isInt({ min: 1 }),
];

/** Optional `lang` for GET /ebooks/:id/summary (e.g. en, my). Optional `cachedOnly` = DB read only (no OpenAI). */
const summarize = [
  ...idParam,
  query('lang').optional().trim().isLength({ max: 20 }).withMessage('lang is too long'),
  query('cachedOnly').optional().trim().isLength({ max: 8 }).withMessage('cachedOnly is too long'),
  query('async').optional().trim().isLength({ max: 8 }).withMessage('async is too long'),
];

module.exports = { idParam, create, update, summarize };
