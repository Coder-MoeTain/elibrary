module.exports = (sequelize, DataTypes) => {
  const EBook = sequelize.define(
    'EBook',
    {
      eBooksId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'eBooks_id',
      },
      eBookName: {
        type: DataTypes.STRING(255),
        field: 'eBook_name',
        validate: { len: [0, 255] },
      },
      releaseDate: {
        type: DataTypes.DATEONLY,
        field: 'release_date',
      },
      description: {
        type: DataTypes.TEXT,
      },
      coverImage: {
        type: DataTypes.STRING(500),
        field: 'cover_image',
        validate: { len: [0, 500] },
      },
      pdfFile: {
        type: DataTypes.STRING(500),
        field: 'pdf_file',
        validate: { len: [0, 500] },
      },
      Category_category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'Category_category_id',
      },
      Author_Author_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'Author_Author_id',
      },
      aiSummary: {
        type: DataTypes.TEXT('long'),
        field: 'ai_summary',
      },
      aiSummaryEn: {
        type: DataTypes.TEXT('long'),
        field: 'ai_summary_en',
      },
      aiSummaryMy: {
        type: DataTypes.TEXT('long'),
        field: 'ai_summary_my',
      },
      isSummarized: {
        type: DataTypes.BOOLEAN,
        field: 'is_summarized',
        defaultValue: false,
      },
      summaryStatus: {
        type: DataTypes.STRING(50),
        field: 'summary_status',
        defaultValue: 'pending',
      },
      summaryLanguage: {
        type: DataTypes.STRING(10),
        field: 'summary_language',
      },
    },
    {
      tableName: 'ebooks',
      freezeTableName: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  EBook.associate = (models) => {
    EBook.belongsTo(models.Category, { foreignKey: 'Category_category_id', as: 'category' });
    EBook.belongsTo(models.Author, { foreignKey: 'Author_Author_id', as: 'author' });
    EBook.hasMany(models.EBookRead, { foreignKey: 'ebookId', as: 'reads' });
    EBook.hasMany(models.Favorite, { foreignKey: 'Ebooks_ebook_id', as: 'favorites' });
  };

  return EBook;
};
