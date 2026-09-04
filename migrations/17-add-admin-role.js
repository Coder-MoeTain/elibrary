'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('admin', 'role', {
      type: Sequelize.ENUM('SUPER_ADMIN', 'ADMIN'),
      allowNull: false,
      defaultValue: 'ADMIN',
    });
    await queryInterface.sequelize.query(
      `UPDATE \`admin\` SET \`role\` = 'SUPER_ADMIN' WHERE \`admin_id\` = 1`
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('admin', 'role');
  },
};
