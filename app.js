const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const { errorMiddleware, notFoundHandler } = require('./middlewares/error.middleware');
const appConfig = require('./config');
const { ensureCoverThumb, clampWidth, clampQuality } = require('./utils/coverThumb');

const app = express();

const distPath = path.join(__dirname, 'dist');
const uploadsPath = path.join(__dirname, 'public', 'uploads');
const coversPath = path.join(uploadsPath, 'covers');
const booksCoversPath = path.join(uploadsPath, 'books', 'covers');

/**
 * Set USE_HTTPS=true when the app is only served over HTTPS (nginx TLS or USE_TLS).
 * On plain HTTP (LAN / IP:3000), CSP upgrade-insecure-requests breaks asset loading.
 */
const enableHsts = process.env.USE_HTTPS === 'true';

app.use(
  helmet({
    strictTransportSecurity: enableHsts
      ? { maxAge: 31536000, includeSubDomains: true, preload: false }
      : false,
    contentSecurityPolicy: enableHsts ? undefined : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: enableHsts ? { policy: 'same-origin-allow-popups' } : false,
  }),
);

function buildCorsOptions() {
  const raw = String(process.env.CORS_ORIGINS || '').trim();
  const allowed = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowed && allowed.length) {
        return callback(null, allowed.includes(origin));
      }
      if (!appConfig.isProd) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  };
}

app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan(appConfig.isProd ? 'combined' : 'dev'));

function setUploadCacheHeaders(res, filePath) {
  const rel = String(filePath).replace(/\\/g, '/');
  const isCover = rel.includes('/covers/');
  const isImage = /\.(png|jpe?g|webp|gif|avif)$/i.test(rel);
  if (isCover && isImage) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return;
  }
  if (isImage) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=600');
}

function sanitizeFileSegment(raw) {
  const base = path.basename(String(raw || ''));
  if (!base || base === '.' || base === '..') return '';
  if (base.includes('/') || base.includes('\\')) return '';
  return base;
}

async function serveCoverThumb(req, res, next, { sourceDir }) {
  try {
    const enableThumb = ['1', 'true', 'yes'].includes(String(req.query.thumb ?? '').toLowerCase());
    if (!enableThumb) return next();

    const fileName = sanitizeFileSegment(req.params.file);
    if (!fileName) return next();

    const source = path.join(sourceDir, fileName);
    if (!fs.existsSync(source)) return next();

    const w = clampWidth(req.query.w);
    const q = clampQuality(req.query.q);
    const cachedThumb = await ensureCoverThumb(source, { width: w, quality: q });
    if (!cachedThumb) return next();

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(cachedThumb);
  } catch {
    return next();
  }
}

app.get('/uploads/covers/:file', (req, res, next) =>
  serveCoverThumb(req, res, next, { sourceDir: coversPath }),
);

app.get('/uploads/books/covers/:file', (req, res, next) =>
  serveCoverThumb(req, res, next, { sourceDir: booksCoversPath }),
);

/** Public cover images only — eBook PDFs require authenticated /api/ebooks/:id/pdf */
app.use('/uploads/covers', express.static(coversPath, { setHeaders: setUploadCacheHeaders }));
app.use(
  '/uploads/books/covers',
  express.static(booksCoversPath, { setHeaders: setUploadCacheHeaders }),
);

app.use('/uploads/eBooks', (req, res) => {
  res.status(403).json({
    success: false,
    message: 'Direct PDF access is disabled. Sign in and use the library app to read e-books.',
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, service: 'library-api' });
});

app.use('/api', routes);

app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  const indexFile = path.join(distPath, 'index.html');
  if (!fs.existsSync(indexFile)) {
    return res
      .status(503)
      .type('text/plain')
      .send('Frontend build missing. Run: npm run client:build');
  }
  res.sendFile(indexFile);
});

app.use(notFoundHandler);
app.use(errorMiddleware);

module.exports = app;
