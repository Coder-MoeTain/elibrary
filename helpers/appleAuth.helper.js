const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const { HTTP_STATUS } = require('../constants');

const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';

let cachedKeys = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

function getAllowedAudiences() {
  const raw = String(
    process.env.APPLE_CLIENT_IDS || process.env.APPLE_CLIENT_ID || ''
  ).trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function jwkToPem(jwk) {
  const keyObject = crypto.createPublicKey({
    key: jwk,
    format: 'jwk',
  });
  return keyObject.export({ type: 'spki', format: 'pem' });
}

async function getAppleSigningKey(kid) {
  const now = Date.now();
  if (!cachedKeys || now - cachedAt > CACHE_TTL_MS) {
    const { data } = await axios.get(APPLE_JWKS_URI, { timeout: 10000 });
    cachedKeys = Array.isArray(data?.keys) ? data.keys : [];
    cachedAt = now;
  }

  let jwk = cachedKeys.find((k) => k.kid === kid);
  if (!jwk) {
    // Force refresh once if kid not found (Apple key rotation).
    const { data } = await axios.get(APPLE_JWKS_URI, { timeout: 10000 });
    cachedKeys = Array.isArray(data?.keys) ? data.keys : [];
    cachedAt = Date.now();
    jwk = cachedKeys.find((k) => k.kid === kid);
  }

  if (!jwk) {
    throw new AppError('Apple signing key not found', HTTP_STATUS.UNAUTHORIZED);
  }

  return jwkToPem(jwk);
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Verifies an Apple identity token and returns profile fields.
 * Configure `APPLE_CLIENT_IDS` (comma-separated audiences — usually the iOS bundle ID).
 */
async function verifyAppleIdentityToken(identityToken, { nonce } = {}) {
  const token = String(identityToken || '').trim();
  if (!token) {
    throw new AppError('Apple identity token is required', HTTP_STATUS.BAD_REQUEST);
  }

  const audiences = getAllowedAudiences();
  if (!audiences.length) {
    throw new AppError(
      'Sign in with Apple is not configured on the server',
      HTTP_STATUS.INTERNAL
    );
  }

  let decodedHeader;
  try {
    decodedHeader = jwt.decode(token, { complete: true });
  } catch {
    throw new AppError('Invalid Apple identity token', HTTP_STATUS.UNAUTHORIZED);
  }

  if (!decodedHeader?.header?.kid) {
    throw new AppError('Invalid Apple identity token', HTTP_STATUS.UNAUTHORIZED);
  }

  let payload;
  try {
    const pem = await getAppleSigningKey(decodedHeader.header.kid);
    payload = jwt.verify(token, pem, {
      algorithms: ['RS256'],
      issuer: APPLE_ISSUER,
      audience: audiences.length === 1 ? audiences[0] : audiences,
    });
  } catch {
    throw new AppError('Invalid Apple identity token', HTTP_STATUS.UNAUTHORIZED);
  }

  if (!payload || !payload.sub) {
    throw new AppError('Invalid Apple identity token', HTTP_STATUS.UNAUTHORIZED);
  }

  if (nonce) {
    const expected = sha256Hex(String(nonce));
    const actual = String(payload.nonce || '');
    if (!actual || actual !== expected) {
      throw new AppError('Invalid Apple nonce', HTTP_STATUS.UNAUTHORIZED);
    }
  }

  const email =
    payload.email != null ? String(payload.email).trim().toLowerCase() : null;

  if (email && payload.email_verified === 'false') {
    throw new AppError('Apple email is not verified', HTTP_STATUS.UNAUTHORIZED);
  }

  return {
    sub: String(payload.sub),
    email,
    name: '',
  };
}

module.exports = {
  verifyAppleIdentityToken,
  getAllowedAudiences,
};
