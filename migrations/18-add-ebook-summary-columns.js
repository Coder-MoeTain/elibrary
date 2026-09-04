'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ebooks', 'ai_summary', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
    });

    await queryInterface.addColumn('ebooks', 'is_summarized', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('ebooks', 'summary_status', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: 'pending',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ebooks', 'summary_status');
    await queryInterface.removeColumn('ebooks', 'is_summarized');
    await queryInterface.removeColumn('ebooks', 'ai_summary');
  },
};
