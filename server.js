require('dotenv').config();

const { validateProductionEnv } = require('./config/validateEnv');
validateProductionEnv();

if (process.env.OPENAI_API_KEY) {
  try {
    require('./services/openai.client').getOpenAiClient();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[openai] Failed to initialize client at startup:', err.message);
  }
}

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const app = require('./app');
const config = require('./config');
const db = require('./models');

const sslKeyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'certs', 'key.pem');
const sslCertPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'certs', 'cert.pem');
const useTls = process.env.USE_TLS === 'true' || process.env.HTTPS === 'true';

async function start() {
  try {
    if (config.isProd && !useTls && config.host === '0.0.0.0') {
      // eslint-disable-next-line no-console
      console.warn(
        '[security] Production is binding to 0.0.0.0 over plain HTTP. Prefer HOST=127.0.0.1 behind nginx + HTTPS.',
      );
    }
    if (config.isProd && !useTls && process.env.USE_HTTPS !== 'true') {
      // eslint-disable-next-line no-console
      console.warn(
        '[security] USE_HTTPS is not enabled. Terminate TLS at nginx and set USE_HTTPS=true when ready.',
      );
    }

    await db.sequelize.authenticate();
    // eslint-disable-next-line no-console
    console.log('MySQL connection established.');
    try {
      const { timezone, offset } = await require('./services/settings.service').syncMysqlTimezone();
      // eslint-disable-next-line no-console
      console.log(`Library timezone: ${timezone} (${offset}).`);
    } catch (tzErr) {
      // eslint-disable-next-line no-console
      console.warn('[settings] Could not load timezone (run migrations):', tzErr.message);
    }

    const hasCerts = fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath);

    if (useTls && !hasCerts) {
      // eslint-disable-next-line no-console
      console.error(
        'USE_TLS=true but certificate files are missing.\n' +
          `  Expected: ${sslKeyPath}\n  and:      ${sslCertPath}\n` +
          'Run: npm run certs:generate -- YOUR_LAN_IP\n',
      );
      process.exit(1);
    }

    const onListen = () => {
      if (useTls && hasCerts) {
        // eslint-disable-next-line no-console
        console.log(
          `HTTPS listening on https://${config.host}:${config.port} (trust/accept the self-signed cert in your browser)`,
        );
      } else {
        // eslint-disable-next-line no-console
        console.log(`HTTP listening on http://${config.host}:${config.port}`);
      }
    };

    if (useTls && hasCerts) {
      const options = {
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath),
      };
      https.createServer(options, app).listen(config.port, config.host, onListen);
    } else {
      http.createServer(app).listen(config.port, config.host, onListen);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Unable to start server:', err);
    process.exit(1);
  }
}

start();
