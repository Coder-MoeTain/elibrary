const fs = require('fs');
const path = require('path');

const UPLOADS_ROOT = path.resolve(process.cwd(), 'public', 'uploads');

const ALLOWED_UPLOAD_PREFIXES = [
  'uploads/eBooks/',
  'uploads/covers/',
  'uploads/books/covers/',
];

/**
 * Resolve a DB-stored upload URL/path to an absolute file under public/uploads.
 * Rejects path traversal and paths outside the uploads root.
 */
function resolveSafeUploadPath(urlOrPath) {
  if (!urlOrPath) return null;
  const raw = String(urlOrPath).trim();
  if (!raw) return null;

  let relative;
  if (/^[/\\]+uploads[/\\]/i.test(raw)) {
    relative = raw.replace(/^[/\\]+/, '').replace(/\\/g, '/');
  } else if (path.isAbsolute(raw)) {
    const normalized = path.normalize(raw);
    if (!normalized.startsWith(UPLOADS_ROOT + path.sep) && normalized !== UPLOADS_ROOT) {
      return null;
    }
    return fs.existsSync(normalized) ? normalized : null;
  } else {
    relative = raw.replace(/^[/\\]+/, '').replace(/\\/g, '/');
  }

  if (relative.includes('..')) return null;

  const allowed = ALLOWED_UPLOAD_PREFIXES.some((prefix) => relative.startsWith(prefix));
  if (!allowed) return null;

  const abs = path.resolve(process.cwd(), 'public', relative);
  if (!abs.startsWith(UPLOADS_ROOT + path.sep) && abs !== UPLOADS_ROOT) {
    return null;
  }
  if (!fs.existsSync(abs)) return null;
  return abs;
}

/** Validate client-supplied upload URL belongs to an allowed subdirectory. */
function isAllowedUploadUrl(urlPath) {
  if (!urlPath || typeof urlPath !== 'string') return false;
  const normalized = urlPath.trim().replace(/\\/g, '/');
  if (!normalized.startsWith('/uploads/')) return false;
  const relative = normalized.replace(/^\/+/, '');
  if (relative.includes('..')) return false;
  return ALLOWED_UPLOAD_PREFIXES.some((prefix) => relative.startsWith(prefix));
}

module.exports = {
  UPLOADS_ROOT,
  ALLOWED_UPLOAD_PREFIXES,
  resolveSafeUploadPath,
  isAllowedUploadUrl,
};
