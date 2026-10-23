'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const normalized = tables.map((t) => String(t).toLowerCase());
    if (normalized.includes('audit_logs')) return;

    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      actor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      actor_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        defaultValue: 'system',
      },
      action: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      target: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      result: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'success',
      },
      details: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      ip: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('audit_logs', ['created_at'], {
      name: 'idx_audit_logs_created_at',
    });
    await queryInterface.addIndex('audit_logs', ['action'], {
      name: 'idx_audit_logs_action',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
  },
};
