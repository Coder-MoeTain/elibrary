'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ebooks', 'ai_summary_en', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
    });
    await queryInterface.addColumn('ebooks', 'ai_summary_my', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
    });

    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'mysql') {
      await queryInterface.sequelize.query(`
        UPDATE ebooks
        SET ai_summary_en = ai_summary
        WHERE ai_summary IS NOT NULL
          AND TRIM(ai_summary) <> ''
          AND (
            summary_language IS NULL
            OR TRIM(summary_language) = ''
            OR LOWER(TRIM(summary_language)) IN ('en', 'english')
          )
      `);
      await queryInterface.sequelize.query(`
        UPDATE ebooks
        SET ai_summary_my = ai_summary
        WHERE ai_summary IS NOT NULL
          AND TRIM(ai_summary) <> ''
          AND LOWER(TRIM(summary_language)) IN ('my', 'mm', 'burmese', 'my-mm', 'my_mm')
      `);
    } else {
      await queryInterface.sequelize.query(`
        UPDATE ebooks
        SET ai_summary_en = ai_summary
        WHERE ai_summary IS NOT NULL
          AND TRIM(ai_summary) != ''
          AND (
            summary_language IS NULL
            OR TRIM(summary_language) = ''
            OR LOWER(TRIM(summary_language)) IN ('en', 'english')
          )
      `);
      await queryInterface.sequelize.query(`
        UPDATE ebooks
        SET ai_summary_my = ai_summary
        WHERE ai_summary IS NOT NULL
          AND TRIM(ai_summary) != ''
          AND LOWER(TRIM(summary_language)) IN ('my', 'mm', 'burmese', 'my-mm', 'my_mm')
      `);
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ebooks', 'ai_summary_my');
    await queryInterface.removeColumn('ebooks', 'ai_summary_en');
  },
};
