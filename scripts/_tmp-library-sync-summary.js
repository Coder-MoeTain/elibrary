'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { sequelize } = require('../models');

(async () => {
  const [[tot]] = await sequelize.query(`SELECT COUNT(1) AS c FROM ebooks`);
  const [byType] = await sequelize.query(
    `SELECT content_type AS ct, COUNT(1) AS c FROM ebooks GROUP BY content_type`
  );
  const [collector] = await sequelize.query(
    `SELECT content_type AS ct, COUNT(1) AS c
     FROM ebooks WHERE description LIKE '%Collector-Paper-ID:%'
     GROUP BY content_type`
  );
  const [[importedPdf]] = await sequelize.query(
    `SELECT COUNT(1) AS c FROM ebooks
     WHERE content_type='ebook' AND description LIKE '%Imported from PDF%'`
  );
  const [[ebookCollector]] = await sequelize.query(
    `SELECT COUNT(1) AS c FROM ebooks
     WHERE content_type='ebook' AND description LIKE '%Collector-Paper-ID:%'`
  );
  const [samples] = await sequelize.query(
    `SELECT eBooks_id AS id, eBook_name AS name
     FROM ebooks
     WHERE content_type='ebook' AND description LIKE '%Collector-Paper-ID:%'
     ORDER BY eBooks_id DESC LIMIT 12`
  );

  console.log(JSON.stringify({
    total: tot.c,
    byType,
    collectorByType: collector,
    ebookFromCyberScholarSync: ebookCollector.c,
    ebookFromPdfImport: importedPdf.c,
    recentCyberScholarEbooksInLibrary: samples,
  }, null, 2));

  await sequelize.close();
})().catch(async (e) => {
  console.error(e);
  try { await sequelize.close(); } catch (_) {}
  process.exit(1);
});
