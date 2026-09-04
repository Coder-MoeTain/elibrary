'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ebook_reads', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'users_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      ebook_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'ebooks', key: 'eBooks_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      read_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('ebook_reads', ['user_id'], { name: 'idx_ebook_reads_user_id' });
    await queryInterface.addIndex('ebook_reads', ['ebook_id'], { name: 'idx_ebook_reads_ebook_id' });
    await queryInterface.addIndex('ebook_reads', ['read_at'], { name: 'idx_ebook_reads_read_at' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ebook_reads');
  },
};
