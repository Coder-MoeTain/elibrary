const { Sequelize, DataTypes } = require('sequelize');
const env = (process.env.NODE_ENV || 'development').trim();
const dbConfig = require('../config/database.js')[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    define: {
      underscored: false,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

const db = {
  sequelize,
  Sequelize,
  Category: require('./category.model')(sequelize, DataTypes),
  Author: require('./author.model')(sequelize, DataTypes),
  Book: require('./book.model')(sequelize, DataTypes),
  Admin: require('./admin.model')(sequelize, DataTypes),
  Department: require('./department.model')(sequelize, DataTypes),
  User: require('./user.model')(sequelize, DataTypes),
  EBook: require('./ebook.model')(sequelize, DataTypes),
  Favorite: require('./favorite.model')(sequelize, DataTypes),
  RentList: require('./rentList.model')(sequelize, DataTypes),
  EBookRead: require('./ebookRead.model')(sequelize, DataTypes),
};

Object.keys(db).forEach((key) => {
  if (key !== 'sequelize' && key !== 'Sequelize' && typeof db[key].associate === 'function') {
    db[key].associate(db);
  }
});

module.exports = db;
