module.exports = (sequelize, DataTypes) => {
  const Favorite = sequelize.define(
    'Favorite',
    {
      favoriteId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'favorite_id',
      },
      Users_users_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'Users_users_id',
      },
      Ebooks_ebook_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'Ebooks_ebook_id',
      },
    },
    {
      tableName: 'favorites',
      freezeTableName: true,
      indexes: [
        {
          unique: true,
          fields: ['Users_users_id', 'Ebooks_ebook_id'],
          name: 'favorites_user_ebook_unique',
        },
      ],
    }
  );

  Favorite.associate = (models) => {
    Favorite.belongsTo(models.User, { foreignKey: 'Users_users_id', as: 'user' });
    Favorite.belongsTo(models.EBook, { foreignKey: 'Ebooks_ebook_id', as: 'ebook' });
  };

  return Favorite;
};

