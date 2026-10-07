'use strict';

require('dotenv').config();
const { sequelize } = require('../models');

(async () => {
  const [byType] = await sequelize.query(
    'SELECT content_type AS t, COUNT(1) AS c FROM ebooks GROUP BY content_type'
  );
  console.log('BY_TYPE', JSON.stringify(byType));

  const [[total]] = await sequelize.query('SELECT COUNT(1) AS c FROM ebooks');
  console.log('TOTAL', total.c);

  const [[collector]] = await sequelize.query(
    "SELECT COUNT(1) AS c FROM ebooks WHERE description LIKE '%Collector-Paper-ID:%'"
  );
  console.log('COLLECTOR_MARKER', collector.c);

  const [[collectorAsEbook]] = await sequelize.query(
    "SELECT COUNT(1) AS c FROM ebooks WHERE description LIKE '%Collector-Paper-ID:%' AND content_type = 'ebook'"
  );
  console.log('COLLECTOR_MARKED_AS_EBOOK', collectorAsEbook.c);

  const [[importedPdf]] = await sequelize.query(
    "SELECT COUNT(1) AS c FROM ebooks WHERE description LIKE '%Imported from PDF%'"
  );
  console.log('IMPORTED_FROM_PDF', importedPdf.c);

  const [[cyberLike]] = await sequelize.query(
    `SELECT COUNT(1) AS c FROM ebooks
     WHERE eBook_name LIKE '%Cyber Scholar%'
        OR description LIKE '%Cyber Scholar%'
        OR description LIKE '%cyberscholar%'
        OR description LIKE '%CyberScholar%'`
  );
  console.log('CYBER_SCHOLAR_TEXT_MATCH', cyberLike.c);

  const [recentEbooks] = await sequelize.query(
    `SELECT eBooks_id AS id, eBook_name AS name, content_type AS t,
            LEFT(IFNULL(description,''), 100) AS d
     FROM ebooks
     WHERE content_type = 'ebook'
     ORDER BY eBooks_id DESC
     LIMIT 10`
  );
  console.log('RECENT_EBOOKS', JSON.stringify(recentEbooks, null, 2));

  const [pdfFiles] = await sequelize.query(
    `SELECT COUNT(1) AS c FROM ebooks
     WHERE content_type = 'ebook' AND pdf_file IS NOT NULL AND pdf_file <> ''`
  );
  console.log('EBOOKS_WITH_PDF', pdfFiles[0].c);

  const [uploadCount] = await sequelize.query(
    `SELECT COUNT(1) AS c FROM ebooks
     WHERE content_type = 'ebook' AND pdf_file LIKE '/uploads/eBooks/%'`
  );
  console.log('EBOOKS_UPLOADS_PATH', uploadCount[0].c);

  await sequelize.close();
})().catch(async (e) => {
  console.error(e);
  try {
    await sequelize.close();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
