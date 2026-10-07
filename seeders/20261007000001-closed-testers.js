'use strict';

const TESTERS = [
  { email: 'aungmawwunna@gmail.com', short_name: 'Wunna' },
  { email: 'lha74901@gmail.com', short_name: 'LHA' },
  { email: 'shanehtet2019.sha@gmail.com', short_name: 'SHA' },
  { email: 'hnin84163@gmail.com', short_name: 'PWA-1' },
  { email: 'zar971269@gmail.com', short_name: 'PWA-2' },
  { email: 'nayye0958@gmail.com', short_name: 'NYT-1' },
  { email: 'maharkyaw46527@gmail.com', short_name: 'NYT-2' },
  { email: 'khantnaymin74742@gmail.com', short_name: 'NYT-3' },
  { email: 'kothetofficial@gmail.com', short_name: 'NYT-4' },
  { email: 'heinkhant33428@gmail.com', short_name: 'AHK' },
  { email: 'ayethandar6843@gmail.com', short_name: 'HZH' },
  { email: 'thethtar6843@gmail.com', short_name: 'HZH-2' },
  { email: 'controlman222@gmail.com', short_name: 'NYT-5' },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const emails = TESTERS.map((t) => t.email.toLowerCase());

    const [existing] = await queryInterface.sequelize.query(
      `SELECT email FROM closed_testers WHERE email IN (:emails)`,
      { replacements: { emails } }
    );
    const existingSet = new Set(
      (existing || []).map((row) => String(row.email).toLowerCase())
    );

    const rows = TESTERS.filter((t) => !existingSet.has(t.email.toLowerCase())).map(
      (t) => ({
        email: t.email.toLowerCase(),
        short_name: t.short_name,
        status: 'invited',
        last_active_at: null,
        created_at: now,
        updated_at: now,
      })
    );

    if (rows.length > 0) {
      await queryInterface.bulkInsert('closed_testers', rows);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      'closed_testers',
      {
        email: TESTERS.map((t) => t.email.toLowerCase()),
      },
      {}
    );
  },
};
