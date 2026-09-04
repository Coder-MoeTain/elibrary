const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const routes = require('./routes');
const { errorMiddleware, notFoundHandler } = require('./middlewares/error.middleware');
const appConfig = require('./config');

const app = express();

const distPath = path.join(__dirname, 'dist');
const uploadsPath = path.join(__dirname, 'public', 'uploads');
const coversPath = path.join(uploadsPath, 'covers');
const booksCoversPath = path.join(uploadsPath, 'books', 'covers');
const coverThumbsPath = path.join(coversPath, '.thumbs');

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

app.get('/uploads/covers/:file', async (req, res, next) => {
  try {
    const enableThumb = ['1', 'true', 'yes'].includes(String(req.query.thumb ?? '').toLowerCase());
    if (!enableThumb) return next();

    const fileName = sanitizeFileSegment(req.params.file);
    if (!fileName) return next();

    const source = path.join(coversPath, fileName);
    if (!fs.existsSync(source)) return next();

    const w = Math.min(640, Math.max(80, Number(req.query.w) || 220));
    const q = Math.min(95, Math.max(40, Number(req.query.q) || 70));
    const cacheName = `${w}-${q}-${fileName.replace(/\.[^.]+$/, '')}.jpg`;
    const cachedThumb = path.join(coverThumbsPath, cacheName);

    if (fs.existsSync(cachedThumb)) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(cachedThumb);
    }

    await fs.promises.mkdir(coverThumbsPath, { recursive: true });
    const image = await loadImage(source);
    const srcW = Math.max(1, image.width || w);
    const srcH = Math.max(1, image.height || Math.round((w * 3) / 2));
    const outW = Math.min(w, srcW);
    const outH = Math.max(1, Math.round((srcH * outW) / srcW));
    const canvas = createCanvas(outW, outH);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, outW, outH);
    const jpeg = await canvas.encode('jpeg', q);
    await fs.promises.writeFile(cachedThumb, jpeg);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(cachedThumb);
  } catch {
    return next();
  }
});

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
