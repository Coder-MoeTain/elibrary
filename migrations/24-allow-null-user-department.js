'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Allow Google Sign-In pending users without a department (admin can assign later).
    await queryInterface.sequelize.query(
      'ALTER TABLE `users` MODIFY `department_department_id` INT NULL'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE `users` MODIFY `department_department_id` INT NOT NULL'
    );
  },
};
