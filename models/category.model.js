module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define(
    'Category',
    {
      categoryId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'category_id',
      },
      categoryName: {
        type: DataTypes.STRING(255),
        field: 'category_name',
        validate: { len: [0, 255] },
      },
    },
    {
      tableName: 'category',
      freezeTableName: true,
    }
  );

  Category.associate = (models) => {
    Category.hasMany(models.Book, { foreignKey: 'Category_category_id', as: 'books' });
    Category.hasMany(models.EBook, { foreignKey: 'Category_category_id', as: 'eBooks' });
  };

  return Category;
};
