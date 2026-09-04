module.exports = (sequelize, DataTypes) => {
  const EBookRead = sequelize.define(
    'EBookRead',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id',
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'user_id',
      },
      ebookId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'ebook_id',
      },
      readAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'read_at',
      },
    },
    {
      tableName: 'ebook_reads',
      freezeTableName: true,
      timestamps: false,
    }
  );

  EBookRead.associate = (models) => {
    EBookRead.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    EBookRead.belongsTo(models.EBook, { foreignKey: 'ebookId', as: 'ebook' });
  };

  return EBookRead;
};
