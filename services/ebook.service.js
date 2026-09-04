const { fn, col, Op, literal } = require('sequelize');
const fs = require('fs/promises');
const path = require('path');
const { pathToFileURL } = require('url');
const { getOpenAiClient } = require('./openai.client');
const { EBook, EBookRead, Favorite, Author, Category, sequelize } = require('../models');
const { resolveSafeUploadPath } = require('../utils/uploadPath');

/** Lazy-loaded: pdf-parse/pdfjs can polyfill `window`/`document` in some Node runtimes. */
let pdfParseLib;
function getPdfParseLib() {
  if (!pdfParseLib) {
    pdfParseLib = require('pdf-parse');
  }
  return pdfParseLib;
}
const AppError = require('../utils/AppError');
const { HTTP_STATUS, MESSAGES } = require('../constants');

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

function buildPayload(body, authorId, categoryId) {
  return {
    eBookName: body.eBookName,
    releaseDate: body.releaseDate ?? null,
    description: body.description ?? null,
    coverImage: body.coverImage ?? null,
    pdfFile: body.pdfFile ?? null,
    aiSummary: body.aiSummary ?? null,
    isSummarized: body.isSummarized ?? false,
    summaryStatus: body.summaryStatus ?? 'pending',
    Category_category_id: categoryId,
    Author_Author_id: authorId,
  };
}

function resolvePdfAbsolutePath(pdfPathFromDb) {
  return resolveSafeUploadPath(pdfPathFromDb);
}

async function getPdfStreamMeta(id) {
  const row = await EBook.findByPk(id);
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  const abs = resolvePdfAbsolutePath(row.pdfFile);
  if (!abs) throw new AppError('PDF not available for this e-book', HTTP_STATUS.NOT_FOUND);
  const fileName = path.basename(abs);
  return { abs, fileName, ebookName: row.eBookName || fileName };
}

/** Target summary length ≈10% of estimated source text; clamped for tiny/huge works. */
const PDF_SUMMARY_RATIO = 0.1;
const PDF_SUMMARY_MIN_CHARS = 200;
const PDF_SUMMARY_MAX_CHARS = 15000;
/** Used when the PDF has no extractable text (e.g. scans): rough chars per page for length hints. */
const EST_CHARS_PER_PAGE = 2200;
/** Parse only the first N pages — matches mobile speed and avoids reading 100GB-scale files fully. */
const SUMMARY_MAX_PAGES = 40;
/** Fallback byte cap when URL streaming is unavailable (legacy pdf-parse v1). */
const MAX_PDF_BYTES_FOR_PARSE = 4 * 1024 * 1024;
/** OpenAI file upload path is size-sensitive; cap scanned-PDF payloads. */
const MAX_PDF_BYTES_FOR_OPENAI_UPLOAD = 4 * 1024 * 1024;

const activeSummaryJobs = new Map();
let summaryJobChain = Promise.resolve();

function getSummaryJobKey(ebookId, lang) {
  return `${Number(ebookId)}:${normalizeSummaryLanguage(lang)}`;
}

async function readPdfBytesForSummary(pdfAbsolutePath) {
  const stat = await fs.stat(pdfAbsolutePath);
  const fileSize = Number(stat.size) || 0;
  if (fileSize <= MAX_PDF_BYTES_FOR_PARSE) {
    return {
      buffer: await fs.readFile(pdfAbsolutePath),
      fileSize,
      truncated: false,
    };
  }
  const handle = await fs.open(pdfAbsolutePath, 'r');
  try {
    const buffer = Buffer.alloc(MAX_PDF_BYTES_FOR_PARSE);
    const { bytesRead } = await handle.read(buffer, 0, MAX_PDF_BYTES_FOR_PARSE, 0);
    return {
      buffer: buffer.subarray(0, bytesRead),
      fileSize,
      truncated: true,
    };
  } finally {
    await handle.close();
  }
}

/**
 * Extract PDF text using on-disk streaming (first pages only).
 * Avoids loading entire large PDFs into RAM on cloud hosts with huge libraries.
 */
async function extractPdfTextWithParser(loadOptions, fileSize) {
  const { PDFParse } = getPdfParseLib();
  const parser = new PDFParse(loadOptions);
  try {
    const info = await parser.getInfo();
    const numPages = Number(info?.total) || 0;
    const parsed = await parser.getText({ first: SUMMARY_MAX_PAGES });
    const rawText = String(parsed?.text ?? '').trim();
    return {
      rawText,
      numPages,
      fileSize,
      truncated: numPages > SUMMARY_MAX_PAGES,
      fileBuffer: loadOptions.data ? Buffer.from(loadOptions.data) : null,
    };
  } finally {
    await parser.destroy();
  }
}

async function extractPdfTextForSummary(pdfAbsolutePath) {
  let fileSize = 0;
  try {
    const stat = await fs.stat(pdfAbsolutePath);
    fileSize = Number(stat.size) || 0;
  } catch {
    throw new AppError('PDF file does not exist or is unreadable', HTTP_STATUS.NOT_FOUND);
  }

  const pdfParse = getPdfParseLib();
  if (typeof pdfParse?.PDFParse === 'function') {
    const fileUrl = pathToFileURL(pdfAbsolutePath).href;

    if (fileSize <= MAX_PDF_BYTES_FOR_PARSE) {
      try {
        const buffer = await fs.readFile(pdfAbsolutePath);
        return await extractPdfTextWithParser({ data: buffer }, fileSize);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[summary] buffer parse failed, trying file URL:', err.message);
      }
    }

    try {
      return await extractPdfTextWithParser({ url: fileUrl }, fileSize);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[summary] file URL parse failed, trying buffer excerpt:', err.message);
      const { buffer } = await readPdfBytesForSummary(pdfAbsolutePath);
      return await extractPdfTextWithParser({ data: buffer }, fileSize);
    }
  }

  const { buffer, truncated } = await readPdfBytesForSummary(pdfAbsolutePath);
  let rawText = '';
  let numPages = 0;
  if (typeof pdfParse === 'function') {
    const parsed = await pdfParse(buffer);
    rawText = String(parsed?.text ?? '').trim();
    numPages = Number(parsed?.numpages) || 0;
  } else {
    throw new AppError('Unsupported pdf-parse version in server runtime', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
  return {
    rawText,
    numPages,
    fileSize,
    truncated,
    fileBuffer: buffer,
  };
}

/** Canonical summary locale stored on `ebooks.summary_language` (`en` | `my`). */
function normalizeSummaryLanguage(raw) {
  const s = String(raw ?? 'en').trim().toLowerCase();
  if (['my', 'mm', 'burmese', 'my-mm', 'my_mm'].includes(s)) return 'my';
  return 'en';
}

function trimSummaryText(value) {
  if (value == null) return '';
  return String(value).trim();
}

/**
 * Returns stored summary text for `lang`, or empty string if none.
 * Supports legacy single `ai_summary` + `summary_language` rows before dual columns.
 */
function findExistingSummaryForLanguage(row, lang) {
  const l = normalizeSummaryLanguage(lang);
  const en = trimSummaryText(row.aiSummaryEn);
  const my = trimSummaryText(row.aiSummaryMy);
  const legacy = trimSummaryText(row.aiSummary);
  const slRaw = row.summaryLanguage;
  const sl =
    slRaw != null && String(slRaw).trim() !== '' ? normalizeSummaryLanguage(slRaw) : null;

  if (l === 'my') {
    if (my) return my;
    if (legacy && sl === 'my') return legacy;
    return '';
  }
  if (en) return en;
  if (legacy && sl !== 'my') return legacy;
  return '';
}

/** Unified API shape for web + mobile clients (`summary`, `aiSummary`, snake_case). */
function formatSummaryResponse(result, meta = {}) {
  const text = trimSummaryText(result.aiSummary);
  const hasSummary = text.length > 0;
  const isSummarized = Boolean(result.isSummarized) || hasSummary;
  return {
    eBooksId: result.eBooksId,
    eBooks_id: result.eBooksId,
    ebook_id: result.eBooksId,
    aiSummary: text,
    ai_summary: text,
    summary: text,
    isSummarized,
    is_summarized: isSummarized,
    summaryStatus: result.summaryStatus,
    summary_status: result.summaryStatus,
    summaryLanguage: result.summaryLanguage,
    summary_language: result.summaryLanguage,
    source: result.source,
    ...meta,
  };
}

function ebookSummaryMeta(row) {
  if (!row) return {};
  const j = typeof row.toJSON === 'function' ? row.toJSON() : row;
  return {
    eBook_name: j.eBookName ?? j.ebook_name ?? '',
    author_name: j.author?.authorName ?? j.author_name ?? '',
    category_name: j.category?.categoryName ?? j.category_name ?? '',
    release_date: j.releaseDate ?? j.release_date ?? null,
    pdf_file: j.pdfFile ?? j.pdf_file ?? null,
  };
}

function outputLanguageClause(lang) {
  if (lang === 'my') {
    return (
      ' Output language: Write the entire summary in Myanmar (Burmese) using standard Unicode Myanmar script ' +
      '(Myanmar Unicode range). Use clear, natural modern Burmese. Use Latin letters only when needed for ' +
      'well-known proper nouns or technical terms.'
    );
  }
  return ' Output language: English.';
}

function summarySystemPrompt(lang) {
  if (lang === 'my') {
    return (
      'You summarize eBook PDFs for a library system. Match the requested summary length (about 10% of the work). ' +
      'You must write the summary in Myanmar (Burmese) in Unicode. Return neutral summary content in plain text.'
    );
  }
  return (
    'You summarize eBook PDFs for a library system. Match the requested summary length (about 10% of the work). ' +
    'Follow the requested output language exactly. Return neutral summary content in plain text.'
  );
}

function computeSummaryTargetChars(estimatedSourceChars) {
  const n = Math.max(0, Math.floor(Number(estimatedSourceChars) || 0));
  const ideal = Math.round(n * PDF_SUMMARY_RATIO);
  return Math.min(PDF_SUMMARY_MAX_CHARS, Math.max(PDF_SUMMARY_MIN_CHARS, ideal));
}

function buildSummaryLengthInstruction(estimatedSourceChars, targetChars, extraNotes = '', lang = 'en') {
  const notes = extraNotes ? ` ${extraNotes}` : '';
  const lengthBody =
    lang === 'my'
      ? `The full work is treated as roughly ${estimatedSourceChars} characters of reading material. ` +
        `Write a Myanmar (Burmese) summary whose length is still about 10% of that: aim for approximately ` +
        `${targetChars} Unicode characters of Myanmar script (not counting spaces), within roughly ±20% of that ` +
        `target if needed for clarity.${notes} Focus on main themes, structure, and key takeaways. Plain text only.`
      : `The full work is treated as roughly ${estimatedSourceChars} characters of reading material. ` +
        `Write a summary about 10% of that: aim for approximately ${targetChars} characters ` +
        `(about ${Math.max(1, Math.round(targetChars / 5))} English words), within roughly ±20% of that target if ` +
        `needed for clarity.${notes} Focus on main themes, structure, and key takeaways. Plain text only.`;
  return `${lengthBody}${outputLanguageClause(lang)}`;
}

async function summarizePdfWithOpenAI(pdfAbsolutePath, options = {}) {
  const lang = normalizeSummaryLanguage(options.language);
  const client = getOpenAiClient();
  const { rawText, numPages, fileSize, truncated, fileBuffer } =
    await extractPdfTextForSummary(pdfAbsolutePath);

  // Some PDFs are scanned/image-based and may not yield extractable text.
  // Fall back to sending a small PDF excerpt directly to OpenAI.
  if (!rawText) {
    const estimatedSourceChars =
      numPages > 0
        ? numPages * EST_CHARS_PER_PAGE
        : Math.min(120_000, Math.max(8_000, (fileSize || 0) * 40));
    const targetChars = computeSummaryTargetChars(estimatedSourceChars);
    const scanNotes = [
      numPages > 0
        ? `This PDF has about ${numPages} page(s); length is estimated from page count.`
        : 'Length is estimated from file size because no text could be extracted.',
      truncated ? `Only the first ${SUMMARY_MAX_PAGES} pages of a large PDF were analyzed.` : '',
    ]
      .filter(Boolean)
      .join(' ');
    const lengthInstruction = buildSummaryLengthInstruction(
      estimatedSourceChars,
      targetChars,
      scanNotes,
      lang,
    );
    const uploadSource =
      fileBuffer ??
      (await readPdfBytesForSummary(pdfAbsolutePath)).buffer;
    const uploadBuffer =
      uploadSource.byteLength > MAX_PDF_BYTES_FOR_OPENAI_UPLOAD
        ? uploadSource.subarray(0, MAX_PDF_BYTES_FOR_OPENAI_UPLOAD)
        : uploadSource;
    const base64Pdf = uploadBuffer.toString('base64');
    const fileResponse = await client.responses.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      input: [
        {
          role: 'system',
          content: summarySystemPrompt(lang),
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_file',
              filename: path.basename(pdfAbsolutePath) || 'ebook.pdf',
              file_data: `data:application/pdf;base64,${base64Pdf}`,
            },
            {
              type: 'input_text',
              text: lengthInstruction,
            },
          ],
        },
      ],
    });
    const fileSummary = fileResponse.output_text?.trim();
    if (!fileSummary) {
      throw new AppError('Could not generate summary from PDF content', HTTP_STATUS.BAD_GATEWAY);
    }
    return fileSummary;
  }

  const MAX_CHARS = 50000;
  const fullLen = rawText.length;
  const inputText = rawText.slice(0, MAX_CHARS);
  const targetChars = computeSummaryTargetChars(fullLen);
  const excerptNote = [
    inputText.length < fullLen
      ? `Only the first ${inputText.length} characters of the PDF text are included below; ` +
        'the length target is still based on the full extracted text.'
      : '',
    truncated ? `Only the first ${SUMMARY_MAX_PAGES} pages of a large PDF were parsed.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const lengthInstruction = buildSummaryLengthInstruction(fullLen, targetChars, excerptNote, lang);

  const response = await client.responses.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    input: [
      {
        role: 'system',
        content: summarySystemPrompt(lang),
      },
      {
        role: 'user',
        content: `${lengthInstruction}\n\n${inputText}`,
      },
    ],
  });

  const summary = response.output_text?.trim();
  if (!summary) {
    throw new AppError('OpenAI returned an empty summary', HTTP_STATUS.BAD_GATEWAY);
  }
  return summary;
}

async function resolveAuthorId(body, transaction) {
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
  return authorId;
}

async function resolveCategoryId(body, transaction) {
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
  return categoryId;
}

async function create(body) {
  return sequelize.transaction(async (transaction) => {
    const authorId = await resolveAuthorId(body, transaction);
    const categoryId = await resolveCategoryId(body, transaction);

    if (!authorId || !categoryId) {
      throw new AppError('Author and category are required', HTTP_STATUS.BAD_REQUEST);
    }

    const row = await EBook.create(buildPayload(body, authorId, categoryId), { transaction });
    return EBook.findByPk(row.eBooksId, { include: ['category', 'author'], transaction });
  });
}

async function readCountsByEbookIds(ebookIds) {
  if (!ebookIds.length) return {};
  const rows = await EBookRead.findAll({
    attributes: ['ebookId', [fn('COUNT', col('id')), 'readCount']],
    where: { ebookId: ebookIds },
    group: ['ebookId'],
    raw: true,
  });
  return Object.fromEntries(
    rows.map((r) => [Number(r.ebookId), Number(r.readCount) || 0])
  );
}

async function toRowsWithReadCount(rows) {
  const ids = rows.map((r) => r.eBooksId);
  const counts = await readCountsByEbookIds(ids);
  return rows.map((row) => {
    const j = row.toJSON();
    j.readCount = counts[row.eBooksId] ?? 0;
    return j;
  });
}

/** Order by aggregate read count (ebook_reads); read_count is not a column on eBooks. */
async function getMostPopularEbooks(limit = 5) {
  const popularityExpr = literal(
    '(SELECT COUNT(*) FROM `ebook_reads` AS `er` WHERE `er`.`ebook_id` = `EBook`.`eBooks_id`)'
  );
  const rows = await EBook.findAll({
    limit,
    order: [
      [popularityExpr, 'DESC'],
      [col('EBook.eBooks_id'), 'ASC'],
    ],
    include: ['category', 'author'],
  });
  return toRowsWithReadCount(rows);
}

async function getNewUploads(limit = 5) {
  const rows = await EBook.findAll({
    limit,
    order: [[col('EBook.created_at'), 'DESC']],
    include: ['category', 'author'],
  });
  return toRowsWithReadCount(rows);
}

async function findAll() {
  const rows = await EBook.findAll({
    order: [['eBooksId', 'ASC']],
    include: ['category', 'author'],
  });
  const ids = rows.map((r) => r.eBooksId);
  const counts = await readCountsByEbookIds(ids);
  return rows.map((row) => {
    const j = row.toJSON();
    j.readCount = counts[row.eBooksId] ?? 0;
    return j;
  });
}

async function findPage(options = {}) {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(options.limit) || 12));
  const offset = (page - 1) * limit;
  const q = String(options.q || '').trim().toLowerCase();
  const category = String(options.category || '').trim();

  const where = {};
  if (q) {
    where.eBookName = { [Op.like]: `%${q}%` };
  }

  const categoryInclude =
    category && category !== 'All Categories'
      ? { model: Category, as: 'category', required: true, where: { categoryName: category } }
      : 'category';

  const { rows, count } = await EBook.findAndCountAll({
    where,
    limit,
    offset,
    order: [['eBooksId', 'ASC']],
    include: [categoryInclude, 'author'],
    distinct: true,
    subQuery: false,
  });

  const ids = rows.map((r) => r.eBooksId);
  const counts = await readCountsByEbookIds(ids);
  const data = rows.map((row) => {
    const j = row.toJSON();
    j.readCount = counts[row.eBooksId] ?? 0;
    return j;
  });

  return {
    data,
    pagination: {
      page,
      limit,
      total: Number(count) || 0,
      totalPages: Math.max(1, Math.ceil((Number(count) || 0) / limit)),
    },
  };
}

async function findById(id) {
  const row = await EBook.findByPk(id, { include: ['category', 'author'] });
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  const readCount = await EBookRead.count({ where: { ebookId: row.eBooksId } });
  const j = row.toJSON();
  j.readCount = readCount;
  return j;
}

async function generateAndPersistSummary(parsedEbookId, lang) {
  const row = await EBook.findByPk(parsedEbookId);
  if (!row) {
    throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  const cached = findExistingSummaryForLanguage(row, lang);
  if (cached) {
    return {
      eBooksId: row.eBooksId,
      aiSummary: cached,
      isSummarized: true,
      summaryStatus: row.summaryStatus || 'completed',
      summaryLanguage: lang,
      source: 'database',
    };
  }

  const pdfAbsolutePath = resolvePdfAbsolutePath(row.pdfFile);
  if (!pdfAbsolutePath) {
    throw new AppError('PDF path not found for this eBook', HTTP_STATUS.BAD_REQUEST);
  }

  if (row.summaryStatus === 'failed' || row.summaryStatus === 'processing') {
    await row.update({ summaryStatus: 'pending' });
  }

  await row.update({ summaryStatus: 'processing' });

  try {
    const aiSummary = await summarizePdfWithOpenAI(pdfAbsolutePath, { language: lang });
    const patch = {
      aiSummary,
      isSummarized: true,
      summaryStatus: 'completed',
      summaryLanguage: lang,
    };
    if (lang === 'my') {
      patch.aiSummaryMy = aiSummary;
    } else {
      patch.aiSummaryEn = aiSummary;
    }
    await row.update(patch);
    return {
      eBooksId: row.eBooksId,
      aiSummary,
      isSummarized: true,
      summaryStatus: 'completed',
      summaryLanguage: lang,
      source: 'openai',
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[summary] ebook ${parsedEbookId} (${lang}) failed:`, error);
    await row.update({ summaryStatus: 'failed' });
    if (error instanceof AppError) throw error;
    throw new AppError('Summary generation failed. Please try again later.', HTTP_STATUS.BAD_GATEWAY);
  }
}

function scheduleSummaryJob(parsedEbookId, lang) {
  const key = getSummaryJobKey(parsedEbookId, lang);
  let job = activeSummaryJobs.get(key);
  if (!job) {
    job = new Promise((resolve, reject) => {
      const run = summaryJobChain.then(() => generateAndPersistSummary(parsedEbookId, lang));
      summaryJobChain = run.catch(() => {});
      run.then(resolve).catch(reject);
    }).finally(() => {
      activeSummaryJobs.delete(key);
    });
    activeSummaryJobs.set(key, job);
  }
  return job;
}

function buildProcessingSummaryResult(row, lang) {
  return {
    eBooksId: row.eBooksId,
    aiSummary: '',
    isSummarized: false,
    summaryStatus: 'processing',
    summaryLanguage: lang,
    source: 'processing',
  };
}

async function getOrGenerateSummary(ebookId, options = {}) {
  const parsedEbookId = Number(ebookId);
  if (!Number.isInteger(parsedEbookId) || parsedEbookId < 1) {
    throw new AppError('Invalid eBook id', HTTP_STATUS.BAD_REQUEST);
  }

  const lang = normalizeSummaryLanguage(options.language);
  const row = await EBook.findByPk(parsedEbookId, { include: ['category', 'author'] });
  if (!row) {
    throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  const meta = ebookSummaryMeta(row);
  const cached = findExistingSummaryForLanguage(row, lang);
  if (cached) {
    return formatSummaryResponse(
      {
        eBooksId: row.eBooksId,
        aiSummary: cached,
        isSummarized: true,
        summaryStatus: row.summaryStatus || 'completed',
        summaryLanguage: lang,
        source: 'database',
      },
      meta,
    );
  }

  /** Read-only: do not touch OpenAI or mark processing when nothing is stored for this language. */
  if (options.cachedOnly) {
    return formatSummaryResponse(
      {
        eBooksId: row.eBooksId,
        aiSummary: '',
        isSummarized: false,
        summaryStatus: row.summaryStatus || 'pending',
        summaryLanguage: lang,
        source: 'none',
      },
      meta,
    );
  }

  if (options.asyncStart) {
    scheduleSummaryJob(parsedEbookId, lang);
    return formatSummaryResponse(buildProcessingSummaryResult(row, lang), meta);
  }

  const generated = await scheduleSummaryJob(parsedEbookId, lang);
  return formatSummaryResponse(generated, meta);
}

async function update(id, body) {
  await sequelize.transaction(async (transaction) => {
    const row = await EBook.findByPk(id, { transaction });
    if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

    const categoryName = pickCategoryName(body).trim();
    const authorName = pickAuthorName(body).trim();
    const categoryIdFromBody = Number(pickCategoryId(body)) || 0;
    const authorIdFromBody = Number(pickAuthorId(body)) || 0;

    let categoryId = row.Category_category_id;
    if (categoryName) {
      categoryId = await resolveCategoryId({ categoryName }, transaction);
    } else if (categoryIdFromBody) {
      categoryId = categoryIdFromBody;
    }

    let authorId = row.Author_Author_id;
    if (authorName) {
      authorId = await resolveAuthorId({ authorName }, transaction);
    } else if (authorIdFromBody) {
      authorId = authorIdFromBody;
    }

    await row.update(
      {
        eBookName: body.eBookName ?? row.eBookName,
        releaseDate: body.releaseDate !== undefined ? body.releaseDate : row.releaseDate,
        description: body.description !== undefined ? body.description : row.description,
        coverImage: body.coverImage !== undefined ? body.coverImage : row.coverImage,
        pdfFile: body.pdfFile !== undefined ? body.pdfFile : row.pdfFile,
        Category_category_id: categoryId,
        Author_Author_id: authorId,
      },
      { transaction }
    );
  });
  return findById(id);
}

async function remove(id) {
  const row = await EBook.findByPk(id);
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

  const coverImage = row.coverImage;
  const pdfFile = row.pdfFile;

  await row.destroy();

  for (const filePath of [coverImage, pdfFile]) {
    const abs = resolvePdfAbsolutePath(filePath);
    if (!abs) continue;
    try {
      await fs.unlink(abs);
    } catch {
      // Ignore cleanup failures; DB row is already removed.
    }
  }

  return true;
}

/**
 * Personalized picks from categories the user reads or favorites; excludes already-read/favorited
 * titles when possible; falls back to recent catalog when there is no signal or no matches.
 */
async function findRecommendedForUser(userId) {
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid < 1) {
    throw new AppError('Invalid user id', HTTP_STATUS.BAD_REQUEST);
  }

  const attachReadCounts = async (rows) => {
    const ids = rows.map((r) => r.eBooksId);
    const counts = await readCountsByEbookIds(ids);
    return rows.map((row) => {
      const j = row.toJSON();
      j.readCount = counts[row.eBooksId] ?? 0;
      return j;
    });
  };

  const fallbackRecent = async (limit) => {
    const rows = await EBook.findAll({
      limit,
      order: [[col('EBook.created_at'), 'DESC']],
      include: ['category', 'author'],
    });
    return attachReadCounts(rows);
  };

  const [reads, favs] = await Promise.all([
    EBookRead.findAll({
      where: { userId: uid },
      include: [
        {
          model: EBook,
          as: 'ebook',
          attributes: ['eBooksId', 'Category_category_id'],
          required: true,
        },
      ],
    }),
    Favorite.findAll({
      where: { Users_users_id: uid },
      include: [
        {
          model: EBook,
          as: 'ebook',
          attributes: ['eBooksId', 'Category_category_id'],
          required: true,
        },
      ],
    }),
  ]);

  const categoryIds = new Set();
  const engagedEbookIds = new Set();

  reads.forEach((r) => {
    const ej = r.ebook;
    if (!ej) return;
    engagedEbookIds.add(ej.eBooksId);
    if (ej.Category_category_id) categoryIds.add(ej.Category_category_id);
  });

  favs.forEach((f) => {
    const ej = f.ebook;
    if (!ej) return;
    engagedEbookIds.add(ej.eBooksId);
    if (ej.Category_category_id) categoryIds.add(ej.Category_category_id);
  });

  if (categoryIds.size === 0) {
    return fallbackRecent(8);
  }

  const catArr = Array.from(categoryIds);
  const engagedArr = Array.from(engagedEbookIds);

  const baseWhere = { Category_category_id: { [Op.in]: catArr } };

  let rows = await EBook.findAll({
    where:
      engagedArr.length > 0
        ? { ...baseWhere, eBooksId: { [Op.notIn]: engagedArr } }
        : baseWhere,
    limit: 12,
    order: [[col('EBook.created_at'), 'DESC']],
    include: ['category', 'author'],
  });

  if (rows.length === 0) {
    rows = await EBook.findAll({
      where: baseWhere,
      limit: 12,
      order: [[col('EBook.created_at'), 'DESC']],
      include: ['category', 'author'],
    });
  }

  if (rows.length === 0) {
    return fallbackRecent(8);
  }

  return attachReadCounts(rows);
}

/**
 * @param {{ skipUserRow?: boolean }} [opts] If true (admin preview), do not insert into `ebook_reads`
 * (admin JWT `userId` is `admin_id`, not `users.users_id`, so FK would be wrong or invalid).
 */
async function trackRead(ebookId, userId, opts = {}) {
  const parsedEbookId = Number(ebookId);
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedEbookId) || parsedEbookId < 1) {
    throw new AppError('Invalid eBook id', HTTP_STATUS.BAD_REQUEST);
  }
  await findById(parsedEbookId);
  if (opts.skipUserRow) {
    const readCount = await EBookRead.count({ where: { ebookId: parsedEbookId } });
    return { created: false, readCount };
  }
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    throw new AppError('Invalid user id', HTTP_STATUS.BAD_REQUEST);
  }
  const [, created] = await EBookRead.findOrCreate({
    where: { userId: parsedUserId, ebookId: parsedEbookId },
    defaults: { userId: parsedUserId, ebookId: parsedEbookId },
  });
  const readCount = await EBookRead.count({ where: { ebookId: parsedEbookId } });
  return { created, readCount };
}

module.exports = {
  create,
  findAll,
  findPage,
  findById,
  findRecommendedForUser,
  getMostPopularEbooks,
  getNewUploads,
  getOrGenerateSummary,
  getPdfStreamMeta,
  update,
  remove,
  trackRead,
};
