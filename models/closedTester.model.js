module.exports = (sequelize, DataTypes) => {
  const ClosedTester = sequelize.define(
    'ClosedTester',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: { isEmail: true, len: [3, 255] },
      },
      shortName: {
        type: DataTypes.STRING(32),
        allowNull: false,
        field: 'short_name',
        validate: { len: [1, 32] },
      },
      status: {
        type: DataTypes.ENUM('invited', 'installed', 'active'),
        allowNull: false,
        defaultValue: 'invited',
      },
      lastActiveAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_active_at',
      },
    },
    {
      tableName: 'closed_testers',
      freezeTableName: true,
    }
  );

  ClosedTester.associate = (models) => {
    ClosedTester.hasMany(models.ClosedTesterActivity, {
      foreignKey: 'closedTesterId',
      as: 'activityDays',
    });
  };

  return ClosedTester;
};
