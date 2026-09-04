'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ebooks', {
      eBooks_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      eBook_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      release_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      cover_image: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      pdf_file: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      Category_category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'category', key: 'category_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      Author_Author_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'author', key: 'Author_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
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

    await queryInterface.addIndex('ebooks', ['Category_category_id'], {
      name: 'fk_eBooks_Category1_idx',
    });
    await queryInterface.addIndex('ebooks', ['Author_Author_id'], {
      name: 'fk_eBooks_Author1_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ebooks');
  },
};
