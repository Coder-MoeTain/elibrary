'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (!table.apple_sub && !table.appleSub) {
      await queryInterface.addColumn('users', 'apple_sub', {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');
    if (table.apple_sub || table.appleSub) {
      await queryInterface.removeColumn('users', 'apple_sub');
    }
  },
};
