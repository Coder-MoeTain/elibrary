const { body } = require('express-validator');
const { idParam } = require('./common.validation');

const create = [body('categoryName').trim().notEmpty().isLength({ max: 255 })];

const update = [
  ...idParam,
  body('categoryName').optional().trim().notEmpty().isLength({ max: 255 }),
];

const merge = [
  body('targetId')
    .optional()
    .isInt({ min: 1 })
    .toInt(),
  body('target_id')
    .optional()
    .isInt({ min: 1 })
    .toInt(),
  body('sourceIds')
    .optional()
    .isArray({ min: 1 }),
  body('source_ids')
    .optional()
    .isArray({ min: 1 }),
  body('sourceIds.*').optional().isInt({ min: 1 }).toInt(),
  body('source_ids.*').optional().isInt({ min: 1 }).toInt(),
  body().custom((value) => {
    const target = value.targetId ?? value.target_id;
    const sources = value.sourceIds ?? value.source_ids;
    if (!target) throw new Error('targetId is required');
    if (!Array.isArray(sources) || sources.length < 1) {
      throw new Error('sourceIds must be a non-empty array');
    }
    return true;
  }),
];

module.exports = { idParam, create, update, merge };
