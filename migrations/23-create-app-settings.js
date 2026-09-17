'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const normalized = tables.map((t) => String(t).toLowerCase());
    const exists = normalized.includes('app_settings');

    if (!exists) {
      await queryInterface.createTable('app_settings', {
        setting_key: {
          type: Sequelize.STRING(64),
          allowNull: false,
          primaryKey: true,
        },
        setting_value: {
          type: Sequelize.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        updated_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }

    // Insert default timezone only if missing (avoids duplicate PK "Validation error").
    await queryInterface.sequelize.query(`
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      SELECT 'timezone', 'Asia/Yangon', NOW()
      FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1 FROM app_settings WHERE setting_key = 'timezone'
      )
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_settings');
  },
};
