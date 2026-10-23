'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const normalized = tables.map((t) => String(t).toLowerCase());
    if (!normalized.includes('audit_logs')) return;

    const desc = await queryInterface.describeTable('audit_logs');
    if (!desc.actor_kind) {
      await queryInterface.addColumn('audit_logs', 'actor_kind', {
        type: Sequelize.STRING(16),
        allowNull: false,
        defaultValue: 'system',
      });
    }
    if (!desc.result) {
      await queryInterface.addColumn('audit_logs', 'result', {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'success',
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const normalized = tables.map((t) => String(t).toLowerCase());
    if (!normalized.includes('audit_logs')) return;

    const desc = await queryInterface.describeTable('audit_logs');
    if (desc.actor_kind) {
      await queryInterface.removeColumn('audit_logs', 'actor_kind');
    }
  },
};
