'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('app_settings', 'setting_value', {
      type: Sequelize.TEXT,
      allowNull: false,
      defaultValue: '',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('app_settings', 'setting_value', {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
    });
  },
};
