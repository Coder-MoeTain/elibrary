'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Summarize_Pdf', 'language', {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: 'en',
    });

    try {
      await queryInterface.removeIndex('Summarize_Pdf', 'uniq_summarize_pdf_ebook_id');
    } catch {
      /* index may not exist */
    }

    await queryInterface.addIndex('Summarize_Pdf', ['ebook_id', 'language'], {
      unique: true,
      name: 'uniq_summarize_pdf_ebook_lang',
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('Summarize_Pdf', 'uniq_summarize_pdf_ebook_lang');
    } catch {
      /* none */
    }

    await queryInterface.removeColumn('Summarize_Pdf', 'language');

    try {
      await queryInterface.addIndex('Summarize_Pdf', ['ebook_id'], {
        unique: true,
        name: 'uniq_summarize_pdf_ebook_id',
      });
    } catch {
      /* none */
    }
  },
};
