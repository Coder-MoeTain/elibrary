module.exports = (sequelize, DataTypes) => {
  const ClosedTesterActivity = sequelize.define(
    'ClosedTesterActivity',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      closedTesterId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'closed_tester_id',
      },
      activeDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'active_date',
      },
    },
    {
      tableName: 'closed_tester_activity',
      freezeTableName: true,
      updatedAt: false,
      createdAt: 'created_at',
    }
  );

  ClosedTesterActivity.associate = (models) => {
    ClosedTesterActivity.belongsTo(models.ClosedTester, {
      foreignKey: 'closedTesterId',
      as: 'tester',
    });
  };

  return ClosedTesterActivity;
};
