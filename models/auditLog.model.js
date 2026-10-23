module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define(
    'AuditLog',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      actorId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'actor_id',
      },
      actorName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: 'system',
        field: 'actor_name',
      },
      action: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      target: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      result: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'success',
      },
      details: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      ip: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
    },
    {
      tableName: 'audit_logs',
      freezeTableName: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    }
  );

  AuditLog.associate = () => {};

  return AuditLog;
};
