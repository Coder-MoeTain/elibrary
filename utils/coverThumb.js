'use strict';

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const UPLOADS_ROOT = path.resolve(process.cwd(), 'public', 'uploads');
const EBOOK_COVERS_DIR = path.join(UPLOADS_ROOT, 'covers');
const BOOK_COVERS_DIR = path.join(UPLOADS_ROOT, 'books', 'covers');

/** Widths requested by admin (~220) and mobile grids/detail (320–640). */
const DEFAULT_PREGENERATE_WIDTHS = Object.freeze([220, 320, 480, 640]);
const DEFAULT_QUALITY = 70;

function clampWidth(w) {
  return Math.min(640, Math.max(80, Number(w) || 220));
}

function clampQuality(q) {
  return Math.min(95, Math.max(40, Number(q) || DEFAULT_QUALITY));
}

function thumbsDirForSourceDir(sourceDir) {
  return path.join(sourceDir, '.thumbs');
}

function thumbFileName(sourceFileName, width, quality) {
  const stem = String(sourceFileName).replace(/\.[^.]+$/, '');
  return `${clampWidth(width)}-${clampQuality(quality)}-${stem}.jpg`;
}

function thumbPathFor(sourceAbs, width, quality) {
  const sourceDir = path.dirname(sourceAbs);
  const fileName = path.basename(sourceAbs);
  return path.join(thumbsDirForSourceDir(sourceDir), thumbFileName(fileName, width, quality));
}

/**
 * Resolve DB/public cover URL to absolute source file + kind.
 * @returns {{ sourceAbs: string, kind: 'ebook'|'book' } | null}
 */
function resolveCoverSource(coverUrlOrPath) {
  if (!coverUrlOrPath) return null;
  const raw = String(coverUrlOrPath).trim().replace(/\\/g, '/');
  if (!raw) return null;

  let relative = raw;
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      relative = new URL(raw).pathname;
    } catch {
      return null;
    }
  }
  relative = relative.replace(/^\/+/, '');
  if (relative.includes('..')) return null;

  let sourceAbs = null;
  let kind = null;
  if (relative.startsWith('uploads/covers/')) {
    const file = path.basename(relative);
    if (!file || file === '.' || file === '..') return null;
    sourceAbs = path.join(EBOOK_COVERS_DIR, file);
    kind = 'ebook';
  } else if (relative.startsWith('uploads/books/covers/')) {
    const file = path.basename(relative);
    if (!file || file === '.' || file === '..') return null;
    sourceAbs = path.join(BOOK_COVERS_DIR, file);
    kind = 'book';
  } else {
    return null;
  }

  if (!fs.existsSync(sourceAbs)) return null;
  return { sourceAbs, kind };
}

/**
 * Ensure a single JPEG thumb exists for a source cover file.
 * @returns {Promise<string|null>} absolute thumb path, or null on failure
 */
async function ensureCoverThumb(sourceAbs, { width = 220, quality = DEFAULT_QUALITY } = {}) {
  if (!sourceAbs || !fs.existsSync(sourceAbs)) return null;

  const w = clampWidth(width);
  const q = clampQuality(quality);
  const cachedThumb = thumbPathFor(sourceAbs, w, q);

  if (fs.existsSync(cachedThumb)) return cachedThumb;

  await fs.promises.mkdir(path.dirname(cachedThumb), { recursive: true });
  const image = await loadImage(sourceAbs);
  const srcW = Math.max(1, image.width || w);
  const srcH = Math.max(1, image.height || Math.round((w * 3) / 2));
  const outW = Math.min(w, srcW);
  const outH = Math.max(1, Math.round((srcH * outW) / srcW));
  const canvas = createCanvas(outW, outH);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, outW, outH);
  const jpeg = await canvas.encode('jpeg', q);
  await fs.promises.writeFile(cachedThumb, jpeg);
  return cachedThumb;
}

/**
 * Prefetch common catalog thumb sizes so first client requests hit disk cache.
 * Failures are swallowed so uploads/imports still succeed.
 */
async function pregenerateCoverThumbs(
  coverUrlOrPath,
  { widths = DEFAULT_PREGENERATE_WIDTHS, quality = DEFAULT_QUALITY } = {},
) {
  const resolved = resolveCoverSource(coverUrlOrPath);
  if (!resolved) return { ok: false, generated: 0, reason: 'missing-source' };

  let generated = 0;
  for (const width of widths) {
    try {
      const before = thumbPathFor(resolved.sourceAbs, width, quality);
      const existed = fs.existsSync(before);
      const out = await ensureCoverThumb(resolved.sourceAbs, { width, quality });
      if (out && !existed) generated += 1;
    } catch {
      // Best-effort; on-demand serveCoverThumb remains the fallback.
    }
  }
  return { ok: true, generated, kind: resolved.kind, sourceAbs: resolved.sourceAbs };
}

/** Fire-and-forget helper for request handlers. */
function pregenerateCoverThumbsAsync(coverUrlOrPath, options) {
  return pregenerateCoverThumbs(coverUrlOrPath, options).catch(() => null);
}

/**
 * Remove cached thumbs for a cover file (when cover is replaced/deleted).
 */
function deleteCoverThumbsForSource(coverUrlOrPath) {
  const resolved = resolveCoverSource(coverUrlOrPath);
  if (!resolved) return 0;

  const thumbsDir = thumbsDirForSourceDir(path.dirname(resolved.sourceAbs));
  if (!fs.existsSync(thumbsDir)) return 0;

  const stem = path.basename(resolved.sourceAbs).replace(/\.[^.]+$/, '');
  const suffix = `-${stem}.jpg`;
  let removed = 0;
  for (const name of fs.readdirSync(thumbsDir)) {
    if (!name.endsWith(suffix)) continue;
    try {
      fs.unlinkSync(path.join(thumbsDir, name));
      removed += 1;
    } catch {
      // Ignore.
    }
  }
  return removed;
}

module.exports = {
  DEFAULT_PREGENERATE_WIDTHS,
  DEFAULT_QUALITY,
  EBOOK_COVERS_DIR,
  BOOK_COVERS_DIR,
  clampWidth,
  clampQuality,
  thumbFileName,
  thumbPathFor,
  resolveCoverSource,
  ensureCoverThumb,
  pregenerateCoverThumbs,
  pregenerateCoverThumbsAsync,
  deleteCoverThumbsForSource,
  thumbsDirForSourceDir,
};
