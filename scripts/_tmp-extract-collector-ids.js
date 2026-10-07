'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { sequelize } = require('../models');

(async () => {
  const [rows] = await sequelize.query(
    `SELECT eBooks_id AS id, eBook_name AS name, description
     FROM ebooks
     WHERE content_type='ebook'
       AND (
         eBook_name LIKE '%Planetary health approaches%'
         OR eBook_name LIKE '%Human versus Machine%'
         OR eBook_name LIKE '%quantum cryptography%'
         OR eBook_name LIKE '%Machine Learning in Cybersecurity%'
         OR eBook_name LIKE '%Intelligent Healthcare Systems%'
         OR eBook_name LIKE '%ORTHODONTIC DIAGNOSIS%'
       )
     ORDER BY eBooks_id DESC`
  );

  for (const r of rows) {
    const m = String(r.description || '').match(/Collector-Paper-ID:\s*(\d+)/);
    console.log(JSON.stringify({
      library_id: r.id,
      name: r.name,
      collector_paper_id: m ? Number(m[1]) : null,
    }));
  }

  await sequelize.close();
})().catch(async (e) => {
  console.error(e);
  try { await sequelize.close(); } catch (_) {}
  process.exit(1);
});
