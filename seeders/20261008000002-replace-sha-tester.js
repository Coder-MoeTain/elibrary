'use strict';

const OLD_EMAIL = 'shanehtet2019.sha@gmail.com';
const NEW_EMAIL = 'thazinhtoo2007.tzh@gmail.com';
const SHORT_NAME = 'SHA';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Remove old SHA tester (activity rows cascade if FK exists).
    await queryInterface.bulkDelete('closed_testers', { email: OLD_EMAIL }, {});

    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM closed_testers WHERE email = :email LIMIT 1`,
      { replacements: { email: NEW_EMAIL } }
    );
    if (existing && existing.length > 0) {
      await queryInterface.sequelize.query(
        `UPDATE closed_testers SET short_name = :shortName, updated_at = :now WHERE email = :email`,
        { replacements: { shortName: SHORT_NAME, email: NEW_EMAIL, now: new Date() } }
      );
      return;
    }

    const now = new Date();
    await queryInterface.bulkInsert('closed_testers', [
      {
        email: NEW_EMAIL,
        short_name: SHORT_NAME,
        status: 'invited',
        last_active_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('closed_testers', { email: NEW_EMAIL }, {});

    const now = new Date();
    await queryInterface.bulkInsert('closed_testers', [
      {
        email: OLD_EMAIL,
        short_name: SHORT_NAME,
        status: 'invited',
        last_active_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);
  },
};
