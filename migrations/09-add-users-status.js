'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'status', {
      type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'PENDING',
    });

    // Existing rows were set to PENDING by the column default; approve them so current members keep access.
    await queryInterface.sequelize.query(`UPDATE \`users\` SET \`status\` = 'APPROVED'`);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'status');
  },
};
