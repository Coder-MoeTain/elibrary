'use strict';

const { QueryTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const qi = queryInterface.sequelize;

    const rows = await qi.query(
      "SHOW INDEX FROM `department` WHERE Column_name = 'department_name' AND Non_unique = 0",
      { type: QueryTypes.SELECT }
    );

    const keyNames = [
      ...new Set(
        (rows || [])
          .map((r) => r.Key_name || r.key_name)
          .filter((k) => k && k !== 'PRIMARY' && k !== 'uniq_department_name_deleted')
      ),
    ];

    for (const keyName of keyNames) {
      await queryInterface.removeIndex('department', keyName);
    }

    try {
      await queryInterface.removeIndex('department', 'uniq_department_name_deleted');
    } catch {
      /* none */
    }

    // Resolve duplicate (department_name, is_deleted) pairs so composite UNIQUE can be applied.
    await qi.query(`
      UPDATE \`department\` d1
      INNER JOIN \`department\` d2
        ON d1.department_id > d2.department_id
        AND d1.is_deleted = d2.is_deleted
        AND COALESCE(LOWER(TRIM(d1.department_name)), '') = COALESCE(LOWER(TRIM(d2.department_name)), '')
      SET d1.department_name = LEFT(CONCAT(COALESCE(d1.department_name, ''), ' (', d1.department_id, ')'), 45)
    `);

    await queryInterface.addIndex('department', ['department_name', 'is_deleted'], {
      unique: true,
      name: 'uniq_department_name_deleted',
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('department', 'uniq_department_name_deleted');
    } catch {
      /* none */
    }
  },
};
