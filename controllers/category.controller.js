const categoryService = require('../services/category.service');
const asyncHandler = require('../utils/asyncHandler');
const { success, created, noContent } = require('../helpers/response.helper');

const create = asyncHandler(async (req, res) => {
  const row = await categoryService.create(req.body);
  return created(res, row);
});

const list = asyncHandler(async (req, res) => {
  const rows = await categoryService.findAll();
  return success(res, { data: rows });
});

const getById = asyncHandler(async (req, res) => {
  const row = await categoryService.findById(req.params.id);
  return success(res, { data: row });
});

const update = asyncHandler(async (req, res) => {
  const row = await categoryService.update(req.params.id, req.body);
  return success(res, { data: row, message: 'Updated' });
});

const remove = asyncHandler(async (req, res) => {
  await categoryService.remove(req.params.id);
  return noContent(res);
});

module.exports = { create, list, getById, update, remove };
