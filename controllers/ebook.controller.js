const path = require('path');
const ebookService = require('../services/ebook.service');
const asyncHandler = require('../utils/asyncHandler');
const { success, created, noContent, fail } = require('../helpers/response.helper');
const { HTTP_STATUS, ROLES } = require('../constants');

function normalizeMultipartBody(req) {
  const body = req.body ?? {};
  const pdf = req.files?.pdf?.[0]?.filename || null;
  const cover = req.files?.cover?.[0]?.filename || null;
  const authorRaw = body.authorId || body.author_id;
  const categoryRaw = body.categoryId || body.category_id;
  const authorId = authorRaw !== undefined ? Number(authorRaw) : undefined;
  const categoryId = categoryRaw !== undefined ? Number(categoryRaw) : undefined;

  return {
    eBookName: body.eBookName || body.ebookName || body.ebook_name || '',
    authorName: body.authorName || body.author_name || '',
    categoryName: body.categoryName || body.category_name || '',
    authorId: Number.isFinite(authorId) ? authorId : undefined,
    categoryId: Number.isFinite(categoryId) ? categoryId : undefined,
    releaseDate: body.releaseDate ?? body.release_date,
    description: body.description ?? undefined,
    /** Never trust client-supplied paths — uploads only */
    pdfFile: pdf ? `/uploads/eBooks/${pdf}` : undefined,
    coverImage: cover ? `/uploads/covers/${cover}` : undefined,
  };
}

const create = asyncHandler(async (req, res) => {
  const body = normalizeMultipartBody(req);
  if (
    !body.eBookName ||
    (!body.authorId && !String(body.authorName || '').trim()) ||
    (!body.categoryId && !String(body.categoryName || '').trim())
  ) {
    return fail(res, 'Missing required fields', HTTP_STATUS.UNPROCESSABLE);
  }
  const row = await ebookService.create(body);
  return created(res, row);
});

const list = asyncHandler(async (req, res) => {
  const paged = ['1', 'true', 'yes'].includes(String(req.query.paged ?? '').toLowerCase());
  if (paged) {
    const page = Number(req.query.page);
    const limit = Number(req.query.limit);
    const q = req.query.q;
    const category = req.query.category;
    const result = await ebookService.findPage({
      page,
      limit,
      q,
      category,
      imported: req.query.imported,
    });
    return success(res, { data: result.data, meta: result.pagination });
  }
  const rows = await ebookService.findAll({ imported: req.query.imported });
  return success(res, { data: rows });
});

const recommended = asyncHandler(async (req, res) => {
  const rows = await ebookService.findRecommendedForUser(req.user.id);
  return success(res, { data: rows });
});

const mostPopular = asyncHandler(async (req, res) => {
  const rows = await ebookService.getMostPopularEbooks(5);
  return success(res, { data: rows });
});

const newUploads = asyncHandler(async (req, res) => {
  const rows = await ebookService.getNewUploads(5);
  return success(res, { data: rows });
});

const getById = asyncHandler(async (req, res) => {
  const row = await ebookService.findById(req.params.id);
  return success(res, { data: row });
});

const downloadPdf = asyncHandler(async (req, res) => {
  const { abs, fileName, ebookName } = await ebookService.getPdfStreamMeta(req.params.id);
  const safeLabel = String(ebookName || 'ebook')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .slice(0, 80);
  const downloadName = safeLabel ? `${safeLabel}.pdf` : fileName;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${downloadName}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.sendFile(path.resolve(abs));
});

const summarize = asyncHandler(async (req, res) => {
  const lang = req.query.lang;
  const cachedOnly = ['1', 'true', 'yes'].includes(String(req.query.cachedOnly ?? '').toLowerCase());
  const asyncStart = ['1', 'true', 'yes'].includes(String(req.query.async ?? '').toLowerCase());
  const result = await ebookService.getOrGenerateSummary(req.params.id, {
    language: lang,
    cachedOnly,
    asyncStart: asyncStart && !cachedOnly,
  });
  return success(res, { data: result });
});

const trackRead = asyncHandler(async (req, res) => {
  const skipUserRow = req.user.role === ROLES.ADMIN;
  const result = await ebookService.trackRead(req.params.id, req.user.id, { skipUserRow });
  return success(res, {
    data: result,
    message: skipUserRow
      ? 'OK'
      : result.created
        ? 'eBook read tracked'
        : 'eBook already tracked',
  });
});

const update = asyncHandler(async (req, res) => {
  const body = normalizeMultipartBody(req);
  const row = await ebookService.update(req.params.id, body);
  return success(res, { data: row, message: 'Updated' });
});

const remove = asyncHandler(async (req, res) => {
  await ebookService.remove(req.params.id);
  return noContent(res);
});

module.exports = {
  create,
  list,
  recommended,
  mostPopular,
  newUploads,
  getById,
  downloadPdf,
  summarize,
  trackRead,
  update,
  remove,
};
