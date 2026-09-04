module.exports = (sequelize, DataTypes) => {
  const Department = sequelize.define(
    'Department',
    {
      departmentId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'department_id',
      },
      departmentName: {
        type: DataTypes.STRING(255),
        field: 'department_name',
        validate: { len: [0, 255] },
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_deleted',
      },
    },
    {
      tableName: 'department',
      freezeTableName: true,
      defaultScope: {
        where: { isDeleted: false },
      },
    }
  );

  Department.associate = (models) => {
    Department.hasMany(models.User, { foreignKey: 'department_department_id', as: 'users' });
  };

  return Department;
};
