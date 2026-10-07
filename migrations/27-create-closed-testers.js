'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const normalized = tables.map((t) => String(t).toLowerCase());
    if (normalized.includes('closed_testers')) return;

    await queryInterface.createTable('closed_testers', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      short_name: {
        type: Sequelize.STRING(32),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('invited', 'installed', 'active'),
        allowNull: false,
        defaultValue: 'invited',
      },
      last_active_at: {
        type: Sequelize.DATE,
        allowNull: true,
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('closed_testers');
  },
};
