'use strict';

const COLLECTOR_MARKER = 'Collector-Paper-ID:';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ebooks', 'content_type', {
      type: Sequelize.ENUM('ebook', 'paper'),
      allowNull: false,
      defaultValue: 'ebook',
    });

    await queryInterface.sequelize.query(
      `
      UPDATE ebooks
      SET content_type = 'paper'
      WHERE description IS NOT NULL
        AND description LIKE :marker
      `,
      { replacements: { marker: `%${COLLECTOR_MARKER}%` } }
    );

    await queryInterface.addIndex('ebooks', ['content_type'], {
      name: 'idx_ebooks_content_type',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('ebooks', 'idx_ebooks_content_type');
    await queryInterface.removeColumn('ebooks', 'content_type');
  },
};
