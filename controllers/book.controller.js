const bookService = require('../services/book.service');
const asyncHandler = require('../utils/asyncHandler');
const { success, created, noContent } = require('../helpers/response.helper');
const { pregenerateCoverThumbs } = require('../utils/coverThumb');

function normalizeMultipartBody(req) {
  const body = req.body ?? {};
  const cover = req.files?.cover?.[0]?.filename || null;

  const authorRaw = body.authorId || body.author_id;
  const categoryRaw = body.categoryId || body.category_id;
  const authorId = authorRaw !== undefined ? Number(authorRaw) : undefined;
  const categoryId = categoryRaw !== undefined ? Number(categoryRaw) : undefined;

  return {
    bookName: body.bookName || body.book_name || '',
    authorName: body.authorName || body.author_name || '',
    categoryName: body.categoryName || body.category_name || '',
    authorId: Number.isFinite(authorId) ? authorId : undefined,
    categoryId: Number.isFinite(categoryId) ? categoryId : undefined,
    releaseDate: body.releaseDate ?? body.release_date,
    description: body.description ?? undefined,
    place: body.place ?? undefined,
    coverImage: cover ? `/uploads/books/covers/${cover}` : undefined,
  };
}

const create = asyncHandler(async (req, res) => {
  const body = normalizeMultipartBody(req);
  const row = await bookService.create(body);
  if (body.coverImage) {
    await pregenerateCoverThumbs(body.coverImage);
  }
  return created(res, row);
});

const list = asyncHandler(async (req, res) => {
  const rows = await bookService.findAll();
  return success(res, { data: rows });
});

const getById = asyncHandler(async (req, res) => {
  const row = await bookService.findById(req.params.id);
  return success(res, { data: row });
});

const availability = asyncHandler(async (req, res) => {
  const data = await bookService.getAvailability(req.params.id);
  return success(res, { data });
});

const update = asyncHandler(async (req, res) => {
  const body = normalizeMultipartBody(req);
  const row = await bookService.update(req.params.id, body);
  if (body.coverImage) {
    await pregenerateCoverThumbs(body.coverImage);
  }
  return success(res, { data: row, message: 'Updated' });
});

const remove = asyncHandler(async (req, res) => {
  await bookService.remove(req.params.id);
  return noContent(res);
});

module.exports = { create, list, getById, availability, update, remove };
