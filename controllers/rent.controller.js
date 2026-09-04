const rentService = require('../services/rent.service');
const asyncHandler = require('../utils/asyncHandler');
const { success, created, noContent } = require('../helpers/response.helper');

const borrow = asyncHandler(async (req, res) => {
  const row = await rentService.rentBook(
    {
      bookId: req.body.bookId,
      usersId: req.body.usersId,
      rentDate: req.body.rentDate,
      dueDate: req.body.dueDate,
    },
    req.user
  );
  return created(res, row, 'Book rented');
});

const returnBook = asyncHandler(async (req, res) => {
  const row = await rentService.returnBook(req.params.id, req.user);
  return success(res, { data: row, message: 'Book returned' });
});

const list = asyncHandler(async (req, res) => {
  const rows = await rentService.findAll(req.user);
  return success(res, { data: rows });
});

const getById = asyncHandler(async (req, res) => {
  const row = await rentService.findById(req.params.id, req.user);
  return success(res, { data: row });
});

const update = asyncHandler(async (req, res) => {
  const row = await rentService.updateRecord(req.params.id, req.body);
  return success(res, { data: row, message: 'Updated' });
});

const remove = asyncHandler(async (req, res) => {
  await rentService.remove(req.params.id);
  return noContent(res);
});

module.exports = {
  borrow,
  returnBook,
  list,
  getById,
  update,
  remove,
};
