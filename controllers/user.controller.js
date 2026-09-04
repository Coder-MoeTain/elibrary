const userService = require('../services/user.service');
const asyncHandler = require('../utils/asyncHandler');
const { success, created } = require('../helpers/response.helper');

const create = asyncHandler(async (req, res) => {
  const row = await userService.create(req.body);
  return created(res, row);
});

const list = asyncHandler(async (req, res) => {
  const includeDeleted = String(req.query.includeDeleted).toLowerCase() === 'true';
  const rows = await userService.findAll({ includeDeleted });
  return success(res, { data: rows });
});

const getById = asyncHandler(async (req, res) => {
  const row = await userService.findById(req.params.id);
  return success(res, { data: row });
});

const getMe = asyncHandler(async (req, res) => {
  const row = await userService.findMe(req.user.id);
  return success(res, { data: row });
});

const updateMe = asyncHandler(async (req, res) => {
  const row = await userService.updateMe(req.user.id, req.body);
  return success(res, { data: row, message: 'Profile updated successfully' });
});

const changeMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await userService.changeMyPassword(req.user.id, currentPassword, newPassword);
  return success(res, { message: 'Password updated successfully' });
});

const update = asyncHandler(async (req, res) => {
  const row = await userService.update(req.params.id, req.body);
  return success(res, { data: row, message: 'Updated' });
});

const remove = asyncHandler(async (req, res) => {
  await userService.remove(req.params.id);
  return success(res, { message: 'User archived successfully' });
});

module.exports = { create, list, getById, getMe, updateMe, changeMyPassword, update, remove };
