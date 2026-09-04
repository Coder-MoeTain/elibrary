'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Keep one row per (user_id, ebook_id), remove duplicates first.
    await queryInterface.sequelize.query(`
      DELETE er1
      FROM ebook_reads er1
      INNER JOIN ebook_reads er2
        ON er1.id > er2.id
       AND er1.user_id = er2.user_id
       AND er1.ebook_id = er2.ebook_id
    `);

    await queryInterface.addIndex('ebook_reads', ['user_id', 'ebook_id'], {
      unique: true,
      name: 'uniq_ebook_reads_user_ebook',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('ebook_reads', 'uniq_ebook_reads_user_ebook');
  },
};
