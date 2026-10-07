require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const categoryService = require('../services/category.service');

(async () => {
  try {
    const books = await sequelize.query(
      'SELECT COUNT(*) AS c, COUNT(DISTINCT Category_category_id) AS cats FROM books',
      { type: QueryTypes.SELECT }
    );
    console.log('books', books);

    const ebooks = await sequelize.query(
      'SELECT COUNT(*) AS c, COUNT(DISTINCT Category_category_id) AS cats FROM ebooks',
      { type: QueryTypes.SELECT }
    );
    console.log('ebooks', ebooks);

    const marker = await sequelize.query(
      "SELECT COUNT(*) AS c FROM ebooks WHERE content_type = 'paper'",
      { type: QueryTypes.SELECT }
    );
    console.log('papers content_type', marker);

    const legacyMarker = await sequelize.query(
      "SELECT COUNT(*) AS c FROM ebooks WHERE description LIKE '%Collector-Paper-ID:%'",
      { type: QueryTypes.SELECT }
    );
    console.log('papers legacy marker', legacyMarker);

    const fkSample = await sequelize.query(
      'SELECT Category_category_id AS cid, COUNT(*) AS c FROM ebooks GROUP BY Category_category_id ORDER BY c DESC LIMIT 5',
      { type: QueryTypes.SELECT }
    );
    console.log('top ebook categories by fk', fkSample);

    const orphan = await sequelize.query(
      `SELECT COUNT(*) AS c FROM ebooks e
       LEFT JOIN category c ON c.category_id = e.Category_category_id
       WHERE c.category_id IS NULL`,
      { type: QueryTypes.SELECT }
    );
    console.log('ebooks with missing category row', orphan);

    const withCounts = await categoryService.findAllWithCounts();
    const nonzero = withCounts.filter(
      (r) => r.bookCount > 0 || r.ebookCount > 0 || r.paperCount > 0
    );
    console.log('total categories', withCounts.length);
    console.log('nonzero counted', nonzero.length);
    console.log('sample withCounts[0]', withCounts[0]);
    console.log('top nonzero', nonzero.slice(0, 5));
  } catch (e) {
    console.error('ERR', e.message);
    console.error(e.stack);
  } finally {
    await sequelize.close();
  }
})();
