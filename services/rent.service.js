const { RentList, Book, User } = require('../models');
const AppError = require('../utils/AppError');
const { HTTP_STATUS, MESSAGES, ROLES } = require('../constants');

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Create rental if no active row exists for the book (return_date IS NULL).
 */
async function rentBook({ bookId, usersId, rentDate, dueDate }, actor) {
  let targetUserId = usersId;
  if (actor.role === ROLES.USER) {
    targetUserId = actor.id;
  }
  if (targetUserId == null) {
    throw new AppError('usersId is required for admin rental', HTTP_STATUS.BAD_REQUEST);
  }

  const book = await Book.findByPk(bookId);
  if (!book) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

  const borrower = await User.findByPk(targetUserId);
  if (!borrower) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

  const active = await RentList.findOne({
    where: { Books_book_id: bookId, returnDate: null },
  });
  if (active) {
    throw new AppError(MESSAGES.BOOK_RENTED, HTTP_STATUS.CONFLICT);
  }

  return RentList.create({
    Books_book_id: bookId,
    Users_users_id: targetUserId,
    rentDate: rentDate ?? todayDateString(),
    dueDate: dueDate ?? null,
    returnDate: null,
  });
}

async function returnBook(rentListId, actor) {
  const row = await RentList.findByPk(rentListId, {
    include: ['book', { association: 'user', attributes: { exclude: ['password'] } }],
  });
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  if (actor.role === ROLES.USER && row.Users_users_id !== actor.id) {
    throw new AppError(MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
  }
  if (row.returnDate) {
    throw new AppError('Book already returned', HTTP_STATUS.BAD_REQUEST);
  }
  await row.update({ returnDate: todayDateString() });
  return row.reload({ include: ['book', { association: 'user', attributes: { exclude: ['password'] } }] });
}

async function findAll(actor) {
  const where = {};
  if (actor.role === ROLES.USER) {
    where.Users_users_id = actor.id;
  }
  return RentList.findAll({
    where,
    include: [
      'book',
      { association: 'user', attributes: { exclude: ['password'] } },
    ],
    order: [['rentListId', 'DESC']],
  });
}

async function findById(id, actor) {
  const row = await RentList.findByPk(id, {
    include: [
      'book',
      { association: 'user', attributes: { exclude: ['password'] } },
    ],
  });
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  if (actor.role === ROLES.USER && row.Users_users_id !== actor.id) {
    throw new AppError(MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
  }
  return row;
}

async function updateRecord(id, body) {
  const row = await RentList.findByPk(id);
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  await row.update({
    rentDate: body.rentDate !== undefined ? body.rentDate : row.rentDate,
    dueDate: body.dueDate !== undefined ? body.dueDate : row.dueDate,
    returnDate: body.returnDate !== undefined ? body.returnDate : row.returnDate,
    Books_book_id: body.bookId ?? row.Books_book_id,
    Users_users_id: body.usersId ?? row.Users_users_id,
  });
  return findById(id, { role: ROLES.ADMIN });
}

async function remove(id) {
  const row = await RentList.findByPk(id);
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  await row.destroy();
  return true;
}

module.exports = {
  rentBook,
  returnBook,
  findAll,
  findById,
  updateRecord,
  remove,
};
