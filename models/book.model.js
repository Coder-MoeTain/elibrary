module.exports = (sequelize, DataTypes) => {
  const Book = sequelize.define(
    'Book',
    {
      bookId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'book_id',
      },
      bookName: {
        type: DataTypes.STRING(255),
        field: 'book_name',
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
      place: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'place',
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
    },
    {
      tableName: 'books',
      freezeTableName: true,
    }
  );

  Book.associate = (models) => {
    Book.belongsTo(models.Category, { foreignKey: 'Category_category_id', as: 'category' });
    Book.belongsTo(models.Author, { foreignKey: 'Author_Author_id', as: 'author' });
    Book.hasMany(models.RentList, { foreignKey: 'Books_book_id', as: 'rentals' });
  };

  return Book;
};
