'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rent_list', {
      rent_list_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      rent_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      due_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      return_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      Books_book_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'books', key: 'book_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      Users_users_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'users_id' },
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

    await queryInterface.addIndex('rent_list', ['Books_book_id'], {
      name: 'fk_rent_list_Books1_idx',
    });
    await queryInterface.addIndex('rent_list', ['Users_users_id'], {
      name: 'fk_rent_list_Users1_idx',
    });
    await queryInterface.addIndex('rent_list', ['Books_book_id', 'return_date'], {
      name: 'idx_rent_list_book_active',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('rent_list');
  },
};
