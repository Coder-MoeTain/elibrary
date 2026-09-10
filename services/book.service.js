const { Book, RentList, Author, Category, sequelize } = require('../models');
const fs = require('fs');
const path = require('path');
const AppError = require('../utils/AppError');
const { HTTP_STATUS, MESSAGES } = require('../constants');
const { resolveSafeUploadPath } = require('../utils/uploadPath');
const { deleteCoverThumbsForSource } = require('../utils/coverThumb');

function pickBookName(body) {
  return body.bookName ?? body.book_name;
}

function pickReleaseDate(body) {
  return body.releaseDate ?? body.release_date ?? null;
}

function pickDescription(body) {
  return body.description ?? null;
}

function pickPlace(body) {
  return body.place ?? null;
}

function pickAuthorId(body) {
  return body.authorId ?? body.author_id ?? null;
}

function pickCategoryId(body) {
  return body.categoryId ?? body.category_id ?? null;
}

function pickAuthorName(body) {
  return typeof body.authorName === 'string'
    ? body.authorName
    : typeof body.author_name === 'string'
      ? body.author_name
      : '';
}

function pickCategoryName(body) {
  return typeof body.categoryName === 'string'
    ? body.categoryName
    : typeof body.category_name === 'string'
      ? body.category_name
      : '';
}

function pickCoverImage(body) {
  return body.coverImage ?? body.cover_image ?? null;
}

function resolveUploadPathFromUrl(urlPath) {
  return resolveSafeUploadPath(urlPath);
}

function safeDeleteUpload(urlPath) {
  deleteCoverThumbsForSource(urlPath);
  const abs = resolveUploadPathFromUrl(urlPath);
  if (!abs) return;
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    // Ignore cleanup failures; DB operation should still succeed.
  }
}

function buildPayload(body, authorId, categoryId) {
  return {
    bookName: pickBookName(body),
    releaseDate: pickReleaseDate(body),
    description: pickDescription(body),
    coverImage: pickCoverImage(body),
    place: pickPlace(body),
    Category_category_id: categoryId,
    Author_Author_id: authorId,
  };
}

async function create(body) {
  return sequelize.transaction(async (transaction) => {
    let authorId = Number(pickAuthorId(body)) || 0;
    const authorName = pickAuthorName(body).trim();
    if (!authorId && authorName) {
      const existing = await Author.findOne({ where: { authorName }, transaction });
      if (existing) {
        authorId = existing.authorId;
      } else {
        const created = await Author.create({ authorName }, { transaction });
        authorId = created.authorId;
      }
    }

    let categoryId = Number(pickCategoryId(body)) || 0;
    const categoryName = pickCategoryName(body).trim();
    if (!categoryId && categoryName) {
      const existing = await Category.findOne({ where: { categoryName }, transaction });
      if (existing) {
        categoryId = existing.categoryId;
      } else {
        const created = await Category.create({ categoryName }, { transaction });
        categoryId = created.categoryId;
      }
    }

    if (!authorId || !categoryId) {
      throw new AppError('Author and category are required', HTTP_STATUS.BAD_REQUEST);
    }

    const row = await Book.create(buildPayload(body, authorId, categoryId), { transaction });
    return Book.findByPk(row.bookId, { include: ['category', 'author'], transaction });
  });
}

async function findAll() {
const [books, activeRentals] = await Promise.all([
    Book.findAll({
      order: [['bookId', 'ASC']],
      include: ['category', 'author'],
    }),
    RentList.findAll({
      where: { returnDate: null },
      attributes: ['Books_book_id'],
      raw: true,
    }),
  ]);

  // One query for all active rentals — avoids N+1 /availability calls from clients.
  const rentedIds = new Set(
    activeRentals
      .map((r) => Number(r.Books_book_id))
      .filter((id) => Number.isFinite(id))
  );

  return books.map((book) => {
    const json = typeof book.toJSON === 'function' ? book.toJSON() : book;
    return {
      ...json,
      available: !rentedIds.has(Number(book.bookId)),
    };
  });
}


async function findById(id) {
  const row = await Book.findByPk(id, { include: ['category', 'author'] });
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  return row;
}

async function update(id, body) {
  const row = await Book.findByPk(id);
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  const nextCoverImage = body.coverImage !== undefined ? body.coverImage : row.coverImage;
  const oldCoverImage = row.coverImage;
  await row.update({
    bookName: body.bookName ?? row.bookName,
    releaseDate: body.releaseDate !== undefined ? body.releaseDate : row.releaseDate,
    description: body.description !== undefined ? body.description : row.description,
    coverImage: nextCoverImage,
    place: body.place !== undefined ? body.place : row.place,
    Category_category_id: body.categoryId ?? row.Category_category_id,
    Author_Author_id: body.authorId ?? row.Author_Author_id,
  });
  if (oldCoverImage && nextCoverImage && oldCoverImage !== nextCoverImage) {
    safeDeleteUpload(oldCoverImage);
  }
  return findById(id);
}

async function remove(id) {
  const row = await findById(id);
  const cover = row.coverImage ?? row.cover_image;
  await row.destroy();
  safeDeleteUpload(cover);
  return true;
}

/** Availability from active rental: return_date IS NULL */
async function getAvailability(bookId) {
  await findById(bookId);
  const active = await RentList.findOne({
    where: { Books_book_id: bookId, returnDate: null },
    include: [{ association: 'user', attributes: { exclude: ['password'] } }],
  });
  return {
    bookId: Number(bookId),
    available: !active,
    activeRental: active,
  };
}

module.exports = {
  create,
  findAll,
  findById,
  update,
  remove,
  getAvailability,
};
