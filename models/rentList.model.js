module.exports = (sequelize, DataTypes) => {
  const RentList = sequelize.define(
    'RentList',
    {
      rentListId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'rent_list_id',
      },
      rentDate: {
        type: DataTypes.DATEONLY,
        field: 'rent_date',
      },
      dueDate: {
        type: DataTypes.DATEONLY,
        field: 'due_date',
      },
      returnDate: {
        type: DataTypes.DATEONLY,
        field: 'return_date',
      },
      Books_book_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'Books_book_id',
      },
      Users_users_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'Users_users_id',
      },
    },
    {
      tableName: 'rent_list',
      freezeTableName: true,
    }
  );

  RentList.associate = (models) => {
    RentList.belongsTo(models.Book, { foreignKey: 'Books_book_id', as: 'book' });
    RentList.belongsTo(models.User, { foreignKey: 'Users_users_id', as: 'user' });
  };

  return RentList;
};
