module.exports = (sequelize, DataTypes) => {
  const Author = sequelize.define(
    'Author',
    {
      authorId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'Author_id',
      },
      authorName: {
        type: DataTypes.STRING(255),
        field: 'Author_name',
        validate: { len: [0, 255] },
      },
      country: {
        type: DataTypes.STRING(100),
        field: 'country',
        allowNull: true,
        validate: { len: [0, 100] },
      },
    },
    {
      tableName: 'author',
      freezeTableName: true,
    }
  );

  Author.associate = (models) => {
    Author.hasMany(models.Book, { foreignKey: 'Author_Author_id', as: 'books' });
    Author.hasMany(models.EBook, { foreignKey: 'Author_Author_id', as: 'eBooks' });
  };

  return Author;
};
