'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('books', {
      book_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      book_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      release_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      Category_category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'category', key: 'category_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      Author_Author_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'author', key: 'Author_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('books', ['Category_category_id'], {
      name: 'fk_Books_Category_idx',
    });
    await queryInterface.addIndex('books', ['Author_Author_id'], {
      name: 'fk_Books_Author1_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('books');
  },
};
