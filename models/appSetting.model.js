module.exports = (sequelize, DataTypes) => {
  const AppSetting = sequelize.define(
    'AppSetting',
    {
      settingKey: {
        type: DataTypes.STRING(64),
        primaryKey: true,
        field: 'setting_key',
      },
      settingValue: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: '',
        field: 'setting_value',
      },
    },
    {
      tableName: 'app_settings',
      freezeTableName: true,
      timestamps: true,
      createdAt: false,
      updatedAt: 'updated_at',
    }
  );

  AppSetting.associate = () => {};

  return AppSetting;
};
