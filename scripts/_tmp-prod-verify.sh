#!/bin/bash
set -euo pipefail
cd /var/www/elibrary
echo '=== migration file ==='
ls -la migrations/27-add-ebook-content-type.js
echo '=== content_type check ==='
node scripts/_tmp-check-prod-content-type.js
echo '=== sequelizemeta last 8 ==='
node <<'NODE'
require('dotenv').config();
const { sequelize } = require('./models');
(async () => {
  const [rows] = await sequelize.query('SELECT name FROM sequelizemeta ORDER BY name DESC LIMIT 8');
  console.log(rows.map((r) => r.name).join('\n'));
  await sequelize.close();
})().catch(async (e) => {
  console.error(e.message);
  process.exit(1);
});
NODE
echo '=== pm2 ==='
pm2 status
echo '=== port 3000 ==='
ss -lptn 'sport = :3000' || true
echo '=== recent errors ==='
pm2 logs elibrary --err --lines 20 --nostream || true
