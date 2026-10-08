'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const email = 'winnaythu53@gmail.com';
    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM closed_testers WHERE email = :email LIMIT 1`,
      { replacements: { email } }
    );
    if (existing && existing.length > 0) return;

    const now = new Date();
    await queryInterface.bulkInsert('closed_testers', [
      {
        email,
        short_name: 'WNT',
        status: 'invited',
        last_active_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      'closed_testers',
      { email: 'winnaythu53@gmail.com' },
      {}
    );
  },
};
