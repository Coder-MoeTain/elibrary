#!/bin/bash
set -euo pipefail
cd /var/www/elibrary
echo '=== process ==='
ps aux | grep -E '[n]ode /var/www/elibrary' || true
pm2 status || true
echo '=== sample paper with pdf ==='
node <<'NODE'
require('dotenv').config();
const { sequelize } = require('./models');
(async () => {
  const [rows] = await sequelize.query(`
    SELECT eBooks_id AS id, eBook_name AS name, content_type, pdf_file
    FROM ebooks
    WHERE content_type = 'paper' AND pdf_file IS NOT NULL AND TRIM(pdf_file) <> ''
    ORDER BY eBooks_id DESC
    LIMIT 3
  `);
  console.log(JSON.stringify(rows, null, 2));
  const [ebooks] = await sequelize.query(`
    SELECT COUNT(1) AS c FROM ebooks WHERE content_type = 'ebook'
  `);
  const [papers] = await sequelize.query(`
    SELECT COUNT(1) AS c FROM ebooks WHERE content_type = 'paper'
  `);
  console.log('counts', { ebook: ebooks[0].c, paper: papers[0].c });
  await sequelize.close();
})().catch(async (e) => { console.error(e); process.exit(1); });
NODE
