'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Op } = require('sequelize');
const { EBook, Author, Category, sequelize } = require('../models');
const { pregenerateCoverThumbs } = require('../utils/coverThumb');

const COVER_RENDER_DPI = '120';

const appRoot = path.resolve(__dirname, '..');
const defaultSourceDir = path.resolve(appRoot, '..', 'new_pdf');
const uploadsRoot = path.join(appRoot, 'public', 'uploads');
const ebookUploadDir = path.join(uploadsRoot, 'eBooks');
const coverUploadDir = path.join(uploadsRoot, 'covers');
let pdfPopplerModule = null;

function getPdfPoppler() {
  if (pdfPopplerModule) return pdfPopplerModule;
  pdfPopplerModule = require('pdf-poppler');
  return pdfPopplerModule;
}

function usage() {
  return `
Import PDF files from ../new_pdf into the ebook catalog.

Usage:
  npm run import:pdfs
  npm run import:pdfs -- --fallback-author "Unknown Author" --fallback-category "Imported PDFs"

Options:
  --source <dir>       Folder containing PDF files. Default: ../new_pdf
  --author <name>      Force this author for every imported PDF
  --category <name>    Force this category for every imported PDF
  --fallback-author <name>
                       Author used when extraction fails. Default: Unknown Author
  --fallback-category <name>
                       Category used when extraction fails. Default: Imported PDFs
  --description <text> Description prefix. Default: Imported from PDF file
  --skip-existing      Do not update rows that already exist
  --strict-cover       Stop if a PDF first-page cover cannot be rendered
  --dry-run            Show what would be imported without writing files or DB rows
  --help               Show this help
`;
}

function parseArgs(argv) {
  const opts = {
    source: defaultSourceDir,
    author: '',
    category: '',
    fallbackAuthor: 'Unknown Author',
    fallbackCategory: 'Imported PDFs',
    description: 'Imported from PDF file',
    skipExisting: false,
    strictCover: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--skip-existing') {
      opts.skipExisting = true;
    } else if (arg === '--strict-cover') {
      opts.strictCover = true;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--source') {
      opts.source = path.resolve(argv[++i] || '');
    } else if (arg === '--author') {
      opts.author = argv[++i] || '';
    } else if (arg === '--category') {
      opts.category = argv[++i] || '';
    } else if (arg === '--fallback-author') {
      opts.fallbackAuthor = argv[++i] || opts.fallbackAuthor;
    } else if (arg === '--fallback-category') {
      opts.fallbackCategory = argv[++i] || opts.fallbackCategory;
    } else if (arg === '--description') {
      opts.description = argv[++i] || opts.description;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return opts;
}

function localDateString(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function titleFromPdfName(fileName) {
  const base = path.basename(fileName, path.extname(fileName));
  return toDisplayName(base)
    .replace(/\bAws\b/g, 'AWS')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bApi\b/g, 'API')
    .replace(/\bPdf\b/g, 'PDF')
    .replace(/\bX86\b/g, 'x86');
}

function toDisplayName(value) {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function cleanExtractedText(value) {
  let raw = String(value || '');
  if (raw.charCodeAt(0) === 0xfe && raw.charCodeAt(1) === 0xff) {
    const chars = [];
    for (let i = 2; i < raw.length - 1; i += 2) {
      chars.push(String.fromCharCode((raw.charCodeAt(i) << 8) + raw.charCodeAt(i + 1)));
    }
    raw = chars.join('');
  }

  return raw
    .replace(/\\([\\()nrtbf])/g, (_, escaped) => {
      const map = { n: ' ', r: ' ', t: ' ', b: '', f: '', '\\': '\\', '(': '(', ')': ')' };
      return map[escaped] ?? escaped;
    })
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodePdfHex(hex) {
  const compact = String(hex || '').replace(/\s+/g, '');
  if (!compact || compact.length % 2 !== 0) return '';
  const bytes = compact.match(/.{2}/g).map((pair) => parseInt(pair, 16));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const chars = [];
    for (let i = 2; i < bytes.length - 1; i += 2) {
      chars.push(String.fromCharCode((bytes[i] << 8) + bytes[i + 1]));
    }
    return cleanExtractedText(chars.join(''));
  }
  return cleanExtractedText(Buffer.from(bytes).toString('latin1'));
}

function extractPdfInfoValue(raw, key) {
  const parenMatch = raw.match(new RegExp(`\\/${key}\\s*\\(([^)]{1,500})\\)`, 'i'));
  if (parenMatch) return cleanExtractedText(parenMatch[1]);

  const hexMatch = raw.match(new RegExp(`\\/${key}\\s*<([0-9a-fA-F\\s]{2,1000})>`, 'i'));
  if (hexMatch) return decodePdfHex(hexMatch[1]);

  return '';
}

function stripTags(value) {
  return cleanExtractedText(String(value || '').replace(/<[^>]+>/g, ' '));
}

function extractXmpValue(raw, tagName) {
  const match = raw.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]{1,2000}?)<\\/${tagName}>`, 'i'));
  if (!match) return '';
  const listItem = match[1].match(/<rdf:li[^>]*>([\s\S]{1,500}?)<\/rdf:li>/i);
  return stripTags(listItem ? listItem[1] : match[1]);
}

async function readPdfMetadata(filePath) {
  const stat = await fs.promises.stat(filePath);
  const maxChunk = 1024 * 512;
  const fd = await fs.promises.open(filePath, 'r');
  try {
    const firstLength = Math.min(maxChunk, stat.size);
    const first = Buffer.alloc(firstLength);
    await fd.read(first, 0, firstLength, 0);

    const lastLength = Math.min(maxChunk, stat.size);
    const last = Buffer.alloc(lastLength);
    await fd.read(last, 0, lastLength, Math.max(0, stat.size - lastLength));

    const raw = `${first.toString('latin1')}\n${last.toString('latin1')}`;
    return {
      title: extractXmpValue(raw, 'dc:title') || extractPdfInfoValue(raw, 'Title'),
      author:
        extractXmpValue(raw, 'dc:creator') ||
        extractPdfInfoValue(raw, 'Author') ||
        extractPdfInfoValue(raw, 'Creator'),
      subject: extractXmpValue(raw, 'dc:subject') || extractPdfInfoValue(raw, 'Subject'),
      keywords: extractPdfInfoValue(raw, 'Keywords'),
    };
  } finally {
    await fd.close();
  }
}

function isBadAuthorCandidate(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return true;
  return [
    'unknown',
    'anonymous',
    'admin',
    'calibre',
    'microsoft',
    'adobe',
    'pdf',
    'pdfium',
    'converted',
    'z library',
    'z-library',
  ].some((bad) => v === bad || v.includes(bad));
}

function normalizeAuthor(value) {
  const cleaned = cleanExtractedText(value)
    .replace(/\b(converted|z[- ]?library)\b.*$/i, '')
    .replace(/\b(19|20)\d{2}\b.*$/i, '')
    .replace(/[.,;:-]+$/g, '')
    .trim();
  if (isBadAuthorCandidate(cleaned)) return '';
  return toDisplayName(cleaned);
}

function normalizeFallbackAuthor(value) {
  const cleaned = cleanExtractedText(value).replace(/[.,;:-]+$/g, '').trim();
  return cleaned ? toDisplayName(cleaned) : 'Unknown Author';
}

function inferAuthorFromName(fileName) {
  const base = path.basename(fileName, path.extname(fileName)).replace(/[_-]+/g, ' ');
  const parenthetical = [...base.matchAll(/\(([^)]{3,120})\)/g)]
    .map((match) => normalizeAuthor(match[1]))
    .find(Boolean);
  if (parenthetical) return parenthetical;

  const byDash = base.match(/^(.{3,80}?)\s+-\s+.{3,}$/);
  if (byDash) {
    const author = normalizeAuthor(byDash[1]);
    if (author) return author;
  }

  return '';
}

function isBadTitleCandidate(value) {
  const title = cleanExtractedText(value);
  const lowered = title.toLowerCase();
  if (!title || title.length < 4) return true;
  if (title.length > 180) return true;
  if (/^[a-z]:\\/i.test(title) || title.includes('\\')) return true;
  if (/^(print|untitled|pdf\d*\.tmp|e\d+_\d+)$/i.test(title)) return true;
  if (/^[\W_]+$/.test(title)) return true;
  if (lowered.includes('.dvi') || lowered.includes('.tmp')) return true;
  return false;
}

const CATEGORY_RULES = [
  ['Cybersecurity', /\b(reverse engineering|cracking|security|kali|nethunter|cryptography|ebpf)\b/i],
  ['Computer Science', /\b(computer science|coding theory|algorithm|software|programming|windows|containers|large language model|llm|x window|syntax)\b/i],
  ['Artificial Intelligence', /\b(artificial intelligence|machine learning|deep learning|large language model|llm)\b/i],
  ['Environment', /\b(environment|climate|ecology|scale)\b/i],
  ['Politics', /\b(democracy|russia|china|relations|scandal)\b/i],
  ['Literature', /\b(shakespeare|text|tales|medieval|syntax|circle|heav)\b/i],
  ['Mathematics', /\b(time discretization|formula|formulas|applications)\b/i],
  ['Engineering', /\b(engineering|enterprise solutions|system)\b/i],
];

function inferCategory(parts) {
  const haystack = [parts.title, parts.fileName, parts.subject, parts.keywords].filter(Boolean).join(' ');
  const rule = CATEGORY_RULES.find(([, pattern]) => pattern.test(haystack));
  return rule ? rule[0] : '';
}

async function extractMetadata(filePath, opts) {
  const fileName = path.basename(filePath);
  const pdfMetadata = await readPdfMetadata(filePath).catch(() => ({}));
  const metadataTitle = cleanExtractedText(pdfMetadata.title);
  const title = isBadTitleCandidate(metadataTitle) ? titleFromPdfName(fileName) : metadataTitle;
  const author =
    normalizeAuthor(opts.author) ||
    normalizeAuthor(pdfMetadata.author) ||
    inferAuthorFromName(fileName) ||
    normalizeFallbackAuthor(opts.fallbackAuthor);
  const category =
    cleanExtractedText(opts.category) ||
    inferCategory({
      title,
      fileName,
      subject: pdfMetadata.subject,
      keywords: pdfMetadata.keywords,
    }) ||
    cleanExtractedText(opts.fallbackCategory);

  return { title, author, category };
}

function safeFilePart(value) {
  return value
    .replace(/[^a-z0-9._-]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 140);
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });

    child.on('error', (err) => {
      reject(new Error(`${command} failed to start: ${err.message}`));
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const detail = stderr.trim() ? `: ${stderr.trim()}` : '';
        reject(new Error(`${command} exited with code ${code}${detail}`));
      }
    });
  });
}

async function removeIfExists(filePath) {
  await fs.promises.rm(filePath, { force: true }).catch(() => {});
}

function errorToMessage(err) {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || err.toString();
  if (typeof err.message === 'string') return err.message;
  return String(err);
}

async function renderWithPdftoppm(pdfPath, pngDest) {
  const outputPrefix = pngDest.replace(/\.png$/i, '');
  await runCommand('pdftoppm', ['-f', '1', '-l', '1', '-singlefile', '-png', `-r`, COVER_RENDER_DPI, pdfPath, outputPrefix]);
  await fs.promises.access(pngDest);
  return 'pdftoppm';
}

async function renderWithPdftocairo(pdfPath, pngDest) {
  const outputPrefix = pngDest.replace(/\.png$/i, '');
  await runCommand('pdftocairo', ['-f', '1', '-l', '1', '-singlefile', '-png', `-r`, COVER_RENDER_DPI, pdfPath, outputPrefix]);
  await fs.promises.access(pngDest);
  return 'pdftocairo';
}

async function renderWithMagick(pdfPath, pngDest) {
  await runCommand('magick', [
    '-density',
    COVER_RENDER_DPI,
    `${pdfPath}[0]`,
    '-background',
    'white',
    '-alpha',
    'remove',
    '-alpha',
    'off',
    '-resize',
    '600x840>',
    pngDest,
  ]);
  await fs.promises.access(pngDest);
  return 'magick';
}

async function renderWithGhostscript(command, pdfPath, pngDest) {
  await runCommand(command, [
    '-dSAFER',
    '-dBATCH',
    '-dNOPAUSE',
    '-dFirstPage=1',
    '-dLastPage=1',
    '-sDEVICE=png16m',
    `-r${COVER_RENDER_DPI}`,
    '-dTextAlphaBits=4',
    '-dGraphicsAlphaBits=4',
    `-sOutputFile=${pngDest}`,
    pdfPath,
  ]);
  await fs.promises.access(pngDest);
  return command;
}

async function renderWithMutool(pdfPath, pngDest) {
  await runCommand('mutool', ['draw', '-o', pngDest, '-r', COVER_RENDER_DPI, pdfPath, '1']);
  await fs.promises.access(pngDest);
  return 'mutool';
}

async function renderWithPdfPoppler(pdfPath, pngDest) {
  if (process.platform !== 'win32' && process.platform !== 'darwin') {
    throw new Error('pdf-poppler is only supported on Windows and macOS');
  }
  const pdfPoppler = getPdfPoppler();
  const outDir = path.dirname(pngDest);
  const outPrefix = path.basename(pngDest, '.png');
  await pdfPoppler.convert(pdfPath, {
    format: 'png',
    out_dir: outDir,
    out_prefix: outPrefix,
    page: 1,
    // ~letter width at ~120 DPI; keeps catalog covers smaller for production.
    scale: 1024,
  });
  await fs.promises.access(pngDest);
  return 'pdf-poppler';
}

async function repairWithQpdf(pdfPath, repairedPath) {
  await removeIfExists(repairedPath);
  await runCommand('qpdf', [pdfPath, repairedPath]);
  await fs.promises.access(repairedPath);
  return repairedPath;
}

async function repairWithMutoolClean(pdfPath, repairedPath) {
  await removeIfExists(repairedPath);
  await runCommand('mutool', ['clean', pdfPath, repairedPath]);
  await fs.promises.access(repairedPath);
  return repairedPath;
}

async function renderFirstPageCover(pdfPath, pngDest) {
  const renderers = [];
  if (process.platform === 'win32' || process.platform === 'darwin') {
    renderers.push(['pdf-poppler', () => renderWithPdfPoppler(pdfPath, pngDest)]);
  }
  renderers.push(
    ['pdftoppm', () => renderWithPdftoppm(pdfPath, pngDest)],
    ['pdftocairo', () => renderWithPdftocairo(pdfPath, pngDest)],
    ['mutool', () => renderWithMutool(pdfPath, pngDest)],
    ['magick', () => renderWithMagick(pdfPath, pngDest)],
    ['gswin64c', () => renderWithGhostscript('gswin64c', pdfPath, pngDest)],
    ['gs', () => renderWithGhostscript('gs', pdfPath, pngDest)],
  );
  const failures = [];

  for (const [name, render] of renderers) {
    await removeIfExists(pngDest);
    try {
      return { renderer: await render(), error: '' };
    } catch (err) {
      failures.push(`${name}: ${errorToMessage(err)}`);
      await removeIfExists(pngDest);
    }
  }

  const repairedQpdfPath = pngDest.replace(/\.png$/i, '.qpdf-repaired.pdf');
  const repairedMutoolPath = pngDest.replace(/\.png$/i, '.mutool-repaired.pdf');
  const repairs = [
    ['qpdf repair + pdftoppm', repairedQpdfPath, () => repairWithQpdf(pdfPath, repairedQpdfPath), renderWithPdftoppm],
    [
      'qpdf repair + pdftocairo',
      repairedQpdfPath,
      () => repairWithQpdf(pdfPath, repairedQpdfPath),
      renderWithPdftocairo,
    ],
    [
      'mutool clean + pdftoppm',
      repairedMutoolPath,
      () => repairWithMutoolClean(pdfPath, repairedMutoolPath),
      renderWithPdftoppm,
    ],
    [
      'mutool clean + pdftocairo',
      repairedMutoolPath,
      () => repairWithMutoolClean(pdfPath, repairedMutoolPath),
      renderWithPdftocairo,
    ],
  ];

  for (const [name, repairedPath, repair, render] of repairs) {
    await removeIfExists(pngDest);
    try {
      await repair();
      const renderer = await render(repairedPath, pngDest);
      await removeIfExists(repairedPath);
      return { renderer: `${name} via ${renderer}`, error: '' };
    } catch (err) {
      failures.push(`${name}: ${errorToMessage(err)}`);
      await removeIfExists(pngDest);
      await removeIfExists(repairedPath);
    }
  }

  const message =
    `Could not render the first page cover for ${path.basename(pdfPath)}. ` +
      'The PDF may be damaged/incomplete, or required render/repair tools are missing. ' +
      'Linux: install poppler-utils qpdf mupdf-tools ghostscript imagemagick. ' +
      'Windows/macOS: pdf-poppler is used automatically, with the same CLI tools as fallback.\n' +
    `Renderer failures:\n- ${failures.join('\n- ')}`;

  throw new Error(message);
}

async function listPdfFiles(sourceDir) {
  const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
    .map((entry) => path.join(sourceDir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

async function findOrCreateAuthorAndCategory(author, category, transaction) {
  const [authorRow] = await Author.findOrCreate({
    where: { authorName: author },
    defaults: { authorName: author },
    transaction,
  });
  const [categoryRow] = await Category.findOrCreate({
    where: { categoryName: category },
    defaults: { categoryName: category },
    transaction,
  });

  return { authorId: authorRow.authorId, categoryId: categoryRow.categoryId };
}

async function findExistingEbook(title, originalName) {
  const titleFromName = titleFromPdfName(originalName);
  return EBook.findOne({
    where: {
      [Op.or]: [
        { eBookName: title },
        { eBookName: titleFromName },
        { description: { [Op.like]: `%${originalName}%` } },
      ],
    },
  });
}

async function importPdf(filePath, opts, index) {
  const originalName = path.basename(filePath);
  const { title, author, category } = await extractMetadata(filePath, opts);
  const existing = await findExistingEbook(title, originalName);

  if (existing && opts.skipExisting) {
    return { title, author, category, status: 'skipped', reason: 'ebook name already exists' };
  }

  if (opts.dryRun) {
    return {
      title,
      author,
      category,
      status: existing ? 'dry-run update' : 'dry-run import',
      cover: 'first page PNG required',
    };
  }

  await fs.promises.mkdir(ebookUploadDir, { recursive: true });
  await fs.promises.mkdir(coverUploadDir, { recursive: true });

  const stamp = `${Date.now()}-${index + 1}`;
  const safeTitle = safeFilePart(title) || `ebook-${index + 1}`;
  const generatedPdfFileName = `${stamp}-${safeFilePart(originalName) || `${safeTitle}.pdf`}`;

  const existingPdfFileName = existing?.pdfFile ? path.basename(existing.pdfFile) : '';
  const pdfFileName = existingPdfFileName || generatedPdfFileName;
  const pdfStem = path.basename(pdfFileName, path.extname(pdfFileName));
  const pngCoverFileName = `${pdfStem}-cover.png`;

  const pdfDest = path.join(ebookUploadDir, pdfFileName);
  const pngCoverDest = path.join(coverUploadDir, pngCoverFileName);

  let coverImageForUpdate;
  let coverImageForCreate = null;
  let coverRenderer = '';
  let coverWarning = '';

  try {
    const coverResult = await renderFirstPageCover(filePath, pngCoverDest);
    coverRenderer = coverResult.renderer;
    const coverImage = `/uploads/covers/${pngCoverFileName}`;
    coverImageForUpdate = coverImage;
    coverImageForCreate = coverImage;
    const thumbResult = await pregenerateCoverThumbs(coverImage);
    if (thumbResult.ok && thumbResult.generated > 0) {
      coverRenderer = `${coverRenderer}; thumbs+${thumbResult.generated}`;
    }
  } catch (err) {
    if (opts.strictCover) {
      throw err;
    }
    coverWarning = `first page render failed: ${errorToMessage(err).split('\n')[0]}`;
    if (existing && existing.coverImage) {
      coverImageForUpdate = existing.coverImage;
      coverRenderer = 'kept existing cover';
    } else {
      coverImageForUpdate = null;
      coverImageForCreate = null;
      coverRenderer = 'no cover image (render tools missing or PDF damaged)';
    }
  }

  await sequelize.transaction(async (transaction) => {
    const { authorId, categoryId } = await findOrCreateAuthorAndCategory(author, category, transaction);

    if (existing) {
      const updates = {
        eBookName: title,
        Author_Author_id: authorId,
        Category_category_id: categoryId,
      };
      if (typeof coverImageForUpdate !== 'undefined') {
        updates.coverImage = coverImageForUpdate;
      }
      if (!existing.pdfFile) {
        await fs.promises.copyFile(filePath, pdfDest);
        updates.pdfFile = `/uploads/eBooks/${pdfFileName}`;
      }
      await existing.update(
        updates,
        { transaction }
      );
      return;
    }

    await fs.promises.copyFile(filePath, pdfDest);
    await EBook.create(
      {
        eBookName: title,
        releaseDate: localDateString(),
        description: `${opts.description}: ${originalName}`,
        pdfFile: `/uploads/eBooks/${pdfFileName}`,
        coverImage: coverImageForCreate,
        Author_Author_id: authorId,
        Category_category_id: categoryId,
      },
      { transaction }
    );
  });

  return {
    title,
    author,
    category,
    status: existing ? 'updated' : 'imported',
    cover: coverRenderer.startsWith('kept') || coverRenderer.startsWith('no cover')
      ? coverRenderer
      : `first page via ${coverRenderer}`,
    warning: coverWarning,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(usage());
    return;
  }

  if (!fs.existsSync(opts.source)) {
    throw new Error(`PDF source folder not found: ${opts.source}`);
  }

  const files = await listPdfFiles(opts.source);
  if (files.length === 0) {
    process.stdout.write(`No PDF files found in ${opts.source}\n`);
    return;
  }

  await sequelize.authenticate();

  const results = [];
  for (let i = 0; i < files.length; i += 1) {
    results.push(await importPdf(files[i], opts, i));
  }

  for (const result of results) {
    const suffix = result.reason ? ` (${result.reason})` : '';
    const cover = result.cover ? ` | cover: ${result.cover}` : '';
    const warning = result.warning ? ` | warning: ${result.warning}` : '';
    process.stdout.write(
      `${result.status}: ${result.title} | author: ${result.author} | category: ${result.category}${cover}${warning}${suffix}\n`
    );
  }
}

main()
  .catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close().catch(() => {});
  });
