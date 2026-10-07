'use strict';
require('dotenv').config();
const { sequelize } = require('../models');

(async () => {
  const titles = [
    'Intelligent Healthcare Systems',
    'Planetary health approaches',
    'Artificial intelligence and quantum cryptography',
    'Human versus Machine',
    'ORTHODONTIC',
    'Machine Learning in Cybersecurity',
  ];
  for (const t of titles) {
    const [rows] = await sequelize.query(
      `SELECT eBooks_id AS id, content_type AS ct, eBook_name AS name,
              CASE WHEN description LIKE '%Collector-Paper-ID:%' THEN 1 ELSE 0 END AS has_marker
       FROM ebooks
       WHERE eBook_name LIKE :t
       LIMIT 5`,
      { replacements: { t: `%${t}%` } }
    );
    console.log(t, JSON.stringify(rows));
  }

  const [byType] = await sequelize.query(
    `SELECT content_type AS ct, COUNT(1) AS c
     FROM ebooks
     WHERE description LIKE '%Collector-Paper-ID:%'
     GROUP BY content_type`
  );
  console.log('collector_by_type', byType);

  const [recent] = await sequelize.query(
    `SELECT eBooks_id AS id, content_type AS ct, eBook_name AS name,
            CASE WHEN description LIKE '%Collector-Paper-ID:%' THEN 1 ELSE 0 END AS has_marker
     FROM ebooks
     ORDER BY eBooks_id DESC
     LIMIT 8`
  );
  console.log('recent_library', recent);

  await sequelize.close();
})().catch(async (e) => {
  console.error(e);
  try {
    await sequelize.close();
  } catch (_) {}
  process.exit(1);
});
