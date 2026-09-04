'use strict';

const bcrypt = require('bcryptjs');

/** Dev-only default — override with SEED_ADMIN_PASSWORD before seeding shared environments. */
const DEFAULT_SEED_ADMIN_PASSWORD = 'Admin123!';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const plain = process.env.SEED_ADMIN_PASSWORD || DEFAULT_SEED_ADMIN_PASSWORD;
    if (!process.env.SEED_ADMIN_PASSWORD) {
      // eslint-disable-next-line no-console
      console.warn(
        '[security] Seeding demo admin with default password. Set SEED_ADMIN_PASSWORD and change the password before production.',
      );
    }
    const password = await bcrypt.hash(plain, 12);
    const now = new Date();
    await queryInterface.bulkInsert(
      'admin',
      [
        {
          admin_name: 'superadmin',
          password,
          created_at: now,
          updated_at: now,
        },
      ],
      {}
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('admin', { admin_name: 'superadmin' }, {});
  },
};
