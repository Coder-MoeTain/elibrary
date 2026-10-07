'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const normalized = tables.map((t) => String(t).toLowerCase());
    if (normalized.includes('closed_tester_activity')) return;

    await queryInterface.createTable('closed_tester_activity', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      closed_tester_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'closed_testers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      active_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex(
      'closed_tester_activity',
      ['closed_tester_id', 'active_date'],
      {
        unique: true,
        name: 'uq_closed_tester_activity_tester_date',
      }
    );
    await queryInterface.addIndex('closed_tester_activity', ['active_date'], {
      name: 'idx_closed_tester_activity_date',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('closed_tester_activity');
  },
};
