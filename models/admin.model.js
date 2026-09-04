const { ADMIN_TIER } = require('../constants');

module.exports = (sequelize, DataTypes) => {
  const Admin = sequelize.define(
    'Admin',
    {
      adminId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'admin_id',
      },
      adminName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'admin_name',
        validate: { notEmpty: true, len: [1, 255] },
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: { notEmpty: true },
      },
      role: {
        type: DataTypes.ENUM(ADMIN_TIER.SUPER_ADMIN, ADMIN_TIER.ADMIN),
        allowNull: false,
        defaultValue: ADMIN_TIER.ADMIN,
        field: 'role',
      },
    },
    {
      tableName: 'admin',
      freezeTableName: true,
      defaultScope: {
        attributes: { exclude: ['password'] },
      },
      scopes: {
        withPassword: {},
      },
    }
  );

  Admin.associate = () => {};

  return Admin;
};
