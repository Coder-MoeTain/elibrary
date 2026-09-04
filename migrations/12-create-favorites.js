'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('favorites', {
      favorite_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      Users_users_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'users_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      Ebooks_ebook_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'ebooks', key: 'eBooks_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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

    await queryInterface.addIndex('favorites', ['Users_users_id'], {
      name: 'idx_favorites_user',
    });
    await queryInterface.addIndex('favorites', ['Ebooks_ebook_id'], {
      name: 'idx_favorites_ebook',
    });
    await queryInterface.addConstraint('favorites', {
      fields: ['Users_users_id', 'Ebooks_ebook_id'],
      type: 'unique',
      name: 'favorites_user_ebook_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('favorites');
  },
};

