module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      usersId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'users_id',
      },
      userName: {
        type: DataTypes.STRING(255),
        field: 'user_name',
        validate: { len: [0, 255] },
      },
      password: {
        type: DataTypes.STRING(255),
      },
      dateOfBirth: {
        type: DataTypes.DATEONLY,
        field: 'date_of_birth',
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: { len: [0, 255] },
      },
      department_department_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'department_department_id',
      },
      status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'PENDING',
        field: 'status',
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_deleted',
      },
    },
    {
      tableName: 'users',
      freezeTableName: true,
      defaultScope: {
        attributes: { exclude: ['password'] },
        where: { isDeleted: false },
      },
      scopes: {
        withPassword: {},
      },
    }
  );

  User.associate = (models) => {
    User.belongsTo(models.Department, { foreignKey: 'department_department_id', as: 'department' });
    User.hasMany(models.RentList, { foreignKey: 'Users_users_id', as: 'rentals' });
    User.hasMany(models.EBookRead, { foreignKey: 'userId', as: 'ebookReads' });
    User.hasMany(models.Favorite, { foreignKey: 'Users_users_id', as: 'favorites' });
  };

  return User;
};
