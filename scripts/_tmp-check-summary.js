'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { sequelize, EBook } = require('../models');
const { resolveSafeUploadPath } = require('../utils/uploadPath');

(async () => {
  const key = process.env.OPENAI_API_KEY || '';
  console.log(JSON.stringify({
    hasOpenAiKey: Boolean(key.trim()),
    keyLen: key.trim().length,
    keyPrefix: key.trim() ? key.trim().slice(0, 7) + '…' : null,
    nodeEnv: process.env.NODE_ENV,
  }));

  const [statusCounts] = await sequelize.query(`
    SELECT summary_status AS s, COUNT(1) AS c
    FROM ebooks WHERE content_type='ebook'
    GROUP BY summary_status
  `);
  console.log('status_counts', statusCounts);

  const [failed] = await sequelize.query(`
    SELECT eBooks_id AS id, eBook_name AS name, pdf_file AS pdf, updated_at
    FROM ebooks
    WHERE content_type='ebook' AND summary_status='failed'
    ORDER BY updated_at DESC LIMIT 10
  `);
  console.log('failed_samples', failed);

  const [pending] = await sequelize.query(`
    SELECT eBooks_id AS id, eBook_name AS name, pdf_file AS pdf
    FROM ebooks
    WHERE content_type='ebook' AND summary_status='pending'
    ORDER BY eBooks_id DESC LIMIT 5
  `);

  for (const row of [...failed.slice(0, 3), ...pending.slice(0, 3)]) {
    const abs = resolveSafeUploadPath(row.pdf);
    const exists = abs ? fs.existsSync(abs) : false;
    let size = null;
    if (exists) {
      try { size = fs.statSync(abs).size; } catch (_) {}
    }
    console.log('pdf_check', {
      id: row.id,
      name: String(row.name || '').slice(0, 60),
      pdf: row.pdf,
      abs,
      exists,
      size,
    });
  }

  // completed ones that worked
  const [completed] = await sequelize.query(`
    SELECT eBooks_id AS id, eBook_name AS name,
           CHAR_LENGTH(IFNULL(ai_summary,'')) AS summary_len,
           summary_language AS lang, updated_at
    FROM ebooks
    WHERE content_type='ebook' AND summary_status='completed'
    ORDER BY updated_at DESC LIMIT 5
  `);
  console.log('recent_completed', completed);

  await sequelize.close();
})().catch(async (e) => {
  console.error(e);
  try { await sequelize.close(); } catch (_) {}
  process.exit(1);
});
