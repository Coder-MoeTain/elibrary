const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const uploadsRoot = path.join(process.cwd(), 'public', 'uploads');
const ebookDir = path.join(uploadsRoot, 'eBooks');
const coverDir = path.join(uploadsRoot, 'covers');
const booksCoverDir = path.join(uploadsRoot, 'books', 'covers');

const ALLOWED_COVER_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_COVER_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function ensureUploadDirs() {
  fs.mkdirSync(ebookDir, { recursive: true });
  fs.mkdirSync(coverDir, { recursive: true });
  fs.mkdirSync(booksCoverDir, { recursive: true });
}

function safeExtension(originalname, fallback) {
  const ext = path.extname(String(originalname || '')).toLowerCase();
  if (ext && /^[.a-z0-9]+$/.test(ext)) return ext;
  return fallback;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDirs();
    if (file.fieldname === 'pdf') return cb(null, ebookDir);
    if (file.fieldname === 'cover') {
      if (typeof req.baseUrl === 'string' && req.baseUrl.includes('/books')) {
        return cb(null, booksCoverDir);
      }
      return cb(null, coverDir);
    }
    return cb(new Error('Unsupported upload field'));
  },
  filename: (req, file, cb) => {
    const ext =
      file.fieldname === 'pdf'
        ? safeExtension(file.originalname, '.pdf')
        : safeExtension(file.originalname, '.jpg');
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'pdf') {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF allowed'), false);
    }
    const ext = safeExtension(file.originalname, '.pdf');
    if (ext !== '.pdf') {
      return cb(new Error('Only PDF allowed'), false);
    }
    return cb(null, true);
  }
  if (file.fieldname === 'cover') {
    if (!ALLOWED_COVER_MIMES.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP or GIF images allowed'), false);
    }
    const ext = safeExtension(file.originalname, '');
    if (!ext || !ALLOWED_COVER_EXT.has(ext)) {
      return cb(new Error('Invalid image extension'), false);
    }
    return cb(null, true);
  }
  return cb(new Error('Unsupported upload field'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 2,
    fields: 30,
  },
});

module.exports = upload;
