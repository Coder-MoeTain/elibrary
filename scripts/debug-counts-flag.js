require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Simulate what the controller does with req.query
const samples = [
  { counts: 'true' },
  { counts: true },
  { counts: ['true'] },
  {},
];

for (const query of samples) {
  const withCounts = ['1', 'true', 'yes'].includes(String(query.counts ?? '').toLowerCase());
  console.log(JSON.stringify(query), '->', withCounts, 'raw=', query.counts, 'str=', String(query.counts ?? ''));
}

const categoryService = require('../services/category.service');
(async () => {
  const rows = await categoryService.findAllWithCounts();
  console.log('service sample', rows[0]);
  console.log('service nonzero', rows.filter((r) => r.paperCount > 0 || r.ebookCount > 0 || r.bookCount > 0).length);
  process.exit(0);
})();
