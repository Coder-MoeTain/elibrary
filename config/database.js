require('dotenv').config();

function env(key, fallback) {
  const v = process.env[key];
  if (v == null || v === '') return fallback;
  return String(v).trim();
}

const isProd = env('NODE_ENV', 'development') === 'production';
const socketPath = env('DB_SOCKET', '');

const common = {
  dialect: 'mysql',
  host: env('DB_HOST', 'localhost'),
  port: Number(env('DB_PORT', '3306')) || 3306,
  database: env('DB_NAME', 'library'),
  username: env('DB_USER', isProd ? undefined : 'root'),
  password: env('DB_PASSWORD', isProd ? undefined : 'root'),
  logging: env('NODE_ENV', 'development') === 'development' ? console.log : false,
  /** Match `library.sql` / Linux-friendly lowercase meta table */
  migrationStorageTableName: 'sequelizemeta',
  // Prefer Unix socket when TCP to 127.0.0.1:3306 hangs (common after mysqld restarts).
  ...(socketPath
    ? {
        dialectOptions: {
          socketPath
        }
      }
    : {})
};

module.exports = {
  development: { ...common },
  test: { ...common, database: env('DB_NAME_TEST', 'library_test') },
  production: { ...common },
};
