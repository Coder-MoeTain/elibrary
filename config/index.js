require('dotenv').config();

function env(key, fallback) {
  const v = process.env[key];
  if (v == null || v === '') return fallback;
  return String(v).trim();
}

const nodeEnv = env('NODE_ENV', 'development');
const isProd = nodeEnv === 'production';

module.exports = {
  env: nodeEnv,
  /** Production defaults to loopback — use nginx reverse proxy. Set HOST=0.0.0.0 for direct LAN access. */
  host: env('HOST', isProd ? '127.0.0.1' : '0.0.0.0'),
  port: Number(env('PORT', '3000')) || 3000,
  jwt: {
    secret: isProd ? env('JWT_SECRET') : env('JWT_SECRET', 'dev-only-change-me'),
    expiresIn: env('JWT_EXPIRES_IN', isProd ? '1d' : '7d'),
  },
  isProd,
};
