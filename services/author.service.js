const { Author } = require('../models');
const AppError = require('../utils/AppError');
const { HTTP_STATUS, MESSAGES } = require('../constants');

async function create(data) {
  return Author.create(data);
}

async function findAll() {
  return Author.findAll({ order: [['authorId', 'ASC']] });
}

async function findById(id) {
  const row = await Author.findByPk(id);
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  return row;
}

async function update(id, data) {
  const row = await findById(id);
  await row.update(data);
  return row;
}

async function remove(id) {
  const row = await findById(id);
  await row.destroy();
  return true;
}

module.exports = {
  create,
  findAll,
  findById,
  update,
  remove,
};
