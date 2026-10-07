'use strict';
/**
 * Direct OpenAI + summary smoke test (no HTTP).
 * Usage: node scripts/_tmp-summary-smoke.js [ebookId]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const ebookId = Number(process.argv[2] || 102);

(async () => {
  const { getOpenAiClient } = require('../services/openai.client');
  console.log('key present', Boolean(process.env.OPENAI_API_KEY));
  try {
    const client = getOpenAiClient();
    const models = await client.models.list({ limit: 3 });
    console.log('openai_ok', models?.data?.slice?.(0, 3)?.map((m) => m.id) || 'listed');
  } catch (e) {
    console.error('openai_fail', e.status || e.code || '', e.message);
  }

  try {
    const ebookService = require('../services/ebook.service');
    console.log('generating summary for', ebookId, '…');
    const t0 = Date.now();
    const result = await ebookService.getOrGenerateSummary(ebookId, { language: 'en' });
    console.log(JSON.stringify({
      ms: Date.now() - t0,
      status: result.summaryStatus || result.summary_status,
      source: result.source,
      len: String(result.aiSummary || result.ai_summary || result.summary || '').length,
      preview: String(result.aiSummary || result.ai_summary || result.summary || '').slice(0, 160),
    }, null, 2));
  } catch (e) {
    console.error('summary_fail', e.statusCode || e.status || '', e.message);
    if (e.stack) console.error(e.stack.split('\n').slice(0, 8).join('\n'));
  }

  const { sequelize } = require('../models');
  await sequelize.close();
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
