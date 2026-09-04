const authorService = require('../services/author.service');
const asyncHandler = require('../utils/asyncHandler');
const { success, created, noContent } = require('../helpers/response.helper');

const create = asyncHandler(async (req, res) => {
  const row = await authorService.create(req.body);
  return created(res, row);
});

const list = asyncHandler(async (req, res) => {
  const rows = await authorService.findAll();
  return success(res, { data: rows });
});

const getById = asyncHandler(async (req, res) => {
  const row = await authorService.findById(req.params.id);
  return success(res, { data: row });
});

const update = asyncHandler(async (req, res) => {
  const row = await authorService.update(req.params.id, req.body);
  return success(res, { data: row, message: 'Updated' });
});

const remove = asyncHandler(async (req, res) => {
  await authorService.remove(req.params.id);
  return noContent(res);
});

module.exports = { create, list, getById, update, remove };
