/**
 * Fail closed in production when secrets or unsafe defaults are present.
 * Called from server.js before the app binds to a port.
 */
function validateProductionEnv() {
  if (String(process.env.NODE_ENV || '').trim() !== 'production') return;

  const errors = [];
  const weakJwt = new Set(['dev-only-change-me', 'change-me', 'secret', 'jwt_secret']);
  const jwt = String(process.env.JWT_SECRET || '').trim();

  if (!jwt || jwt.length < 32 || weakJwt.has(jwt.toLowerCase())) {
    errors.push('JWT_SECRET must be set to a strong random value (32+ chars) in production');
  }

  const dbUser = String(process.env.DB_USER || '').trim();
  const dbPass = String(process.env.DB_PASSWORD || '').trim();
  if (!dbUser) errors.push('DB_USER is required in production');
  if (!dbPass || dbPass === 'root') {
    errors.push('DB_PASSWORD must be set to a unique strong password in production');
  }

  if (!String(process.env.DB_NAME || '').trim()) {
    errors.push('DB_NAME is required in production');
  }

  const cors = String(process.env.CORS_ORIGINS || '').trim();
  if (!cors) {
    errors.push('CORS_ORIGINS must list allowed front-end origin(s) in production (comma-separated)');
  }

  if (errors.length) {
    // eslint-disable-next-line no-console
    console.error('[security] Production environment validation failed:\n');
    errors.forEach((e) => {
      // eslint-disable-next-line no-console
      console.error(`  - ${e}`);
    });
    // eslint-disable-next-line no-console
    console.error('\nCopy .env.example to .env and configure before starting.');
    process.exit(1);
  }
}

module.exports = { validateProductionEnv };
