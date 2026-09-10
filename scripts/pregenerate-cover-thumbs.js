'use strict';

/**
 * Backfill JPEG cover thumbs for existing uploads so catalog grids hit disk cache
 * instead of resizing large PNGs on first mobile/admin request.
 *
 * Usage:
 *   npm run thumbs:pregenerate
 *   npm run thumbs:pregenerate -- --ebooks-only
 *   npm run thumbs:pregenerate -- --books-only
 *   npm run thumbs:pregenerate -- --dry-run
 */

const fs = require('fs');
const path = require('path');
const {
  EBOOK_COVERS_DIR,
  BOOK_COVERS_DIR,
  pregenerateCoverThumbs,
  DEFAULT_PREGENERATE_WIDTHS,
} = require('../utils/coverThumb');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function parseArgs(argv) {
  const flags = new Set(argv);
  return {
    dryRun: flags.has('--dry-run'),
    ebooksOnly: flags.has('--ebooks-only'),
    booksOnly: flags.has('--books-only'),
  };
}

function listCoverFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
    .sort();
}

async function processDir(label, dir, urlPrefix, dryRun) {
  const files = listCoverFiles(dir);
  console.log(`[${label}] ${files.length} cover(s) in ${dir}`);
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const url = `${urlPrefix}/${file}`;
    if (dryRun) {
      console.log(`  dry-run ${url}`);
      skipped += 1;
      continue;
    }
    try {
      const result = await pregenerateCoverThumbs(url);
      generated += result.generated || 0;
      if (!result.ok) failed += 1;
      if ((i + 1) % 25 === 0 || i === files.length - 1) {
        console.log(`  … ${i + 1}/${files.length} (new thumbs: ${generated})`);
      }
    } catch (err) {
      failed += 1;
      console.warn(`  fail ${url}: ${err.message || err}`);
    }
  }

  return { files: files.length, generated, skipped, failed };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log('Pregenerate cover thumbs', {
    widths: DEFAULT_PREGENERATE_WIDTHS,
    dryRun: opts.dryRun,
    ebooksOnly: opts.ebooksOnly,
    booksOnly: opts.booksOnly,
  });

  const totals = { files: 0, generated: 0, skipped: 0, failed: 0 };

  if (!opts.booksOnly) {
    const r = await processDir('ebooks', EBOOK_COVERS_DIR, '/uploads/covers', opts.dryRun);
    totals.files += r.files;
    totals.generated += r.generated;
    totals.skipped += r.skipped;
    totals.failed += r.failed;
  }

  if (!opts.ebooksOnly) {
    const r = await processDir('books', BOOK_COVERS_DIR, '/uploads/books/covers', opts.dryRun);
    totals.files += r.files;
    totals.generated += r.generated;
    totals.skipped += r.skipped;
    totals.failed += r.failed;
  }

  console.log('Done', totals);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
