const { sequelize } = require('../models');

(async () => {
  try {
    const [cols] = await sequelize.query("SHOW COLUMNS FROM ebooks LIKE 'content_type'");
    console.log('column=', JSON.stringify(cols));

    if (!cols.length) {
      console.log('MISSING content_type column');
      const [meta] = await sequelize.query('SELECT name FROM sequelizemeta ORDER BY name');
      console.log('migrations=', meta.map((r) => r.name).join(', '));
      return;
    }

    const [counts] = await sequelize.query(
      'SELECT content_type AS t, COUNT(1) AS c FROM ebooks GROUP BY content_type'
    );
    console.log('counts=', JSON.stringify(counts));

    const [marker] = await sequelize.query(
      "SELECT COUNT(1) AS c FROM ebooks WHERE description LIKE '%Collector-Paper-ID:%'"
    );
    console.log('legacyMarker=', JSON.stringify(marker));

    const [mismatch] = await sequelize.query(
      `SELECT COUNT(1) AS c FROM ebooks
       WHERE description LIKE '%Collector-Paper-ID:%' AND content_type <> 'paper'`
    );
    console.log('markerButNotPaper=', JSON.stringify(mismatch));
  } catch (e) {
    console.error('ERR', e.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
