const rateLimit = require('express-rate-limit');
const { HTTP_STATUS } = require('../constants');

const jsonMessage = (message) => ({
  success: false,
  message,
});

/** Login / register — per IP */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  // Trust-proxy is set in app.js when behind nginx; skip this check so misconfig
  // does not hard-fail auth routes in production.
  validate: { xForwardedForHeader: false },
  message: jsonMessage('Too many login attempts. Try again in 15 minutes.'),
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

/** OpenAI summarize — per authenticated user (apply after authenticate) */
const summarizeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  keyGenerator: (req) => {
    const id = req.user?.id;
    const role = req.user?.role || 'anon';
    return id ? `${role}:${id}` : req.ip;
  },
  message: jsonMessage('Summary rate limit reached. Try again later.'),
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

module.exports = {
  authLimiter,
  summarizeLimiter,
};
