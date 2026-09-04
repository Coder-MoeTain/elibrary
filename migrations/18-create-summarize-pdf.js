'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Summarize_Pdf', {
      summarize_pdf_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      ebook_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ebooks',
          key: 'eBooks_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      summary: {
        type: Sequelize.TEXT('long'),
        allowNull: false,
      },
      model_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'gpt-4o-mini',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('Summarize_Pdf', ['ebook_id'], {
      name: 'idx_summarize_pdf_ebook_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Summarize_Pdf');
  },
};
