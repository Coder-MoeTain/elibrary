const { OAuth2Client } = require('google-auth-library');
const AppError = require('../utils/AppError');
const { HTTP_STATUS } = require('../constants');

function getAllowedClientIds() {
  const raw = String(process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Verifies a Google ID token and returns profile fields.
 * Configure `GOOGLE_CLIENT_IDS` (comma-separated OAuth client IDs / audiences).
 */
async function verifyGoogleIdToken(idToken) {
  const token = String(idToken || '').trim();
  if (!token) {
    throw new AppError('Google ID token is required', HTTP_STATUS.BAD_REQUEST);
  }

  const audiences = getAllowedClientIds();
  if (!audiences.length) {
    throw new AppError(
      'Google Sign-In is not configured on the server',
      HTTP_STATUS.INTERNAL
    );
  }

  const client = new OAuth2Client();
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: token,
      audience: audiences.length === 1 ? audiences[0] : audiences,
    });
  } catch {
    throw new AppError('Invalid Google ID token', HTTP_STATUS.UNAUTHORIZED);
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new AppError('Google account email is required', HTTP_STATUS.UNAUTHORIZED);
  }
  if (payload.email_verified === false) {
    throw new AppError('Google email is not verified', HTTP_STATUS.UNAUTHORIZED);
  }

  return {
    email: String(payload.email).trim().toLowerCase(),
    name: String(payload.name || payload.given_name || '').trim(),
    picture: payload.picture ? String(payload.picture) : null,
    sub: payload.sub ? String(payload.sub) : null,
  };
}

module.exports = {
  verifyGoogleIdToken,
  getAllowedClientIds,
};
