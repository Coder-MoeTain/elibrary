const { QueryTypes } = require('sequelize');
const { Category, Book, EBook, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { categoryKey } = require('../utils/categoryKey');
const { HTTP_STATUS, MESSAGES } = require('../constants');

const CONTENT_TYPE_EBOOK = 'ebook';
const CONTENT_TYPE_PAPER = 'paper';

function trimName(name) {
  return String(name || '').trim();
}

async function findByNormalizedKey(key, transaction) {
  if (!key) return null;
  const rows = await Category.findAll({
    attributes: ['categoryId', 'categoryName'],
    transaction,
  });
  return rows.find((row) => categoryKey(row.categoryName) === key) || null;
}

/**
 * Resolve category id from name (normalized match) or create.
 * Shared by books / ebooks / category create.
 */
async function resolveOrCreate(categoryName, transaction) {
  const name = trimName(categoryName);
  if (!name) return 0;
  const key = categoryKey(name);
  const existing = await findByNormalizedKey(key, transaction);
  if (existing) return existing.categoryId;
  const created = await Category.create({ categoryName: name }, { transaction });
  return created.categoryId;
}

async function create(data) {
  const name = trimName(data.categoryName ?? data.category_name);
  if (!name) {
    throw new AppError('Category name is required', HTTP_STATUS.BAD_REQUEST);
  }
  const key = categoryKey(name);
  const existing = await findByNormalizedKey(key);
  if (existing) {
    throw new AppError(
      `A similar category already exists: "${existing.categoryName}"`,
      HTTP_STATUS.CONFLICT,
      null,
      { existingId: existing.categoryId, existingName: existing.categoryName }
    );
  }
  return Category.create({ categoryName: name });
}

async function findAll() {
  return Category.findAll({ order: [['categoryName', 'ASC'], ['categoryId', 'ASC']] });
}

/**
 * Categories with separate counts for Books, catalog e-Books, and Research Papers.
 */
async function findAllWithCounts() {
  const rows = await sequelize.query(
    `
    SELECT
      c.category_id AS categoryId,
      c.category_name AS categoryName,
      COUNT(DISTINCT b.book_id) AS bookCount,
      COUNT(DISTINCT CASE
        WHEN e.eBooks_id IS NOT NULL AND e.content_type = :ebookType
        THEN e.eBooks_id
      END) AS ebookCount,
      COUNT(DISTINCT CASE
        WHEN e.eBooks_id IS NOT NULL AND e.content_type = :paperType
        THEN e.eBooks_id
      END) AS paperCount
    FROM category c
    LEFT JOIN books b ON b.Category_category_id = c.category_id
    LEFT JOIN ebooks e ON e.Category_category_id = c.category_id
    GROUP BY c.category_id, c.category_name
    ORDER BY c.category_name ASC, c.category_id ASC
    `,
    {
      replacements: { ebookType: CONTENT_TYPE_EBOOK, paperType: CONTENT_TYPE_PAPER },
      type: QueryTypes.SELECT,
    }
  );

  return rows.map((r) => ({
    categoryId: Number(r.categoryId),
    categoryName: r.categoryName || '',
    bookCount: Number(r.bookCount) || 0,
    ebookCount: Number(r.ebookCount) || 0,
    paperCount: Number(r.paperCount) || 0,
  }));
}

async function findById(id) {
  const row = await Category.findByPk(id);
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  return row;
}

async function update(id, data) {
  const row = await findById(id);
  const name = trimName(data.categoryName ?? data.category_name);
  if (!name) {
    throw new AppError('Category name is required', HTTP_STATUS.BAD_REQUEST);
  }
  const key = categoryKey(name);
  const clash = await findByNormalizedKey(key);
  if (clash && Number(clash.categoryId) !== Number(id)) {
    throw new AppError(
      `A similar category already exists: "${clash.categoryName}"`,
      HTTP_STATUS.CONFLICT,
      null,
      { existingId: clash.categoryId, existingName: clash.categoryName }
    );
  }
  await row.update({ categoryName: name });
  return row;
}

async function remove(id) {
  const row = await findById(id);
  const [bookCount, ebookCount] = await Promise.all([
    Book.count({ where: { Category_category_id: id } }),
    EBook.count({ where: { Category_category_id: id } }),
  ]);
  if (bookCount > 0 || ebookCount > 0) {
    throw new AppError(
      `Cannot delete: category is used by ${bookCount} book(s) and ${ebookCount} e-book/paper(s). Merge into another category first.`,
      HTTP_STATUS.CONFLICT
    );
  }
  await row.destroy();
  return true;
}

/**
 * Reassign books/ebooks from source categories onto target, then delete sources.
 */
async function merge({ targetId, sourceIds }) {
  const target = Number(targetId);
  const sources = [...new Set((sourceIds || []).map(Number).filter((id) => id && id !== target))];

  if (!target) {
    throw new AppError('Target category is required', HTTP_STATUS.BAD_REQUEST);
  }
  if (!sources.length) {
    throw new AppError('Select at least one category to merge', HTTP_STATUS.BAD_REQUEST);
  }

  return sequelize.transaction(async (transaction) => {
    const targetRow = await Category.findByPk(target, { transaction });
    if (!targetRow) throw new AppError('Target category not found', HTTP_STATUS.NOT_FOUND);

    const sourceRows = await Category.findAll({
      where: { categoryId: sources },
      transaction,
    });
    if (sourceRows.length !== sources.length) {
      throw new AppError('One or more source categories were not found', HTTP_STATUS.NOT_FOUND);
    }

    const [booksMoved] = await Book.update(
      { Category_category_id: target },
      { where: { Category_category_id: sources }, transaction }
    );
    const [ebooksMoved] = await EBook.update(
      { Category_category_id: target },
      { where: { Category_category_id: sources }, transaction }
    );

    await Category.destroy({ where: { categoryId: sources }, transaction });

    return {
      targetId: target,
      targetName: targetRow.categoryName,
      mergedIds: sources,
      booksMoved: Number(booksMoved) || 0,
      ebooksMoved: Number(ebooksMoved) || 0,
    };
  });
}

module.exports = {
  create,
  findAll,
  findAllWithCounts,
  findById,
  update,
  remove,
  merge,
  resolveOrCreate,
  categoryKey,
};
