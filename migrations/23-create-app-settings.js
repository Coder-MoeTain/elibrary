'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
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

    await queryInterface.bulkInsert('app_settings', [
      {
        setting_key: 'timezone',
        setting_value: 'Asia/Yangon',
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_settings');
  },
};
