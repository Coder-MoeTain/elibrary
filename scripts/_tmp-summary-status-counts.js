'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { sequelize } = require('../models');

(async () => {
  const [rows] = await sequelize.query(`
    SELECT summary_status AS s, content_type AS t, COUNT(1) AS c
    FROM ebooks
    GROUP BY summary_status, content_type
    ORDER BY t, c DESC
  `);
  console.log(JSON.stringify(rows, null, 2));
  await sequelize.close();
})().catch(async (e) => {
  console.error(e);
  try { await sequelize.close(); } catch (_) {}
  process.exit(1);
});
