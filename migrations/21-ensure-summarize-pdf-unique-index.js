'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    try {
      await queryInterface.removeIndex('Summarize_Pdf', 'idx_summarize_pdf_ebook_id');
    } catch {
      /* index may not exist */
    }

    try {
      await queryInterface.addIndex('Summarize_Pdf', ['ebook_id'], {
        name: 'uniq_summarize_pdf_ebook_id',
        unique: true,
      });
    } catch (err) {
      const message = `${err?.message || ''}`;
      if (
        message.includes('Duplicate key name') ||
        message.includes('already exists') ||
        message.includes('Duplicate entry')
      ) {
        return;
      }
      throw err;
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('Summarize_Pdf', 'uniq_summarize_pdf_ebook_id');
    } catch {
      /* none */
    }

    try {
      await queryInterface.addIndex('Summarize_Pdf', ['ebook_id'], {
        name: 'idx_summarize_pdf_ebook_id',
      });
    } catch {
      /* none */
    }
  },
};
